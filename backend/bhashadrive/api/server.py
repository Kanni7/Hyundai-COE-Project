"""Local HTTP API, the Verna cockpit frontend and a minimal test console. Binds to 127.0.0.1 by default.

Every API route is served both at the root (test console, scripts) and under /api (cockpit frontend).
"""
from __future__ import annotations

import tempfile
import threading
from pathlib import Path

from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ..config import FRONTEND_DIST, AppConfig

STATIC = Path(__file__).with_name("static")
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


class TextIn(BaseModel):
    text: str = Field(max_length=500)


class ConnectivityIn(BaseModel):
    offline: bool


def create_app(config: AppConfig | None = None, pipeline=None, legacy: bool = False, mock: bool = False,
               frontend_dir: Path | None = FRONTEND_DIST) -> FastAPI:
    config = config or AppConfig()
    if pipeline is None:
        if mock:
            from ..audio.asr import MockASR
            from ..tests.fakes_v2 import make_pipeline

            pipeline = make_pipeline()
            pipeline.asr = MockASR("pause the music")
        elif legacy:  # V1 dev-only benchmark path
            from ..pipeline import build_default_pipeline

            pipeline = build_default_pipeline(config, with_asr=True)
        else:
            try:
                from ..pipeline_v2 import build_v2_pipeline

                pipeline = build_v2_pipeline(config, with_asr=True)
            except Exception as e:
                import sys
                print(f"[NOTE] Model weights not found ({e}). Falling back to mock pipeline for test console.", file=sys.stderr)
                from ..audio.asr import MockASR
                from ..tests.fakes_v2 import make_pipeline

                pipeline = make_pipeline()
                try:
                    from ..audio.hybrid_asr import HybridASR
                    pipeline.asr = HybridASR(config)
                    print(f"[OK] HybridASR initialized: {pipeline.asr.name}")
                except Exception as asr_err:
                    print(f"[NOTE] HybridASR init error: {asr_err}")
                    pipeline.asr = None
    is_v2 = hasattr(pipeline, "model")
    lock = threading.Lock()  # one conversation, processed sequentially
    app = FastAPI(title="BhashaDrive (local prototype)", docs_url="/docs")
    api = APIRouter()

    @app.get("/console", response_class=HTMLResponse)
    def console():
        return (STATIC / "index.html").read_text(encoding="utf-8")

    @api.get("/health")
    def health():
        nlu = pipeline.model.version if is_v2 else getattr(pipeline.parser, "name", "?")
        return {"nlu": nlu, "asr": getattr(pipeline.asr, "name", None),
                "asr_ready": pipeline.asr is not None and getattr(pipeline.asr, "ready", True),
                "vehicle": pipeline.vehicle.name, "mock": str(nlu).startswith("fake")}

    @api.post("/text")
    def text(body: TextIn):
        with lock:
            res = pipeline.process_text(body.text)
            from ..nlu.normalizer import to_english
            if getattr(res, "transcript", None):
                res.transcript = to_english(res.transcript)
            print(f"[API /text] input='{body.text}' -> intent='{getattr(res, 'intent', None)}' decision='{getattr(res, 'decision', None)}'")
            return res.model_dump(mode="json")

    async def _upload(file: UploadFile, d: str) -> tuple[Path, bytes]:
        if pipeline.asr is None:
            raise HTTPException(503, "Speech recognition not loaded")
        data = await file.read()
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "Audio too large")
        suffix = Path(file.filename or "audio.webm").suffix or ".webm"
        p = Path(d) / f"upload{suffix}"
        p.write_bytes(data)
        return p, data

    @api.post("/transcribe")
    async def transcribe(file: UploadFile = File(...)):
        """Speech to text only. The cockpit routes the transcript itself (backend or local parser)."""
        with tempfile.TemporaryDirectory() as d:
            p, _ = await _upload(file, d)
            with lock:
                res = pipeline.asr.transcribe_file(p)
        print(f"[API /transcribe] status={res.status} text='{res.text}'")
        return {"text": res.text or "", "status": res.status, "error": res.error,
                "engine": getattr(pipeline.asr, "name", None)}

    @api.post("/audio")
    async def audio(file: UploadFile = File(...)):
        with tempfile.TemporaryDirectory() as d:  # deleted immediately unless BD_STORE_AUDIO is enabled
            p, data = await _upload(file, d)
            with lock:
                result = pipeline.process_audio_file(p)
                from ..nlu.normalizer import to_english
                if getattr(result, "transcript", None):
                    result.transcript = to_english(result.transcript)
                if getattr(result, "normalized_transcript", None):
                    result.normalized_transcript = to_english(result.normalized_transcript)
                asr_res = getattr(result, "asr", None)
                raw_text = (getattr(asr_res, "raw_text", None) or getattr(asr_res, "text", "")) if asr_res else ""
                print(f"[API /audio] {len(data)} bytes ({file.filename}) -> raw='{raw_text}' -> english='{result.transcript}' -> intent='{getattr(result, 'intent', None)}' decision='{getattr(result, 'decision', None)}'")
            if config.store_audio:
                config.audio_store_dir.mkdir(parents=True, exist_ok=True)
                (config.audio_store_dir / p.name).write_bytes(data)
        return result.model_dump(mode="json")

    @api.get("/state")
    def state():
        if is_v2:
            pend = pipeline.state.pending
            return {"vehicle": pipeline.vehicle.get_state(),
                    "context": {"pending": pend.kind if pend else None, "history": list(pipeline.state.history)}}
        return {"vehicle": pipeline.vehicle.get_state(), "context": pipeline.context.summary()}

    @api.get("/personal")
    def personal():
        if not is_v2 or pipeline.store is None:
            return []
        return [{"id": c.id, "trigger": c.trigger, "phrases": c.phrases, "action": c.action.model_dump(mode="json"),
                 "updated_at": c.updated_at} for c in pipeline.store.list_commands(pipeline.profile_id)]

    @api.get("/connectivity")
    def get_connectivity():
        if hasattr(pipeline.asr, "get_status"):
            return pipeline.asr.get_status()
        return {"is_offline": False, "active_engine": getattr(pipeline.asr, "name", "unknown")}

    @api.post("/connectivity")
    def set_connectivity(body: ConnectivityIn):
        if hasattr(pipeline.asr, "set_offline_mode"):
            pipeline.asr.set_offline_mode(body.offline)
            return pipeline.asr.get_status()
        return {"is_offline": body.offline, "note": "ASR engine does not support dynamic toggle"}

    @api.post("/reset")
    def reset():
        if is_v2:
            pipeline.reset()
        else:
            pipeline.context.reset()
        if hasattr(pipeline.vehicle, "reset"):
            pipeline.vehicle.reset()
        return {"ok": True}

    app.include_router(api)
    app.include_router(api, prefix="/api")
    if frontend_dir is not None and (frontend_dir / "index.html").is_file():
        app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")  # after the API routes
    else:
        @app.get("/", include_in_schema=False)
        def index():
            return RedirectResponse("/console")

    return app


def run(config: AppConfig | None = None, host: str | None = None, port: int | None = None, legacy: bool = False, mock: bool = False) -> None:
    import uvicorn

    config = config or AppConfig()
    uvicorn.run(create_app(config, legacy=legacy, mock=mock), host=host or config.api_host, port=port or config.api_port)
