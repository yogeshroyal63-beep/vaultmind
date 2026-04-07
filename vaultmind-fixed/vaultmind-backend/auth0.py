import os
import time
import httpx
from jose import jwt
from dotenv import load_dotenv

load_dotenv()

AUTH0_DOMAIN    = os.getenv("AUTH0_DOMAIN")
AUTH0_CLIENT_ID = os.getenv("AUTH0_CLIENT_ID")
AUTH0_CLIENT_SECRET = os.getenv("AUTH0_CLIENT_SECRET")
AUTH0_AUDIENCE  = os.getenv("AUTH0_AUDIENCE")

# JWKS cache — fetch at most once every 10 minutes
_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0


async def _get_jwks() -> dict:
    global _jwks_cache, _jwks_fetched_at
    if _jwks_cache and time.time() - _jwks_fetched_at < 600:
        return _jwks_cache
    jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_fetched_at = time.time()
    return _jwks_cache


async def get_m2m_token() -> str:
    """Get M2M access token from Auth0 — this is what Token Vault uses internally."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://{AUTH0_DOMAIN}/oauth/token",
            json={
                "client_id":     AUTH0_CLIENT_ID,
                "client_secret": AUTH0_CLIENT_SECRET,
                "audience":      AUTH0_AUDIENCE,
                "grant_type":    "client_credentials",
            }
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def issue_scoped_token(scope: str, agent_id: str) -> dict:
    """
    Token Vault pattern: issue a scoped, intent-bound token for an agent.
    The agent never sees the real credential — only gets a vault receipt.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://{AUTH0_DOMAIN}/oauth/token",
            json={
                "client_id":     AUTH0_CLIENT_ID,
                "client_secret": AUTH0_CLIENT_SECRET,
                "audience":      AUTH0_AUDIENCE,
                "grant_type":    "client_credentials",
                "scope":         scope,
            }
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "access_token": data["access_token"],
            "token_type":   data.get("token_type", "Bearer"),
            "expires_in":   data.get("expires_in", 900),
            "scope":        scope,
        }


async def verify_token(token: str) -> dict:
    """Verify a JWT token from Auth0 — async, with JWKS caching."""
    jwks = await _get_jwks()

    unverified_header = jwt.get_unverified_header(token)
    rsa_key = {}
    for key in jwks["keys"]:
        if key["kid"] == unverified_header["kid"]:
            rsa_key = {
                "kty": key["kty"], "kid": key["kid"],
                "use": key["use"], "n":   key["n"],   "e": key["e"],
            }
    if not rsa_key:
        raise Exception("Unable to find appropriate key")

    payload = jwt.decode(
        token, rsa_key,
        algorithms=["RS256"],
        audience=AUTH0_AUDIENCE,
        issuer=f"https://{AUTH0_DOMAIN}/",
    )
    return payload
