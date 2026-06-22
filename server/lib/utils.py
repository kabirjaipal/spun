from datetime import datetime, timezone

# lib/utils.py

def get_utc_now() -> datetime:
    """Returns the current datetime in UTC timezone."""
    return datetime.now(timezone.utc)
