"""
Niriksha — JWT + Password Auth Utilities
==========================================
Handles:
  - Password hashing with bcrypt (via passlib)
  - JWT creation and verification (via python-jose)
  
Environment variables used:
  - JWT_SECRET
  - JWT_ALGORITHM  (default HS256)
  - JWT_EXPIRE_MINUTES (default 1440 = 24h)
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

# ── Configuration ──────────────────────────────────────────────
JWT_SECRET      = os.getenv("JWT_SECRET", "niriksha_fallback_secret_change_me")
JWT_ALGORITHM   = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MIN  = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

# ── Bcrypt context ─────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plain-text password against its bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a signed JWT access token.

    Args:
        data: dict of claims to encode (should include 'sub' = user_id, 'role', 'name')
        expires_delta: custom expiry; defaults to JWT_EXPIRE_MIN
    Returns:
        Encoded JWT string
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=JWT_EXPIRE_MIN)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """
    Decode and verify a JWT token.

    Returns:
        The payload dict on success, None if invalid/expired.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
