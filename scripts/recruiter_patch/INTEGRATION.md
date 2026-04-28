# Recruiter integration

Two changes to `/opt/adex-recruiter/interactive_recruiter.py`.

## 1. Import the gate

```python
from sms_gate import should_reply, classify_auto_reply, mark_opt_out
```

## 2. Wire it into the inbound handler

Find the function that receives an inbound SMS and decides whether to reply
(usually the Twilio webhook handler or the message-processing loop).
At the top of that function — *before* any LLM call or outbound SMS — add:

```python
def handle_inbound_sms(from_number: str, body: str) -> None:
    # Hard stop: opt-out / do-not-text already flagged
    if not should_reply(from_number):
        logger.info("Skipping reply: %s is opted out", from_number)
        return

    # Detect auto-responders and opt them out so we never spend money
    # on this number again.
    verdict = classify_auto_reply(body)
    if verdict["is_auto"]:
        logger.warning(
            "Auto-reply detected from %s (score=%d). Opting out.",
            from_number, verdict["score"],
        )
        mark_opt_out(from_number, reason="auto_reply")
        return

    # ...existing logic: build prompt, call Gemma, send reply...
```

## 3. Also gate the outbound send (defense in depth)

Wherever the recruiter calls `twilio_client.messages.create(...)`, wrap it:

```python
if not should_reply(to_number):
    logger.info("Outbound suppressed: %s is opted out", to_number)
    return
twilio_client.messages.create(to=to_number, body=reply_text, ...)
```

This catches the case where a queued reply was generated *before* the
contact was opted out.

## 4. Required env

`SUPABASE_DB_URL` — Postgres connection string for the Supabase instance
(use the connection pooler URL from the Supabase dashboard, not the public
HTTP API).

## 5. Sanity check after deploy

```bash
# Should return False for any number that has sms_opt_out = true
python -c "from sms_gate import should_reply; print(should_reply('+15555550123'))"
```
