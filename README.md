# VoiceShield AI — Live Voice Fraud Neutralizer

A responsive cybersecurity dashboard prototype for exploring call-pattern analysis, social-engineering signals, a safely isolated honeypot simulation, and incident preparation. **VoiceShield is a college hackathon prototype—not a telephony product or definitive fraud detector.**

## Features

- React + Vite dashboard with Overview, Live monitoring, AI analysis, Honeypot lab, Incident reports, and Settings & privacy.
- Context-aware rule-based transcript analysis with risk score, classification, warning phrases, indicators, confidence, explanation, and safe next steps.
- Fictional demo call sessions with live simulated transcript lines, pause/resume/end controls, a waveform and risk gauge.
- Isolated honeypot conversation using harmless, generic responses and fictional information. It has no phone, caller, payment, or external-system connection.
- SQLite-backed FastAPI endpoints for simulated calls and incidents; browser local storage keeps the frontend demo usable without the backend.
- Report review status, CSV export, and a print dialog that can save a report as PDF.
- Human-review and privacy prompts throughout; no law-enforcement submission, automatic blocking, or real-call interception.

## Requirements

- Windows 10/11
- Node.js 20+ and npm
- Python 3.11+ (Python 3.12 recommended)

## Run in VS Code on Windows

Open the `voiceshield-ai` folder in VS Code. Open two PowerShell terminals in that folder.

### Terminal 1 — FastAPI backend

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell blocks virtual-environment activation, use the environment's Python directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The SQLite database is created automatically at `backend/voiceshield.db` on first API use. To use a different local Python launcher, replace `py -3` with its installed version (e.g. `py -3.12`).

### Terminal 2 — React frontend

```powershell
npm install
npm run dev
```

Open the printed local URL (normally `http://127.0.0.1:5173`). The Vite development server proxies `/api` requests to FastAPI at `http://127.0.0.1:8000`.

### Run without a backend

The frontend still works in local demo mode: skip Terminal 1 and run the frontend. Calls, reports, settings, and simulation messages use browser `localStorage`. A small “Local demo” indicator shows the backend is offline. Starting FastAPI later enables SQLite API persistence.

## Optional AI provider

The transparent local rule-based analyzer is the default. The API reports whether an optional provider is configured but does not require one. `.env.example` deliberately contains no credentials. Provider values, when configured, belong only in `backend/.env` and must never be placed in a Vite `VITE_*` variable or committed.

- `ZAI_API_KEY`: optional server-side provider key.
- `ZAI_API_BASE`: optional OpenAI-compatible API base URL.

When both values are configured, transcript analysis can call the OpenAI-compatible provider from FastAPI using `ZAI_MODEL` (optional; defaults to `glm-4-flash`). The key stays server-side; provider timeouts, invalid responses, or unavailable credentials fall back to the local rule-based analyzer. Without credentials, no external AI request is made. Provider-backed results are estimates and should be reviewed. Never upload private call audio or transcripts without informed consent.

## API

FastAPI interactive docs are at `http://127.0.0.1:8000/docs` while the server is running.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Backend/demo status; audio capture is not enabled. |
| POST | `/api/analyze` | Analyze `{ "transcript": "..." }` (max 20,000 characters). |
| POST | `/api/demo-call/start` | Create a fictional simulated call session. |
| POST | `/api/demo-call/end` | End a session and analyze the supplied transcript. |
| GET | `/api/calls` | Retrieve call history; supports `risk_level`, `search`, and `limit` query parameters. |
| GET | `/api/reports` | Retrieve saved incident reports. |
| POST | `/api/reports` | Prepare a report; excerpts are sanitized and capped. |
| PATCH | `/api/reports/{id}/review` | Mark a report as reviewed by the user. |
| DELETE | `/api/reports/{id}` | Delete a report. |
| POST | `/api/demo-data/reset` | Clear the local demo calls and reports. |

## Demo behavior and limitations

- Seeded dashboard counters and initial call rows are illustrative demo data. They are not live telemetry.
- The analyzer uses inspectable language-pattern rules, not voice biometrics or a validated production fraud model. Scores are prototype estimates, not proof of fraud; short transcripts can omit context.
- Emotion, accent, pitch, and tone never independently identify or classify a caller. Emotion is not currently collected.
- “Start demo call” creates a fictional local simulation; its transcript is sample text, not microphone or carrier audio.
- The optional microphone button asks for explicit browser permission only. It immediately stops the test stream; it does not record, transcribe, or upload audio.
- The honeypot only displays fictional chat in this page. It cannot contact callers, use real identities, reveal user data, make payments, or connect to phone systems.
- Reports are **prepared for review/submission only**. Exports are local; nothing is sent to law enforcement or another party. A human must review before any real-world action.
- Live telephony, carrier integrations, production AI, identity verification, cloud sync, and real incident submission are not implemented.
- Backend SQLite records live in `backend/voiceshield.db`; frontend-only fallback data lives in the browser's local storage. The settings “Reset demo data” control clears both local demo records and, when reachable, the API database.

## Safety and privacy

Use fictional data for the prototype. Do not covertly intercept calls, bypass operating-system/carrier restrictions, upload private recordings without consent, automatically accuse/block/report people, or rely on a risk score without human review. Verify suspicious claims through independently sourced official contact details. The demo does not access call audio or record in the background.

