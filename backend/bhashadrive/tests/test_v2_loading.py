"""Model-loading failures must fail closed (clear error, no vehicle action, no fallback)."""
import json
from pathlib import Path

import numpy as np
import pytest

from bhashadrive.audio.asr import ASRUnavailableError
from bhashadrive.audio.sherpa_asr import SherpaWhisperASR
from bhashadrive.config import AppConfig, SherpaASRConfig
from bhashadrive.nlu.encoder import EncoderUnavailableError, OnnxSentenceEncoder
from bhashadrive.nlu.intent_model import IntentModel
from bhashadrive.nlu.taxonomy import TAXONOMY_VERSION


def test_missing_asr_model_raises(tmp_path):
    cfg = SherpaASRConfig()
    cfg.model_dir = tmp_path
    with pytest.raises(ASRUnavailableError):
        SherpaWhisperASR(cfg)


def test_missing_nlu_artifacts_raise(tmp_path):
    with pytest.raises(EncoderUnavailableError):
        IntentModel.load(tmp_path, tmp_path)
    (tmp_path / "manifest.json").write_text(json.dumps({"encoder": {"onnx": "nope.onnx", "tokenizer_dir": "x"}}))
    with pytest.raises(EncoderUnavailableError):
        IntentModel.load(tmp_path, tmp_path)


def test_missing_encoder_files_raise(tmp_path):
    with pytest.raises(EncoderUnavailableError):
        OnnxSentenceEncoder(tmp_path / "model.onnx", tmp_path)


def test_taxonomy_mismatch_rejected():
    manifest = {"taxonomy_version": "0.0.1", "classes": [], "model_version": "x"}
    with pytest.raises(EncoderUnavailableError):
        IntentModel(manifest, {}, encoder=None)


def test_build_pipeline_fails_closed_without_artifacts(tmp_path, monkeypatch):
    from bhashadrive.pipeline_v2 import build_v2_pipeline

    cfg = AppConfig()
    cfg.runtime.root = tmp_path
    with pytest.raises(EncoderUnavailableError):
        build_v2_pipeline(cfg, with_asr=False)


def test_sherpa_input_validation_without_model(tmp_path):
    asr = SherpaWhisperASR.__new__(SherpaWhisperASR)  # bypass model loading to test input guards
    asr.config = SherpaASRConfig()
    assert asr.transcribe_array(np.zeros(0, np.float32)).status == "no_audio"
    assert asr.transcribe_array(np.zeros(16000, np.float32)).status == "silence"
    assert asr.transcribe_array(np.ones(100, np.float32), 8000).status == "error"
    assert asr.transcribe_array(np.ones(16000 * 60, np.float32) * 0.1).status == "error"  # too long
    assert asr.transcribe_file(tmp_path / "missing.wav").status == "no_audio"
    (tmp_path / "junk.wav").write_bytes(b"not audio at all")
    assert asr.transcribe_file(tmp_path / "junk.wav").status == "error"


def test_sherpa_timeout_returns_error():
    import time
    from concurrent.futures import ThreadPoolExecutor

    asr = SherpaWhisperASR.__new__(SherpaWhisperASR)
    asr.config = SherpaASRConfig()
    asr.config.timeout_s = 0.05
    asr._pool = ThreadPoolExecutor(max_workers=1)
    asr._decode = lambda audio: time.sleep(0.5) or "late"
    r = asr.transcribe_array(np.random.default_rng(0).standard_normal(16000).astype(np.float32) * 0.1)
    assert r.status == "error" and "timeout" in r.error


def test_sherpa_multi_pass_returns_distinct_hypotheses():
    from concurrent.futures import ThreadPoolExecutor

    asr = SherpaWhisperASR.__new__(SherpaWhisperASR)
    asr.config = SherpaASRConfig()
    asr.config.languages = ("hi", "en", "ur")
    asr._pool = ThreadPoolExecutor(max_workers=1)
    noise = np.random.default_rng(0).standard_normal(16000).astype(np.float32) * 0.1
    asr._decode = lambda audio: ["", "Pause the music", "Pause the music"]
    r = asr.transcribe_array(noise)
    assert r.status == "ok" and r.text == "Pause the music" and r.language == "en"
    assert r.hypotheses == ["Pause the music"]
    asr._decode = lambda audio: ["Music", "Music ko pause kar do", "Music ko pause karo"]  # first pass cut short
    r = asr.transcribe_array(noise)
    assert r.text == "Music ko pause kar do" and r.hypotheses == ["Music ko pause kar do", "Music ko pause karo"]
    asr._decode = lambda audio: ["", "", ""]
    assert asr.transcribe_array(noise).status == "silence"
    # A second model's passes follow the primary's, labelled with the same languages.
    asr.config.languages, asr.extra_models = ("hi", "en"), [object()]
    asr._decode = lambda audio: ["", "", "Pause the music please.", "Pause the music please"]
    r = asr.transcribe_array(noise)
    assert r.language == "hi" and r.hypotheses == ["Pause the music please.", "Pause the music please"]


def test_whisper_features_and_loop_filter():
    from bhashadrive.audio.whisper_onnx import _repetitive, log_mel, mel_filters

    f = mel_filters(128)
    assert f.shape == (128, 201) and np.all(f >= 0) and np.all(f.sum(axis=1) > 0)
    tone = np.sin(2 * np.pi * 440 * np.arange(16000) / 16000).astype(np.float32)
    mel = log_mel(tone, f)
    assert mel.shape == (100, 128) and np.isfinite(mel).all()  # 10 ms hop
    assert _repetitive("वह वावम " + "द " * 30) and not _repetitive("Music ko pause kar do.")


@pytest.mark.integration
def test_whisper_onnx_decodes_both_languages_from_one_encoder_pass():
    from bhashadrive.audio.preprocessing import decode_file, preprocess
    from bhashadrive.audio.whisper_onnx import WhisperOnnx

    root = Path(__file__).resolve().parents[2]
    w = WhisperOnnx(root / "models" / "asr" / "hi-hinglish-apex", threads=4)
    hi, en = w.transcribe(preprocess(decode_file(root / "samples" / "tts" / "s08_set_temp_en.wav")), ["hi", "en"])
    assert "cabin" in hi.lower() and en.lower().startswith("set the cabin")


def test_taxonomy_version_constant():
    assert TAXONOMY_VERSION.count(".") == 2
