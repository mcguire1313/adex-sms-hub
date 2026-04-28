"""
SMS gate for the interactive recruiter.

Two responsibilities:
  1. should_reply(phone) -> bool
       Returns False if the contact has opted out (sms_opt_out) or is otherwise
       marked do-not-text. The recruiter must call this before generating a reply.
  2. classify_auto_reply(body) -> dict
       Mirrors the JS classifier in lib/autoReply.js. If the *inbound* message
       looks like an auto-responder, the recruiter should NOT reply, AND should
       persist sms_opt_out=true so future inbound noise from the same number is
       short-circuited at the webhook.

Drop this file at /opt/adex-recruiter/sms_gate.py and import from
interactive_recruiter.py.
"""
import os
import re

from supabase import create_client


STRONG_PATTERNS = [
    r"\b(not|isn'?t|aren'?t)\s+monitored\b",
    r"\bdo\s+not\s+(reply|respond)\b",
    r"\bthis\s+(number|line|inbox|mailbox)\s+is\s+(not|un)\s*monitored\b",
    r"\btext\s+messages?\s+are\s+not\s+(monitored|read|checked)\b",
    r"\bautomated\s+(reply|response|message|system)\b",
    r"\bauto[-\s]?reply\b",
    r"\bunable\s+to\s+(read|respond|reply)\s+to\s+(text|sms)",
    r"\bsorry,?\s+i\s+(do(n'?| no)t|cannot|can'?t)\s+understand\b",
    r"\bi\s+(do(n'?| no)t|cannot|can'?t)\s+understand\s+your\s+(message|text|request)\b",
    r"\bcall\s+9\s*1\s*1\b.*\bemergency\b",
    r"\bemergency\b.*\bcall\s+9\s*1\s*1\b",
]
WEAK_PATTERNS = [
    r"\bthank\s+you\s+for\s+(contacting|reaching\s+out|your\s+message)\b",
    r"\boffice\s+hours\b",
    r"\bnext\s+business\s+day\b",
    r"\bnon[-\s]?urgent\b",
    r"\bfor\s+urgent\s+(matters|needs|issues|inquiries)\b",
    r"\bplease\s+call\s+(your|our|the)\s+(clinic|office|pharmacy|practice)\b",
    r"\bduring\s+(normal\s+)?business\s+hours\b",
    r"\bvisit\s+(our|the)\s+website\b",
    r"\b(life[-\s]?threatening)\s+emergency\b",
]
_STRONG = [re.compile(p, re.I) for p in STRONG_PATTERNS]
_WEAK = [re.compile(p, re.I) for p in WEAK_PATTERNS]


def classify_auto_reply(body: str) -> dict:
    if not isinstance(body, str) or len(body) < 12:
        return {"is_auto": False, "score": 0}
    score = sum(2 for r in _STRONG if r.search(body)) + sum(1 for r in _WEAK if r.search(body))
    return {"is_auto": score >= 2, "score": score}


def _strip_country(phone: str) -> str:
    if not phone:
        return ""
    if phone.startswith("+1"):
        return phone[2:]
    if phone.startswith("+"):
        return phone[1:]
    return phone


_client = None


def _supabase():
    global _client
    if _client is None:
        _client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    return _client


def should_reply(phone: str) -> bool:
    """Return True only if it's safe to send an outbound SMS to this contact."""
    clean = _strip_country(phone)
    res = (
        _supabase()
        .table("clinicians")
        .select("sms_opt_out,do_not_text")
        .eq("phone", clean)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return True
    row = rows[0]
    if row.get("sms_opt_out"):
        return False
    if row.get("do_not_text"):
        return False
    return True


def mark_opt_out(phone: str, reason: str) -> None:
    """Flip sms_opt_out=true for a contact. Call when an auto-reply is detected."""
    clean = _strip_country(phone)
    from datetime import datetime, timezone
    (
        _supabase()
        .table("clinicians")
        .update({
            "sms_opt_out": True,
            "sms_opt_out_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("phone", clean)
        .execute()
    )
    # Caller should also log `reason` to its observability layer.
