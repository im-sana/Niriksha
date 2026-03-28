"""
Niriksha Backend — MongoDB Connection (Updated)
================================================
Updated to:
  - Read MONGODB_URL from .env (python-dotenv)
  - Add retry logic (3 attempts, 2s delay between retries)
  - Remove in-memory fallback (MongoDB is required for production)
  - Register collections: users, results, sessions, cheating_logs, screenshots
"""
import asyncio
import logging
import os
from typing import Optional

import motor.motor_asyncio
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ── Config from environment ────────────────────────────────────
MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME", "niriksha")

# Singleton client/db
_client: Optional[motor.motor_asyncio.AsyncIOMotorClient] = None
_db = None

# ── Retry settings ─────────────────────────────────────────────
MAX_RETRIES    = 3
RETRY_DELAY_S  = 2


async def get_database():
    """
    Returns the Motor (async MongoDB) database instance.
    
    - Reads MONGODB_URL from .env
    - Attempts connection up to MAX_RETRIES times with RETRY_DELAY_S delay
    - Creates required indexes on first connection
    - Raises RuntimeError if all retries fail (no silent fallback)
    """
    global _client, _db

    if _db is not None:
        return _db

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info(f"[DB] Connecting to MongoDB (attempt {attempt}/{MAX_RETRIES}): {MONGO_URL}")
            client = motor.motor_asyncio.AsyncIOMotorClient(
                MONGO_URL,
                serverSelectionTimeoutMS=5000,
            )
            # Verify connection is live
            await client.server_info()

            _client = client
            _db = client[DB_NAME]
            logger.info(f"[DB] Connected to MongoDB: {MONGO_URL}/{DB_NAME}")

            # Create indexes on first connection
            await _ensure_indexes(_db)
            return _db

        except Exception as e:
            last_error = e
            logger.warning(f"[DB] Connection attempt {attempt} failed: {e}")
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY_S)

    # All retries exhausted
    raise RuntimeError(
        f"[DB] Failed to connect to MongoDB after {MAX_RETRIES} attempts. "
        f"Last error: {last_error}. "
        f"Please ensure MongoDB is running at: {MONGO_URL}"
    )


async def _ensure_indexes(db) -> None:
    """Create necessary database indexes for performance and uniqueness."""
    try:
        # Users: unique email index
        await db.users.create_index("email", unique=True)

        # Sessions: compound index for fast lookup
        await db.sessions.create_index([("student_id", 1), ("exam_id", 1)])
        await db.sessions.create_index("status")

        # Results: user and timestamp for sorting
        await db.results.create_index("user_id")
        await db.results.create_index([("timestamp", -1)])
        await db.results.create_index("risk_level")

        # Cheating logs: session lookup
        await db.cheating_logs.create_index("session_id")
        await db.cheating_logs.create_index([("timestamp", -1)])

        logger.info("[DB] Database indexes ensured.")
    except Exception as e:
        logger.warning(f"[DB] Index creation warning (non-fatal): {e}")


async def close_connection():
    """Close the MongoDB connection (call on app shutdown)."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
        logger.info("[DB] MongoDB connection closed.")
