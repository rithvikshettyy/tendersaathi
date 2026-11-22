"""Verify Supabase (Google) login tokens by asking Supabase itself.

No JWT secret or service-role key needed: GET /auth/v1/user with the user's access token
returns the user if (and only if) the token is valid and unexpired.
"""
import os, time
import httpx

_CACHE: dict[str, tuple[float, dict]] = {}
_TTL = 60  # seconds


class SupabaseAuthError(Exception):
    pass


def looks_like_jwt(token: str) -> bool:
    return token.count(".") == 2


def verify(token: str) -> dict:
    """Returns {'email', 'name'} for a valid Supabase access token, else raises."""
    hit = _CACHE.get(token)
    if hit and hit[0] > time.time():
        return hit[1]
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_PUBLISHABLE_KEY")
    if not url or not key:
        raise SupabaseAuthError("Supabase is not configured on the server")
    try:
        r = httpx.get(f"{url.rstrip('/')}/auth/v1/user", timeout=10,
                      headers={"apikey": key, "Authorization": f"Bearer {token}"})
    except httpx.HTTPError as e:
        raise SupabaseAuthError(f"Supabase unreachable: {e}")
    if r.status_code != 200:
        raise SupabaseAuthError("Invalid or expired login")
    u = r.json()
    email = (u.get("email") or "").lower()
    # Only trust verified emails: Supabase also allows unverified email/password signups,
    # which must never be linked to someone else's company by address.
    if not email or not (u.get("email_confirmed_at") or u.get("confirmed_at")):
        raise SupabaseAuthError("Email not verified")
    meta = u.get("user_metadata") or {}
    info = {"email": email, "name": meta.get("full_name") or meta.get("name") or email.split("@")[0]}
    _CACHE[token] = (time.time() + _TTL, info)
    if len(_CACHE) > 500:
        _CACHE.clear()
    return info
