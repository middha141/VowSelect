"""Test imports one by one to find the blocking import"""
print("Starting import test...", flush=True)

print("1. Testing basic imports...", flush=True)
import os
from pathlib import Path
print("✓ os and Path imported", flush=True)

print("2. Testing dotenv...", flush=True)
from dotenv import load_dotenv
print("✓ dotenv imported", flush=True)

print("3. Loading .env file...", flush=True)
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
print("✓ .env loaded", flush=True)

print("4. Getting environment variables...", flush=True)
mongo_url = os.environ.get('MONGO_URL', 'NOT_FOUND')
db_name = os.environ.get('DB_NAME', 'NOT_FOUND')
print(f"✓ MONGO_URL: {mongo_url[:30]}..." if len(mongo_url) > 30 else f"✓ MONGO_URL: {mongo_url}", flush=True)
print(f"✓ DB_NAME: {db_name}", flush=True)

print("5. Testing pymongo imports...", flush=True)
from pymongo.server_api import ServerApi
print("✓ ServerApi imported", flush=True)

print("6. Testing motor imports...", flush=True)
from motor.motor_asyncio import AsyncIOMotorClient
print("✓ AsyncIOMotorClient imported", flush=True)

print("\n✓✓✓ All imports successful! Issue is likely in the connection attempt.", flush=True)
