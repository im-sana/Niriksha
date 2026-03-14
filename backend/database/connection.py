"""
Niriksha Backend — MongoDB Connection
========================================
Uses Motor (async MongoDB driver) to connect to a local MongoDB instance.
Falls back to a mock in-memory store if MongoDB is unavailable.
"""
import motor.motor_asyncio
from typing import Optional

# ── Configuration ─────────────────────────────────────────────
MONGO_URI = "mongodb://localhost:27017"
DB_NAME   = "niriksha"

# Singleton client
_client: Optional[motor.motor_asyncio.AsyncIOMotorClient] = None
_db = None

# ── In-memory fallback for development without MongoDB ────────
class InMemoryCollection:
    """Mimics a minimal Motor collection API for development."""
    def __init__(self):
        self._data = []
        self._counter = 0

    async def insert_one(self, doc):
        doc["_id"] = str(self._counter)
        self._counter += 1
        self._data.append(dict(doc))
        class Result:
            inserted_id = doc["_id"]
        return Result()

    async def insert_many(self, docs):
        for doc in docs:
            await self.insert_one(doc)

    async def find_one(self, query):
        for doc in self._data:
            if all(doc.get(k) == v for k, v in query.items() if not isinstance(v, dict)):
                return dict(doc)
        return None

    async def update_one(self, query, update):
        for doc in self._data:
            if all(doc.get(k) == v for k, v in query.items() if not isinstance(v, dict)):
                for k, v in update.get("$set", {}).items():
                    doc[k] = v
                return

    async def count_documents(self, query):
        count = 0
        for doc in self._data:
            match = True
            for k, v in query.items():
                if isinstance(v, dict):
                    # Handle basic operators like $gte
                    if "$gte" in v and not (doc.get(k, 0) >= v["$gte"]):
                        match = False
                elif doc.get(k) != v:
                    match = False
            if match:
                count += 1
        return count

    def find(self, query=None):
        return _InMemoryCursor(self._data)

    def aggregate(self, pipeline):
        return _InMemoryCursor([{"_id": None, "avg": 0}])


class _InMemoryCursor:
    def __init__(self, data):
        self._data = data[:]

    def sort(self, *args):
        return self

    async def to_list(self, n=None):
        return [dict(d) for d in (self._data[:n] if n else self._data)]


class InMemoryDB:
    """Mock database with three collections."""
    def __init__(self):
        self.sessions      = InMemoryCollection()
        self.cheating_logs = InMemoryCollection()
        self.students      = InMemoryCollection()
        self.exams         = InMemoryCollection()


_mock_db = InMemoryDB()


async def get_database():
    """
    Returns the Motor database if MongoDB is reachable,
    otherwise returns the in-memory mock database.
    """
    global _client, _db
    if _db is not None:
        return _db

    try:
        _client = motor.motor_asyncio.AsyncIOMotorClient(
            MONGO_URI, serverSelectionTimeoutMS=3000
        )
        # Verify connection
        await _client.server_info()
        _db = _client[DB_NAME]
        print(f"[DB] Connected to MongoDB: {MONGO_URI}/{DB_NAME}")
        return _db
    except Exception as e:
        print(f"[DB] MongoDB unavailable ({e}). Using in-memory store.")
        _db = _mock_db
        return _db
