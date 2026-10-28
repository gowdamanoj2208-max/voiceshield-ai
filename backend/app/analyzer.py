import re
from typing import Any

RULES: list[dict[str, Any]] = [
    {
        "id": "sensitive_info",
        "label": "Sensitive information request",
        "score": 30,
        "patterns": [r"\botp\b", r"one[- ]time (?:password|code)", r"\bpin\b", r"password", r"card number", r"bank details", r"verify your identity", r"read me the (?:code|number)"],
    },
    {
        "id": "urgency",
        "label": "Urgency & intimidation",
        "score": 18,
        "patterns": [r"act now", r"immediately", r"right away", r"urgent", r"final warning", r"arrest", r"account.{0,24}(?:suspend|freeze|compromis)", r"do not tell", r"keep this (?:secret|private)"],
    },
    {
        "id": "impersonation",
        "label": "Authority impersonation",
        "score": 20,
        "patterns": [r"police", r"officer", r"government", r"national fraud", r"tax department", r"security department", r"from your bank", r"customer support", r"technical support"],
    },
    {
        "id": "payment",
        "label": "Suspicious payment request",
        "score": 24,
        "patterns": [r"transfer (?:your )?funds", r"wire (?:the )?money", r"gift cards?", r"crypto(?:currency)?", r"safe wallet", r"pay (?:the )?\$?\d", r"money transfer"],
    },
    {
        "id": "remote_access",
        "label": "Remote-access or suspicious link",
        "score": 24,
        "patterns": [r"install.{0,30}(?:anydesk|teamviewer|remote access|app)", r"download.{0,30}(?:anydesk|teamviewer|app)", r"remote access", r"click (?:this )?link", r"screen[- ]?sharing", r"anydesk|teamviewer"],
    },
    {
        "id": "pressure",
        "label": "Fear, pressure or secrecy",
        "score": 12,
        "patterns": [r"safe account", r"safe wallet", r"compromised", r"virus", r"lose access", r"avoid (?:data loss|arrest|suspension)", r"do not (?:hang up|tell|disconnect)"],
    },
]
PHRASE_PATTERNS = [
    r"\b(?:otp|one-time code|pin|password|card number)\b",
    r"\b(?:act now|immediately|right away|urgent|final warning)\b",
    r"\b(?:police|officer|government|national fraud|technical support|security department)\b",
    r"\b(?:transfer your funds|safe wallet|gift cards?|crypto|wire the money)\b",
    r"\b(?:anydesk|teamviewer|remote access|click this link)\b",
    r"\b(?:do not tell|keep this secret|compromised|arrest)\b",
]
CAVEAT = (
    "Prototype estimate from text patterns only—not definitive proof of fraud. "
    "Tone, accent, pitch, and emotional state are not used to identify callers."
)


def analyze_transcript(transcript: str) -> dict[str, Any]:
    text = transcript.strip()
    found = [rule for rule in RULES if any(re.search(p, text, re.IGNORECASE) for p in rule["patterns"])]
    score = min(98, sum(rule["score"] for rule in found))
    level = "Critical" if score >= 85 else "High" if score >= 65 else "Medium" if score >= 35 else "Low"
    phrases: list[str] = []
    for pattern in PHRASE_PATTERNS:
        phrases.extend(re.findall(pattern, text, flags=re.IGNORECASE))
    suspicious_phrases = list(dict.fromkeys(phrase.strip() for phrase in phrases))[:8]

    if found:
        explanation = (
            "Several high-risk patterns overlap: the conversation includes "
            if score >= 65
            else "Some caution flags appear: the conversation includes "
        ) + ", ".join(rule["label"].lower() for rule in found) + ". These language signals are not proof of identity or intent."
    else:
        explanation = "Few known scam indicators were found in this excerpt. A short text excerpt cannot establish that a call is safe."

    if score >= 65:
        action = (
            "End the conversation without sharing information. Verify the claim through an independently sourced official number, "
            "then have a human review this incident."
        )
    elif score >= 35:
        action = "Do not share codes or payment details. Pause and independently verify through a trusted contact channel."
    else:
        action = "Continue cautiously. Never share authentication codes, passwords, or payment details on an unsolicited call."

    return {
        "risk_score": score,
        "risk_level": level,
        "detected_indicators": [rule["label"] for rule in found],
        "suspicious_phrases": suspicious_phrases,
        "explanation": explanation,
        "recommended_action": action,
        "confidence": min(94, 64 + len(found) * 5),
        "mode": "rule-based demo",
        "caveat": CAVEAT,
    }

