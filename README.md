# Verna Smart Cockpit + BhashaDrive

One app built from two repos:

| folder | from | what it is |
|---|---|---|
| `frontend/` | [Hyundai-Car-Frontend](https://github.com/Kanni7/Hyundai-Car-Frontend) | React/Vite Verna cockpit you drive by voice (English, Hindi, Hinglish) |
| `backend/` | [HyundaiCOE](https://github.com/Kanni7/HyundaiCOE) | BhashaDrive: FastAPI voice-NLU engine (intent model, negation, confirmations, personal shortcuts, ASR) |

The backend serves the built cockpit at `/` and its API under `/api`. The old test console is at `/console` and the API docs are at `/docs`.

## Run it

Requirements: Python 3.10+ and Node 20+.

```powershell
powershell -ExecutionPolicy Bypass -File start.ps1      # Windows
./start.sh                                              # Linux / macOS
```

Then open http://127.0.0.1:8000. On the first run the script creates `backend/.venv`, installs `backend/requirements-app.txt` and builds the frontend. Pass `-Rebuild` (or `--rebuild`) after you change frontend code.

To work on the frontend with hot reload, run both parts:

```bash
cd backend  && .venv/Scripts/python -m bhashadrive.cli serve     # API on :8000 (Linux: .venv/bin/python)
cd frontend && npm run dev                                       # http://localhost:5173, proxies /api to :8000
```

## How the two parts work together

```
voice (Web Speech API, or mic → /api/transcribe → Whisper) ─┐
typed text / chips ─────────────────────────────────────────┴─▶ local parser (frontend/src/nlu/parser.ts)
                                                                    │
       compound command, or anything outside the backend's domain ──┤──▶ local intents
       (lights, gears, windows, moods, questions...)                │
                                                                    ▼
       single climate / fan / volume / media / navigation command, ──▶ POST /api/text (BhashaDrive)
       or anything the local parser did not understand                 execute → mapped to a cockpit intent
                                                                       ask / clarify / reject / saved → spoken reply
                                                                       unsupported → local intents instead
                                                                    ▼
                                                        runIntents() → CarState → cockpit
```

- The routing is in `route()` in `frontend/src/App.tsx`. The client and the intent mapping are in `frontend/src/lib/backend.ts`.
- So the backend's safety rules apply to the car: "Don't turn the AC off" is refused. "Garmi lag rahi hai" asks *"Would you like me to make the cabin cooler?"* before it acts, and "haan" confirms. Personal shortcuts work too: "Jab main 'chill mode' bolun, AC 22 pe set kar dena".
- When both parsers agree, the cockpit keeps the local intent because it carries richer slots (genre, exact level, mute).
- The badge in the top bar shows which NLU is live. Each reply is tagged `BhashaDrive` or `local parser`.
- If the backend is down, the cockpit runs entirely in the browser as before. It checks again every 15 s.
- When the backend has a working speech recogniser (a local faster-whisper or sherpa-onnx model, or `OPENAI_API_KEY` / `GROQ_API_KEY`), a **Web / Server** switch appears next to `EN / हिं`. It chooses between browser recognition and backend recognition.
- Chrome's recogniser sends audio to Google. If that fails with `Speech error: network`, the cockpit switches to the backend's Whisper for the rest of the session and keeps listening. Server recording stops on its own after a short pause. To enable it, download the Whisper model once (~480 MB):

  ```bash
  cd backend && .venv/Scripts/python -c "from faster_whisper import WhisperModel; WhisperModel('small', compute_type='int8')"
  ```

## Mock vs trained NLU

Without trained model artifacts, the backend starts with its deterministic mock NLU, and the badge shows `(mock)`. To use the real V2 models (sherpa-onnx ASR, ONNX encoder and trained heads), install `backend/requirements.txt` and follow the download and training steps in [backend/README.md](backend/README.md). The cockpit needs no change.

## Tests

```bash
cd backend && .venv/Scripts/python -m pytest       # API tests include the /api, /transcribe and frontend-serving routes
cd frontend && npm run build && npm run lint
```

Six backend tests (`test_rescorer.py`, `test_snapping.py`) already fail in the upstream backend repo, independent of this merge. The rescorer tests need the encoder model.

See `frontend/README.md` for the cockpit's controls and command list.
