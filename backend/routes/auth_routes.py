"""
Niriksha — Auth Routes
========================
Handles user registration, login, and face identity management.

Endpoints:
  POST /auth/register      — Create account (optionally with face)
  POST /auth/login         — Get JWT token
  POST /auth/register-face — Store face embedding for existing user
  POST /auth/verify-face   — Verify live face vs stored embedding
  GET  /auth/me            — Get current user info from JWT
"""
from fastapi import APIRouter, HTTPException, status, Depends
from bson import ObjectId

from models.user import (
    UserCreate, UserLogin,
    FaceRegisterRequest, FaceVerifyRequest,
)
from services.auth_service import (
    register_user, login_user,
    register_face, verify_face,
)
from middleware.auth_middleware import get_current_user
from database.connection import get_database

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate):
    """
    Register a new student or admin account.
    
    - Hashes password with bcrypt
    - Optionally stores face embedding if face_embedding provided
    - Returns JWT access token
    """
    try:
        result = await register_user(data)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Registration failed: {e}")


@router.post("/login")
async def login(data: UserLogin):
    """
    Authenticate with email + password.
    Returns JWT token for use in Authorization: Bearer <token> header.
    """
    try:
        result = await login_user(data)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Login failed: {e}")


@router.post("/register-face")
async def register_face_endpoint(
    data: FaceRegisterRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Store face embedding for the authenticated user.
    
    - Requires a valid JWT (user must be logged in)
    - Extracts DeepFace embedding from provided webcam frame
    - Updates user document with embedding
    """
    # Security: a user can only register their own face
    if current_user["id"] != data.user_id and current_user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot register face for another user.")

    result = await register_face(data.user_id, data.frame_b64)
    if not result["success"]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=result["message"])
    return result


@router.post("/verify-face")
async def verify_face_endpoint(
    data: FaceVerifyRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Verify a student's identity before they start an exam.
    
    - Compares live webcam frame to stored face embedding
    - Returns verified=True if match confidence is sufficient
    """
    # Security: a student can only verify their own face
    if current_user["id"] != data.user_id and current_user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot verify face for another user.")

    result = await verify_face(data.user_id, data.frame_b64)
    return result


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return current user info with fresh face-registration status from DB."""
    try:
        db = await get_database()
        user = await db.users.find_one(
            {"_id": ObjectId(current_user["id"])},
            {"name": 1, "email": 1, "role": 1, "face_embedding": 1},
        )
        if user:
            return {
                "id": str(user["_id"]),
                "name": user.get("name", current_user.get("name", "Unknown")),
                "email": user.get("email", current_user.get("email", "")),
                "role": user.get("role", current_user.get("role", "student")),
                "has_face_embedding": bool(user.get("face_embedding")),
            }
    except Exception:
        pass

    # Safe fallback if DB lookup fails.
    return {**current_user, "has_face_embedding": False}
