"""
Niriksha — User Pydantic Models
================================
Defines request/response schemas for user management.
All passwords stored as bcrypt hashes; never raw.
"""
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# ── Request schemas (coming from frontend) ──────────────────

class UserCreate(BaseModel):
    """Schema for new user registration."""
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6)
    role: str = Field(default="student", pattern="^(student|admin)$")
    face_embedding: Optional[List[float]] = None  # Optional at register-time


class UserLogin(BaseModel):
    """Schema for login request."""
    email: str
    password: str
    role: str = Field(pattern="^(student|admin)$")


class FaceRegisterRequest(BaseModel):
    """Schema for storing face embedding after registration."""
    user_id: str
    frame_b64: str  # base64: JPEG frame captured by webcam


class FaceVerifyRequest(BaseModel):
    """Schema for face identity verification before exam."""
    user_id: str
    frame_b64: str  # live face frame to compare against stored embedding


# ── Response schemas (returning to frontend) ─────────────────

class UserPublic(BaseModel):
    """Safe user data to return to frontend (no password)."""
    id: str
    name: str
    email: str
    role: str
    has_face_embedding: bool = False


class TokenResponse(BaseModel):
    """JWT login response."""
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class FaceVerifyResponse(BaseModel):
    """Face verification result."""
    verified: bool
    confidence: float
    message: str
