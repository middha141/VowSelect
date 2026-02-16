# How to Integrate DatabaseInitializer with server.py

This guide shows how to update your FastAPI server to automatically initialize MongoDB collections on startup.

---

## Current Setup

Your `backend/server.py` currently has:
```python
from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="VowSelect API")
```

---

## Updated Setup with Initialization

### Step 1: Import the DatabaseInitializer

At the top of `backend/server.py`, add:

```python
from database.init_db import DatabaseInitializer
from contextlib import asynccontextmanager
```

### Step 2: Define Lifespan Handler

Add this before creating the FastAPI app:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handle application startup and shutdown events
    """
    # ============ STARTUP ============
    logger.info("🚀 Application starting up...")
    
    try:
        # Initialize database
        logger.info("📦 Initializing MongoDB database...")
        initializer = DatabaseInitializer(db)
        await initializer.initialize()
        logger.info("✓ Database initialization completed")
    
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise
    
    yield  # Application runs here
    
    # ============ SHUTDOWN ============
    logger.info("🛑 Application shutting down...")
    try:
        client.close()
        logger.info("✓ Database connection closed")
    except Exception as e:
        logger.error(f"Error closing database connection: {e}")
```

### Step 3: Create App with Lifespan

Replace:
```python
app = FastAPI(title="VowSelect API")
```

With:
```python
app = FastAPI(
    title="VowSelect API",
    lifespan=lifespan
)
```

### Step 4: Add CORS Middleware

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Complete Example

Here's how your `backend/server.py` should look at the beginning:

```python
from fastapi import FastAPI, APIRouter, HTTPException, Query, Body, UploadFile, File
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path
from contextlib import asynccontextmanager
import os
import logging
import random
import string
import io
from bson import ObjectId

# Import DatabaseInitializer
from database.init_db import DatabaseInitializer

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ==================== LIFESPAN HANDLER ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown"""
    
    # ===== STARTUP =====
    logger.info("🚀 Application starting up...")
    
    try:
        logger.info("📦 Initializing MongoDB database...")
        initializer = DatabaseInitializer(db)
        await initializer.initialize()
        logger.info("✓ Database initialization completed successfully")
    
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise
    
    yield  # Application runs here
    
    # ===== SHUTDOWN =====
    logger.info("🛑 Application shutting down...")
    try:
        client.close()
        logger.info("✓ Database connection closed")
    except Exception as e:
        logger.error(f"Error closing database connection: {e}")


# ==================== APP CREATION ====================

app = FastAPI(
    title="VowSelect API",
    description="Collaborative wedding photo selection app",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ==================== REST OF YOUR CODE ====================

# ... (rest of your models, routes, etc.)
```

---

## What Happens When Server Starts

### Console Output
```
INFO:     Application starting up...
INFO:     📦 Initializing MongoDB database...
INFO:     Creating 'users' collection...
INFO:     ✓ 'users' collection created with indexes
INFO:     Creating 'rooms' collection...
INFO:     ✓ 'rooms' collection created with indexes
INFO:     Creating 'room_participants' collection...
INFO:     ✓ 'room_participants' collection already exists
INFO:     Creating 'photos' collection...
INFO:     ✓ 'photos' collection created with indexes
INFO:     Creating 'votes' collection...
INFO:     ✓ 'votes' collection created with indexes
INFO:     Creating 'import_jobs' collection...
INFO:     ✓ 'import_jobs' collection created with indexes
INFO:     Creating 'export_jobs' collection...
INFO:     ✓ 'export_jobs' collection created with indexes
INFO:     ✓ Database initialization completed successfully
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

### What Gets Created
- ✅ 7 MongoDB collections
- ✅ 15+ indexes
- ✅ JSON Schema validation
- ✅ Unique constraints
- ✅ Ready for data insertion

---

## Testing It Works

### Start the server:
```bash
cd backend
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

### Check MongoDB:
```javascript
use vowselect
show collections
// Should output all 7 collections
```

### Query a collection:
```javascript
db.users.insertOne({
  username: "test_user",
  created_at: new Date()
})

db.users.findOne()
// Should return the inserted document
```

---

## Error Handling

The lifespan handler gracefully handles errors:

### If MongoDB is not running:
```
INFO:     Application starting up...
INFO:     📦 Initializing MongoDB database...
ERROR:    Error loading ASGI app. Could not connect to MongoDB
```

**Solution**: Start MongoDB service

### If .env is missing:
```
ERROR:    KeyError: 'MONGO_URL'
```

**Solution**: Create `.env` file with required variables

### If database initialization fails:
```
ERROR:    ❌ Database initialization failed: [error details]
INFO:     Stopping reloader process
```

**Solution**: Check logs for specific error

---

## File Structure

After adding database initialization:

```
backend/
├── server.py              # Main FastAPI app (updated)
├── requirements_clean.txt
├── .env
├── venv/
└── database/
    ├── __init__.py        # New: Package init
    └── init_db.py         # New: DatabaseInitializer class
```

---

## Summary

| Step | Action | File |
|------|--------|------|
| 1 | Create DatabaseInitializer | `backend/database/init_db.py` |
| 2 | Create package init | `backend/database/__init__.py` |
| 3 | Import initializer | `backend/server.py` |
| 4 | Add lifespan handler | `backend/server.py` |
| 5 | Update app creation | `backend/server.py` |
| 6 | Start server | Run uvicorn |

---

## Next Time You Start the Server

1. Server starts
2. Lifespan startup runs
3. DatabaseInitializer initializes collections
4. Collections are created/validated
5. Server is ready to accept requests
6. Frontend can connect and use the app

Everything happens automatically! ✅

---

## Advanced: Manual Initialization

If you need to reinitialize collections manually:

```python
# Somewhere in your code
from database.init_db import DatabaseInitializer

async def reinit_database():
    """Manually reinitialize database"""
    initializer = DatabaseInitializer(db)
    await initializer.initialize()
    print("Database reinitialized!")

# Or in a route:
@app.post("/api/admin/init-db")
async def init_database():
    """Admin endpoint to reinitialize database"""
    try:
        initializer = DatabaseInitializer(db)
        await initializer.initialize()
        return {"message": "Database initialized successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## Troubleshooting

### Collections not being created?
1. Check MongoDB is running
2. Check `MONGO_URL` in `.env`
3. Check server logs for errors
4. Verify `database/init_db.py` exists

### Server won't start?
1. Check Python version (3.11+)
2. Check all dependencies installed (`pip install -r requirements_clean.txt`)
3. Check `.env` file exists
4. Check MongoDB connection string

### Collections already exist error?
This is fine! The initializer handles it gracefully.
It will just skip creating collections that already exist.

---

## You're All Set! 🎉

Your VowSelect backend now:
- ✅ Automatically initializes MongoDB on startup
- ✅ Creates all 7 collections
- ✅ Sets up indexes for performance
- ✅ Validates data with JSON Schema
- ✅ Handles errors gracefully
- ✅ Logs everything for debugging

Ready to build features! 🚀

