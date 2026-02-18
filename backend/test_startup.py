"""Quick test to see if MongoDB connection works"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

print(f"Attempting to connect to MongoDB...")
print(f"URL (first 30 chars): {mongo_url[:30]}...")
print(f"Database: {db_name}")

async def test_connection():
    try:
        client = AsyncIOMotorClient(mongo_url, server_api=ServerApi('1'), serverSelectionTimeoutMS=5000)
        print("Client created")
        await client.admin.command('ping')
        print("✓ Ping successful - MongoDB connection works!")
        client.close()
    except Exception as e:
        print(f"✗ Connection failed: {e}")

asyncio.run(test_connection())
