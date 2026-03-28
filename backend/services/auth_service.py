"""
Niriksha — Auth Service Layer
================================
Business logic for user registration, login, and face identity management.
Routes should call these functions; no DB logic inside route handlers.
"""
import logging
from typing import Optional
from datetime import datetime
import os

from database.connection import get_database
from models.user import UserCreate, UserLogin, FaceRegisterRequest, FaceVerifyRequest
from utils.auth import hash_password, verify_password, create_access_token
from utils.face_utils import extract_embedding, compare_embeddings, liveness_check

logger = logging.getLogger(__name__)


async def register_user(data: UserCreate) -> dict:
    """
    Register a new user.

    Steps:
      1. Check email is not already registered
      2. Hash password with bcrypt
      3. Extract face embedding if frame provided
      4. Insert user document into MongoDB
      5. Return public user data + JWT

    Raises:
        ValueError: If email already exists
    """
    db = await get_database()
    users_collection = db["users"]

    email = data.email.lower()
    
    # Check for duplicate email
    existing_user = await users_collection.find_one({"email": email})

    if existing_user is not None:
        raise ValueError("Email may already be in use")

    # Hash password
    hashed_pw = hash_password(data.password)

    # Build user document
    user_doc = {
        "name":           data.name,
        "email":          email,
        "password_hash":  hashed_pw,
        "role":           data.role,
        "face_embedding": data.face_embedding or [],
        "created_at":     datetime.utcnow().isoformat(),
    }

    result = await users_collection.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Create JWT token
    token = create_access_token({
        "sub":   user_id,
        "role":  data.role,
        "name":  data.name,
        "email": email,
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id":                user_id,
            "name":              data.name,
            "email":             email,
            "role":              data.role,
            "has_face_embedding": bool(data.face_embedding),
        }
    }


async def login_user(data: UserLogin) -> dict:
    """
    Authenticate a user by email + password and return a JWT.

    Raises:
        ValueError: If credentials are invalid
    """
    db = await get_database()

    # Find user by email
    user = await db.users.find_one({"email": data.email.lower()})
    if not user:
        raise ValueError("Invalid email or password.")

    # Verify password
    if not verify_password(data.password, user.get("password_hash", "")):
        raise ValueError("Invalid email or password.")
        
    # Role consistency check
    actual_role = user.get("role", "student")
    if data.role != actual_role:
        raise ValueError(f"Account registered as {actual_role}, but {data.role} login attempted.")

    user_id = str(user["_id"])

    # Return JWT
    token = create_access_token({
        "sub":   user_id,
        "role":  user.get("role", "student"),
        "name":  user.get("name", "Unknown"),
        "email": user.get("email", ""),
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id":                user_id,
            "name":              user.get("name", ""),
            "email":             user.get("email", ""),
            "role":              user.get("role", "student"),
            "has_face_embedding": bool(user.get("face_embedding")),
        }
    }


async def register_face(user_id: str, frame_b64: str) -> dict:
    """
    Extract face embedding from a webcam frame and store in the user document.

    Args:
        user_id:   The MongoDB _id string of the user
        frame_b64: Base64-encoded JPEG frame

    Returns:
        {"success": True/False, "message": "..."}
    """
    from bson import ObjectId

    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        return {"success": False, "message": "Invalid user id."}

    # Liveness check first
    is_live = liveness_check(frame_b64)
    if not is_live:
        return {"success": False, "message": "Liveness check failed. Please ensure good lighting and a real camera feed."}

    # Extract embedding
    embedding = extract_embedding(frame_b64)
    if embedding is None:
        return {"success": False, "message": "No face detected. Please ensure your face is clearly visible."}

    # Store embedding in DB
    db = await get_database()
    update_result = await db.users.update_one(
        {"_id": user_obj_id},
        {"$set": {"face_embedding": embedding}},
    )

    if update_result.matched_count == 0:
        return {"success": False, "message": "User not found for face registration."}

    return {"success": True, "message": "Face registered successfully!", "has_face_embedding": True}


async def verify_face(user_id: str, frame_b64: str) -> dict:
    """
    Verify a live face frame against the stored embedding for a user.

    Returns:
        {"verified": bool, "confidence": float, "message": str}
    """
    from bson import ObjectId

    try:
        user_obj_id = ObjectId(user_id)
    except Exception:
        return {"verified": False, "confidence": 0.0, "message": "Invalid user id."}

    db = await get_database()

    # Fetch stored embedding
    user = await db.users.find_one(
        {"_id": user_obj_id},
        {"face_embedding": 1, "name": 1}
    )
    if not user:
        return {"verified": False, "confidence": 0.0, "message": "User not found."}

    stored_embedding = user.get("face_embedding", [])
    if not stored_embedding:
        return {"verified": False, "confidence": 0.0, "message": "No face registered. Please complete face registration first."}

    # Liveness check
    is_live = liveness_check(frame_b64)
    if not is_live:
        return {"verified": False, "confidence": 0.0, "message": "Liveness check failed. Please use a real camera."}

    # Extract live embedding
    live_embedding = extract_embedding(frame_b64)
    if live_embedding is None:
        return {"verified": False, "confidence": 0.0, "message": "No face detected in current frame. Ensure your face is visible."}

    # Compare
    threshold = float(os.getenv("FACE_VERIFY_THRESHOLD", "0.55"))
    is_match, confidence = compare_embeddings(stored_embedding, live_embedding, threshold=threshold)

    if is_match:
        return {"verified": True, "confidence": confidence, "message": f"Identity verified! Welcome, {user.get('name', 'Student')}."}
    else:
        return {"verified": False, "confidence": confidence, "message": "Face does not match registered identity. Verification failed."}
