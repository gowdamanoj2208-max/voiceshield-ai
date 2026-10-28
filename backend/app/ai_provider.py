from __future__ import annotations

import json
import os
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

from .analyzer import analyze_transcript


def analyze_with_optional_provider(transcript: str) -> dict[str, Any]:
    """Use the configured OpenAI-compatible provider, or fall back to local rules."""
    api_key = os.getenv("ZAI_API_KEY")
    base_url = os.getenv("ZAI_API_BASE")
    if not api_key or not base_url:
        return analyze_transcript(transcript)

    fallback = analyze_transcript(transcript)
    try:
        client = OpenAI(api_key=api_key, base_url=base_url, timeout=12.0, max_retries=0)
        response = client.chat.completions.create(
            model=os.getenv("ZAI_MODEL", "glm-4-flash"),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Assess the supplied call transcript for possible social engineering, using only text context. "
                        "This is a prototype estimate, not proof of fraud. Never infer identity from or score tone, "
                        "accent, pitch, or emotion. Return only a JSON object with: risk_score (integer 0-100), "
                        "detected_indicators (array of short strings), suspicious_phrases (array quoting exact phrases "
                        "from the input), explanation (short string), recommended_action (safe human-verification steps), "
                        "confidence (integer 0-100). Do not include personal data not already present."
                    ),
                },
                {"role": "user", "content": transcript[:20_000]},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        content = response.choices[0].message.content
        parsed = json.loads(content or "{}")
        score = parsed.get("risk_score")
        if isinstance(score, bool) or not isinstance(score, (int, float)) or not 0 <= score <= 100:
            return fallback
        score = int(score)
        indicators = parsed.get("detected_indicators", [])
        phrases = parsed.get("suspicious_phrases", [])
        if not isinstance(indicators, list) or not isinstance(phrases, list):
            return fallback
        indicators = [str(item)[:100] for item in indicators[:12] if isinstance(item, str)]
        # Only return warning phrases that actually occur in the caller-provided text.
        phrases = [str(item)[:120] for item in phrases[:12] if isinstance(item, str) and item.casefold() in transcript.casefold()]
        explanation = parsed.get("explanation")
        action = parsed.get("recommended_action")
        confidence = parsed.get("confidence", 70)
        if not isinstance(explanation, str) or not isinstance(action, str):
            return fallback
        if isinstance(confidence, bool) or not isinstance(confidence, (int, float)):
            confidence = 70
        level = "Critical" if score >= 85 else "High" if score >= 65 else "Medium" if score >= 35 else "Low"
        return {
            "risk_score": score,
            "risk_level": level,
            "detected_indicators": indicators,
            "suspicious_phrases": phrases,
            "explanation": explanation[:1000],
            "recommended_action": action[:1000],
            "confidence": max(0, min(100, int(confidence))),
            "mode": "configured AI + text rules",
            "caveat": fallback["caveat"],
        }
    except Exception:
        # Keep analysis available during provider downtime; never expose upstream error details.
        return {**fallback, "mode": "rule-based fallback (AI provider unavailable)"}

