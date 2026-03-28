"""
Niriksha — JWT Auth Middleware
================================
FastAPI dependency functions for JWT verification and role enforcement.
Used as Depends() on protected route handlers.

Usage:
    @router.get("/protected")
    async def protected_route(user = Depends(get_current_user)):
        ...

    @router.get("/admin-only")
    async def admin_route(user = Depends(require_admin)):
        ...
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from utils.auth import decode_token

# OAuth2 scheme — extracts token from "Authorization: Bearer <token>" header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Decode and validate the JWT token from the request Authorization header.

    Returns:
        User payload dict: {"sub": user_id, "role": "student|admin", "name": "..."}
    Raises:
        401 if token is missing, expired, or invalid
    """
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Ensure required claims are present
    user_id = payload.get("sub")
    role    = payload.get("role")
    if not user_id or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: missing required claims.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "id":    user_id,
        "role":  role,
        "name":  payload.get("name", "Unknown"),
        "email": payload.get("email", ""),
    }


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """
    Extends get_current_user — additionally requires the 'admin' role.

    Raises:
        403 if user is not an admin
    """
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required. Insufficient permissions.",
        )
    return user


async def require_student(user: dict = Depends(get_current_user)) -> dict:
    """
    Extends get_current_user — requires the 'student' role.

    Raises:
        403 if user is not a student
    """
    if user.get("role") not in ("student", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required.",
        )
    return user
