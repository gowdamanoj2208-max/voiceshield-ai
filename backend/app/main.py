from __future__ import annotations

import json
import os
import re
import secrets
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator

from . import db
from .ai_provider import analyze_with_optional_provider

load_dotenv()
app = FastAPI(title="VoiceShield AI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://127.0.0.1:5173"), "http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    transcript: str = Field(min_length=1, max_length=20_000)

    @field_validator("transcript")
    @classmethod
    def transcript_must_have_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Transcript cannot be blank")
        return value


class EndCallRequest(BaseModel):
    session_id: str = Field(min_length=3, max_length=80)
    transcript: str = Field(default="", max_length=20_000)


class ReportCreate(BaseModel):
    id: str | None = Field(default=None, min_length=3, max_length=80)
    call_id: str = Field(min_length=3, max_length=80)
    created_at: str | None = Field(default=None, max_length=80)
    score: int = Field(ge=0, le=100)
    level: str = Field(pattern=r"^(Low|Medium|High|Critical)$")
    patterns: list[str] = Field(default_factory=list, max_length=20)
    excerpt: str = Field(default="", max_length=500)
    status: str = Field(default="Prepared for review/submission", max_length=100)


@app.on_event("startup")
def startup() -> None:
    db.init_db()


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "mode": "demo",
        "ai_provider_configured": bool(os.getenv("ZAI_API_KEY") and os.getenv("ZAI_API_BASE")),
        "audio_capture": "not enabled",
    }


@app.post("/api/analyze")
def analyze(payload: AnalyzeRequest) -> dict[str, Any]:
    """Score user-provided transcript text with the transparent prototype rules."""
    try:
        result = analyze_with_optional_provider(payload.transcript)
        result["sanitized_transcript"] = sanitize_transcript(payload.transcript)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Transcript analysis failed") from exc


def sanitize_transcript(text: str) -> str:
    """Redact common phone, email, and long digit patterns in report excerpts."""
    sanitized = re.sub(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b", "[email redacted]", text)
    sanitized = re.sub(r"(?<!\w)(?:\+?\d[\d ().-]{7,}\d)(?!\w)", "[phone redacted]", sanitized)
    sanitized = re.sub(r"\b\d{6,}\b", "[number redacted]", sanitized)
    return sanitized[:500]


@app.post("/api/demo-call/start")
def start_demo_call() -> dict[str, Any]:
    session_id = f"CALL-{secrets.token_hex(5).upper()}"
    started_at = db.utc_now()
    with db.connect() as conn:
        conn.execute(
            "INSERT INTO calls(session_id, started_at, status) VALUES (?, ?, ?)",
            (session_id, started_at, "active"),
        )
    return {"session_id": session_id, "started_at": started_at, "status": "active", "fictional": True}


@app.post("/api/demo-call/end")
def end_demo_call(payload: EndCallRequest) -> dict[str, Any]:
    ended_at = db.utc_now()
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM calls WHERE session_id = ?", (payload.session_id,)).fetchone()
        if row is None:
            # Local browser demos can be restored even when the server has no session.
            started_at = ended_at
            analysis = analyze_with_optional_provider(payload.transcript) if payload.transcript.strip() else None
            conn.execute(
                "INSERT INTO calls(session_id, started_at, ended_at, duration_seconds, transcript, analysis_json, status) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (payload.session_id, started_at, ended_at, 0, payload.transcript, json.dumps(analysis) if analysis else None, "completed"),
            )
            return {"session_id": payload.session_id, "status": "completed", "duration_seconds": 0, "analysis": analysis}
        started = datetime.fromisoformat(row["started_at"])
        duration = max(0, int((datetime.now(timezone.utc) - started).total_seconds()))
        transcript = payload.transcript or row["transcript"]
        analysis = analyze_with_optional_provider(transcript) if transcript.strip() else None
        conn.execute(
            "UPDATE calls SET ended_at = ?, duration_seconds = ?, transcript = ?, analysis_json = ?, status = ? WHERE session_id = ?",
            (ended_at, duration, transcript, json.dumps(analysis) if analysis else None, "completed", payload.session_id),
        )
    return {"session_id": payload.session_id, "status": "completed", "duration_seconds": duration, "analysis": analysis}


@app.get("/api/calls")
def get_calls(
    risk_level: str | None = Query(default=None, pattern=r"^(Low|Medium|High|Critical)$"),
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    with db.connect() as conn:
        rows = conn.execute("SELECT * FROM calls WHERE status != 'active' ORDER BY started_at DESC LIMIT ?", (limit,)).fetchall()
    calls = [db.row_to_call(row) for row in rows]
    if risk_level:
        calls = [call for call in calls if call["level"] == risk_level]
    if search:
        needle = search.casefold()
        calls = [call for call in calls if needle in f"{call['id']} {call['caller']} {call['status']}".casefold()]
    return {"calls": calls, "total": len(calls)}


@app.get("/api/reports")
def get_reports() -> dict[str, Any]:
    with db.connect() as conn:
        rows = conn.execute("SELECT * FROM reports ORDER BY created_at DESC LIMIT 500").fetchall()
    reports = [db.row_to_report(row) for row in rows]
    return {"reports": reports, "total": len(reports)}


@app.post("/api/reports")
def create_report(payload: ReportCreate) -> dict[str, Any]:
    report_id = payload.id or f"INC-{secrets.token_hex(4).upper()}"
    created_at = payload.created_at or db.utc_now()
    excerpt = sanitize_transcript(payload.excerpt)
    with db.connect() as conn:
        conn.execute(
            "INSERT INTO reports(id, call_id, created_at, score, level, patterns_json, excerpt, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (report_id, payload.call_id, created_at, payload.score, payload.level, json.dumps(payload.patterns), excerpt, "Prepared for review/submission"),
        )
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
    return db.row_to_report(row)


@app.patch("/api/reports/{report_id}/review")
def mark_report_reviewed(report_id: str = Path(min_length=3, max_length=80)) -> dict[str, Any]:
    with db.connect() as conn:
        result = conn.execute("UPDATE reports SET reviewed = 1 WHERE id = ?", (report_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Report not found")
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
    return db.row_to_report(row)


@app.delete("/api/reports/{report_id}")
def delete_report(report_id: str = Path(min_length=3, max_length=80)) -> dict[str, Any]:
    with db.connect() as conn:
        result = conn.execute("DELETE FROM reports WHERE id = ?", (report_id,))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"deleted": True, "id": report_id}


@app.post("/api/demo-data/reset")
def reset_demo_data() -> dict[str, bool]:
    with db.connect() as conn:
        conn.execute("DELETE FROM reports")
        conn.execute("DELETE FROM calls")
    return {"reset": True}

