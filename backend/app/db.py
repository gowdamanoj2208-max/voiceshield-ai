from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(os.getenv("VOICESHIELD_DB_PATH", Path(__file__).resolve().parents[1] / "voiceshield.db"))


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS calls (
                session_id TEXT PRIMARY KEY,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                duration_seconds INTEGER,
                transcript TEXT NOT NULL DEFAULT '',
                analysis_json TEXT,
                status TEXT NOT NULL DEFAULT 'active'
            );
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                call_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                score INTEGER NOT NULL,
                level TEXT NOT NULL,
                patterns_json TEXT NOT NULL,
                excerpt TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Prepared for review/submission',
                reviewed INTEGER NOT NULL DEFAULT 0
            );
            """
        )


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def row_to_call(row: sqlite3.Row) -> dict[str, Any]:
    duration = row["duration_seconds"]
    return {
        "id": row["session_id"],
        "session_id": row["session_id"],
        "time": row["started_at"],
        "date": row["started_at"][:10],
        "caller": "Unknown · fictional demo caller",
        "duration_seconds": duration or 0,
        "duration": f"{(duration or 0) // 60:02}:{(duration or 0) % 60:02}",
        "transcript": row["transcript"],
        "status": row["status"],
        "analysis": json.loads(row["analysis_json"]) if row["analysis_json"] else None,
        "score": (json.loads(row["analysis_json"]) if row["analysis_json"] else {}).get("risk_score", 0),
        "level": (json.loads(row["analysis_json"]) if row["analysis_json"] else {}).get("risk_level", "Low"),
    }


def row_to_report(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "call_id": row["call_id"],
        "created_at": row["created_at"],
        "score": row["score"],
        "level": row["level"],
        "patterns": json.loads(row["patterns_json"]),
        "excerpt": row["excerpt"],
        "status": row["status"],
        "reviewed": bool(row["reviewed"]),
    }

