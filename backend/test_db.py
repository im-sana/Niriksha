import asyncio
from database.connection import get_database

async def test():
    db = await get_database()
    await db.sessions.insert_one({'cheat_score': 10})
    await db.sessions.insert_one({'cheat_score': 20})
    await db.sessions.insert_one({'cheat_score': 15})
    
    flagged = await db.sessions.count_documents({'cheat_score': {'$gte': 15}})
    print(f'Flagged count: {flagged}')

if __name__ == '__main__':
    asyncio.run(test())
