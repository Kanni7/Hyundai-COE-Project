from fastapi.testclient import TestClient

from bhashadrive.api.server import create_app
from bhashadrive.audio.asr import MockASR
from bhashadrive.config import AppConfig

from .fakes_v2 import make_pipeline


def test_v2_api_text_audio_personal_reset():
    pipe = make_pipeline()
    pipe.asr = MockASR("pause the music")
    c = TestClient(create_app(AppConfig(), pipe))
    assert "fake" in c.get("/health").json()["nlu"]
    j = c.post("/text", json={"text": "volume badha do"}).json()
    assert j["decision"] == "execute" and c.get("/state").json()["vehicle"]["volume"] == 12
    j = c.post("/audio", files={"file": ("a.wav", b"RIFF0000", "audio/wav")}).json()
    assert j["action"]["intent"] == "media_pause"
    c.post("/text", json={"text": "When I say 'party time', turn the volume up."})
    c.post("/text", json={"text": "yes"})
    assert [p["trigger"] for p in c.get("/personal").json()] == ["party time"]
    assert c.post("/reset").json() == {"ok": True}


def test_v2_api_prefix_transcribe_and_frontend(tmp_path):
    (tmp_path / "index.html").write_text("<title>Verna cockpit</title>", encoding="utf-8")
    pipe = make_pipeline()
    pipe.asr = MockASR("agla gaana")
    c = TestClient(create_app(AppConfig(), pipe, frontend_dir=tmp_path))
    h = c.get("/api/health").json()
    assert h["mock"] is True and h["asr_ready"] is True
    assert c.post("/api/text", json={"text": "volume badha do"}).json()["decision"] == "execute"
    t = c.post("/api/transcribe", files={"file": ("a.webm", b"x", "audio/webm")}).json()
    assert t["text"] == "agla gaana" and t["status"] == "ok"
    assert "Verna cockpit" in c.get("/").text
    assert "BhashaDrive" in c.get("/console").text


def test_root_redirects_to_console_without_frontend_build(tmp_path):
    c = TestClient(create_app(AppConfig(), make_pipeline(), frontend_dir=tmp_path))
    assert "BhashaDrive" in c.get("/").text
