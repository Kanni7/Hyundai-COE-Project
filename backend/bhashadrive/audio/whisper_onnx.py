"""Whisper inference on k2-fsa/sherpa-onnx ONNX exports, with one encoder run shared by several languages.

sherpa-onnx's recogniser fixes the decoding language in its config, so decoding one utterance in two
languages re-runs the 32-layer encoder (most of the cost). The exported decoder takes a batch, so here
the encoder runs once and every requested language is decoded together in one greedy batch.
Features and decoding follow sherpa-onnx (OpenAI log-mel, normalised, 1000 zero frames of tail padding
so the decoder can find end-of-text; plain greedy search with <|notimestamps|>).
"""
from __future__ import annotations

import base64
import zlib
from pathlib import Path

import numpy as np

SR, N_FFT, HOP = 16000, 400, 160
TAIL_PADDING_FRAMES = 1000  # sherpa-onnx default; shorter padding raised WER sharply in our measurements
MAX_FRAMES = 3000


def mel_filters(n_mels: int, sr: int = SR, n_fft: int = N_FFT) -> np.ndarray:
    """librosa.filters.mel(sr, n_fft, n_mels) (Slaney scale and norm), as used by OpenAI Whisper."""
    f_sp, min_log_hz = 200.0 / 3, 1000.0
    min_log_mel, logstep = min_log_hz / f_sp, np.log(6.4) / 27.0

    def hz_to_mel(f):
        f = np.asarray(f, dtype=np.float64)
        return np.where(f >= min_log_hz, min_log_mel + np.log(np.maximum(f, 1e-10) / min_log_hz) / logstep, f / f_sp)

    def mel_to_hz(m):
        return np.where(m >= min_log_mel, min_log_hz * np.exp(logstep * (m - min_log_mel)), f_sp * m)

    fft_freqs = np.linspace(0, sr / 2, 1 + n_fft // 2)
    mel_f = mel_to_hz(np.linspace(hz_to_mel(0.0), hz_to_mel(sr / 2), n_mels + 2))
    ramps = mel_f[:, None] - fft_freqs[None, :]
    fdiff = np.diff(mel_f)
    weights = np.maximum(0, np.minimum(-ramps[:-2] / fdiff[:-1, None], ramps[2:] / fdiff[1:, None]))
    weights *= (2.0 / (mel_f[2:n_mels + 2] - mel_f[:n_mels]))[:, None]
    return weights.astype(np.float32)


def log_mel(audio: np.ndarray, filters: np.ndarray) -> np.ndarray:
    """Normalised Whisper log-mel features, shape (frames, n_mels)."""
    audio = np.asarray(audio, dtype=np.float32)
    if audio.size <= N_FFT // 2:
        audio = np.pad(audio, (0, N_FFT // 2 + 1 - audio.size))
    padded = np.pad(audio, N_FFT // 2, mode="reflect")
    frames = np.lib.stride_tricks.sliding_window_view(padded, N_FFT)[::HOP][:-1]
    power = np.abs(np.fft.rfft(frames * np.hanning(N_FFT + 1)[:-1].astype(np.float32), axis=1)) ** 2
    log_spec = np.log10(np.maximum(power @ filters.T, 1e-10))
    log_spec = np.maximum(log_spec, log_spec.max() - 8.0)
    return ((log_spec + 4.0) / 4.0).astype(np.float32)


class WhisperOnnx:
    def __init__(self, model_dir: str | Path, threads: int = 4):
        import onnxruntime as ort

        d = Path(model_dir)
        opts = ort.SessionOptions()
        opts.intra_op_num_threads, opts.inter_op_num_threads = threads, 1
        cpu = ["CPUExecutionProvider"]
        self.encoder = ort.InferenceSession(str(d / "encoder.int8.onnx"), opts, providers=cpu)
        self.decoder = ort.InferenceSession(str(d / "decoder.int8.onnx"), opts, providers=cpu)
        meta = self.encoder.get_modelmeta().custom_metadata_map
        self.n_layer, self.n_ctx = int(meta["n_text_layer"]), int(meta["n_text_ctx"])
        self.n_state = int(meta["n_text_state"])
        self.sot, self.eot = int(meta["sot"]), int(meta["eot"])
        self.transcribe_token, self.no_timestamps = int(meta["transcribe"]), int(meta["no_timestamps"])
        self.language_tokens = dict(zip(meta["all_language_codes"].split(","),
                                        map(int, meta["all_language_tokens"].split(","))))
        self.filters = mel_filters(int(meta["n_mels"]))
        self.token_bytes: dict[int, bytes] = {}
        for line in (d / "tokens.txt").read_text(encoding="utf-8").splitlines():
            sym, _, idx = line.rpartition(" ")
            if sym:
                self.token_bytes[int(idx)] = base64.b64decode(sym)

    def features(self, audio: np.ndarray) -> np.ndarray:
        mel = log_mel(audio, self.filters)[: MAX_FRAMES - 50]
        t = min(mel.shape[0] + TAIL_PADDING_FRAMES, MAX_FRAMES)
        out = np.zeros((1, mel.shape[1], t), dtype=np.float32)
        out[0, :, : mel.shape[0]] = mel.T
        return out

    def transcribe(self, audio: np.ndarray, languages: list[str] | tuple[str, ...]) -> list[str]:
        """One text per language, all decoded from a single encoder pass."""
        cross_k, cross_v = self.encoder.run(None, {"mel": self.features(audio)})
        b = len(languages)
        cross_k, cross_v = np.repeat(cross_k, b, axis=1), np.repeat(cross_v, b, axis=1)
        self_k = np.zeros((self.n_layer, b, self.n_ctx, self.n_state), dtype=np.float32)
        self_v = np.zeros_like(self_k)
        tokens = np.array([[self.sot, self.language_tokens[lang], self.transcribe_token, self.no_timestamps]
                           for lang in languages], dtype=np.int64)
        # Cap the length by audio duration: a hallucination loop on noise would otherwise run to n_ctx.
        max_new = min(self.n_ctx - tokens.shape[1], int(audio.size / SR * 15) + 10)
        out: list[list[int]] = [[] for _ in languages]
        done = np.zeros(b, dtype=bool)
        looped = np.zeros(b, dtype=bool)
        offset = 0
        for _ in range(max_new):
            logits, self_k, self_v, _ = self.decoder.run(None, {
                "tokens": tokens, "in_n_layer_self_k_cache": self_k, "in_n_layer_self_v_cache": self_v,
                "n_layer_cross_k": cross_k, "n_layer_cross_v": cross_v,
                "offset": np.array([offset], dtype=np.int64)})
            offset += tokens.shape[1]
            nxt = logits[:, -1].argmax(axis=-1)
            for i, tok in enumerate(nxt):
                if done[i]:
                    continue
                if tok == self.eot:
                    done[i] = True
                    continue
                out[i].append(int(tok))
                if len(out[i]) >= 4 and len(set(out[i][-4:])) == 1:  # stuck on one token: a failed pass
                    done[i] = looped[i] = True
            if done.all():
                break
            tokens = np.where(done, self.eot, nxt).astype(np.int64)[:, None]
        texts = [b"".join(self.token_bytes.get(t, b"") for t in seq if t < self.eot).decode("utf-8", "ignore").strip()
                 for seq in out]
        return ["" if loop or _repetitive(t) else t for t, loop in zip(texts, looped)]


def _repetitive(text: str, threshold: float = 2.4) -> bool:
    """Whisper's failure test: decoded text that gzip-compresses this well is a repetition loop."""
    data = text.encode("utf-8")
    return len(data) > 0 and len(data) / len(zlib.compress(data)) > threshold
