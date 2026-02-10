# MongoDB Collections Setup for VowSelect

This guide explains how MongoDB collections (equivalent to tables in SQL) are created in VowSelect.

---

## Overview

MongoDB doesn't require you to pre-create collections. They are created **automatically** when you insert the first document. However, for production applications, it's best practice to:

1. **Create collections explicitly** at startup
2. **Create indexes** for better performance
3. **Set up validation rules** to ensure data integrity

---

## How MongoDB Collections Work

### Automatic Creation (Default)
```python
# This automatically creates a "users" collection if it doesn't exist
await db['users'].insert_one({
    "username": "john",
    "created_at": datetime.utcnow()
})
```

### Explicit Creation (Recommended)
```python
# Explicitly create collections with validation and indexes
await db.create_collection("users", validator={
    "$jsonSchema": {
        "required": ["username"],
        "properties": {
            "username": {"bsonType": "string"}
        }
    }
})
```

---

## VowSelect Collections Structure

Your application uses these 7 collections:

| Collection | Purpose | Documents |
|-----------|---------|-----------|
| **users** | User accounts | Guest user info |
| **rooms** | Selection rooms | Room metadata, codes |
| **room_participants** | Room memberships | Which users are in which rooms |
| **photos** | Photo references | Photo metadata, sources |
| **votes** | User votes | Voting scores and timestamps |
| **import_jobs** | Import tracking | Status of photo imports |
| **export_jobs** | Export tracking | Status of photo exports |

---

## Complete Initialization Module

Create a new file: **backend/database/init_db.py**

```python
"""
Database initialization module for VowSelect.
Creates collections, indexes, and validation rules on startup.
"""

import logging
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime

logger = logging.getLogger(__name__)


class DatabaseInitializer:
    """Initialize MongoDB database with collections, indexes, and validation"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def initialize(self):
        """Initialize all collections, indexes, and validation"""
        logger.info("Initializing MongoDB database...")
        
        try:
            await self.create_users_collection()
            await self.create_rooms_collection()
            await self.create_room_participants_collection()
            await self.create_photos_collection()
            await self.create_votes_collection()
            await self.create_import_jobs_collection()
            await self.create_export_jobs_collection()
            
            logger.info("✓ Database initialization completed successfully")
        
        except Exception as e:
            logger.error(f"✗ Database initialization failed: {e}")
            raise
    
    async def create_users_collection(self):
        """
        Create users collection
        
        Schema:
        - _id: ObjectId
        - username: string (unique, required)
        - created_at: timestamp
        """
        logger.info("Creating 'users' collection...")
        
        try:
            await self.db.create_collection(
                "users",
                validator={
                    "$jsonSchema": {
                        "bsonType": "object",
                        "required": ["username", "created_at"],
                        "properties": {
                            "_id": {"bsonType": "objectId"},
                            "username": {
                                "bsonType": "string",
                                "description": "Guest username"
                            },
                            "created_at": {
                                "bsonType": "date",
                                "description": "Account creation timestamp"
                            }
                        }
                    }
                }
            )
            
            # Create unique index on username
            await self.db['users'].create_index("username", unique=True)
            logger.info("✓ 'users' collection created with indexes")
        
        except Exception as e:
            if "already exists" in str(e):
                logger.info("✓ 'users' collection already exists")
            else:
                raise
    
    async def create_rooms_collection(self):
        """
        Create rooms collection
        
        Schema:
        - _id: ObjectId
        - code: string (5-digit unique code)
        - creator_id: string (user ID)
        - created_at: timestamp
        - status: string (active, completed, archived)
        """
        logger.info("Creating 'rooms' collection...")
        
        try:
            await self.db.create_collection(
                "rooms",
                validator={
                    "$jsonSchema": {
                        "bsonType": "object",
                        "required": ["code", "creator_id", "created_at", "status"],
                        "properties": {
                            "_id": {"bsonType": "objectId"},
                            "code": {
                                "bsonType": "string",
                                "description": "5-digit room code"
                            },
                            "creator_id": {
                                "bsonType": "string",
                                "description": "ID of user who created the room"
                            },
                            "created_at": {
                                "bsonType": "date",
                                "description": "Room creation timestamp"
                            },
                            "status": {
                                "bsonType": "string",
                                "enum": ["active", "completed", "archived"],
                                "description": "Room status"
                            }
                        }
                    }
                }
            )
            
            # Create indexes
            await self.db['rooms'].create_index("code", unique=True)
            await self.db['rooms'].create_index("creator_id")
            logger.info("✓ 'rooms' collection created with indexes")
        
        except Exception as e:
            if "already exists" in str(e):
                logger.info("✓ 'rooms' collection already exists")
            else:
                raise
    
    async def create_room_participants_collection(self):
        """
        Create room_participants collection (tracks user membership in rooms)
        
        Schema:
        - _id: ObjectId
        - room_id: string
        - user_id: string
        - username: string
        - joined_at: timestamp
        """
        logger.info("Creating 'room_participants' collection...")
        
        try:
            await self.db.create_collection(
                "room_participants",
                validator={
                    "$jsonSchema": {
                        "bsonType": "object",
                        "required": ["room_id", "user_id", "username", "joined_at"],
                        "properties": {
                            "_id": {"bsonType": "objectId"},
                            "room_id": {
                                "bsonType": "string",
                                "description": "ID of the room"
                            },
                            "user_id": {
                                "bsonType": "string",
                                "description": "ID of the user"
                            },
                            "username": {
                                "bsonType": "string",
                                "description": "Username of the user"
                            },
                            "joined_at": {
                                "bsonType": "date",
                                "description": "Timestamp when user joined"
                            }
                        }
                    }
                }
            )
            
            # Create indexes for fast queries
            await self.db['room_participants'].create_index([("room_id", 1), ("user_id", 1)], unique=True)
            await self.db['room_participants'].create_index("room_id")
            await self.db['room_participants'].create_index("user_id")
            logger.info("✓ 'room_participants' collection created with indexes")
        
        except Exception as e:
            if "already exists" in str(e):
                logger.info("✓ 'room_participants' collection already exists")
            else:
                raise
    
    async def create_photos_collection(self):
        """
        Create photos collection
        
        Schema:
        - _id: ObjectId
        - room_id: string
        - source_type: string (local, drive, upload)
        - path: string (optional, for local files)
        - drive_id: string (optional, for Google Drive)
        - drive_thumbnail_url: string (optional)
        - base64_data: string (optional, for uploaded files)
        - filename: string
        - index: number (order in room)
        - created_at: timestamp
        """
        logger.info("Creating 'photos' collection...")
        
        try:
            await self.db.create_collection(
                "photos",
                validator={
                    "$jsonSchema": {
                        "bsonType": "object",
                        "required": ["room_id", "source_type", "filename", "index", "created_at"],
                        "properties": {
                            "_id": {"bsonType": "objectId"},
                            "room_id": {
                                "bsonType": "string",
                                "description": "ID of the room"
                            },
                            "source_type": {
                                "bsonType": "string",
                                "enum": ["local", "drive", "upload"],
                                "description": "Source of the photo"
                            },
                            "path": {
                                "bsonType": "string",
                                "description": "Local file path (optional)"
                            },
                            "drive_id": {
                                "bsonType": "string",
                                "description": "Google Drive file ID (optional)"
                            },
                            "drive_thumbnail_url": {
                                "bsonType": "string",
                                "description": "Google Drive thumbnail URL (optional)"
                            },
                            "base64_data": {
                                "bsonType": "string",
                                "description": "Base64 encoded image (optional)"
                            },
                            "filename": {
                                "bsonType": "string",
                                "description": "Photo filename"
                            },
                            "index": {
                                "bsonType": "int",
                                "description": "Order in the room"
                            },
                            "created_at": {
                                "bsonType": "date",
                                "description": "Photo import timestamp"
                            }
                        }
                    }
                }
            )
            
            # Create indexes for fast queries
            await self.db['photos'].create_index("room_id")
            await self.db['photos'].create_index([("room_id", 1), ("index", 1)])
            logger.info("✓ 'photos' collection created with indexes")
        
        except Exception as e:
            if "already exists" in str(e):
                logger.info("✓ 'photos' collection already exists")
            else:
                raise
    
    async def create_votes_collection(self):
        """
        Create votes collection
        
        Schema:
        - _id: ObjectId
        - room_id: string
        - photo_id: string
        - user_id: string
        - score: number (-3 to +3)
        - timestamp: timestamp
        """
        logger.info("Creating 'votes' collection...")
        
        try:
            await self.db.create_collection(
                "votes",
                validator={
                    "$jsonSchema": {
                        "bsonType": "object",
                        "required": ["room_id", "photo_id", "user_id", "score", "timestamp"],
                        "properties": {
                            "_id": {"bsonType": "objectId"},
                            "room_id": {
                                "bsonType": "string",
                                "description": "ID of the room"
                            },
                            "photo_id": {
                                "bsonType": "string",
                                "description": "ID of the photo"
                            },
                            "user_id": {
                                "bsonType": "string",
                                "description": "ID of the user who voted"
                            },
                            "score": {
                                "bsonType": "int",
                                "enum": [-3, -2, -1, 1, 2, 3],
                                "description": "Voting score"
                            },
                            "timestamp": {
                                "bsonType": "date",
                                "description": "Vote timestamp"
                            }
                        }
                    }
                }
            )
            
            # Create indexes for fast queries
            await self.db['votes'].create_index([("room_id", 1), ("photo_id", 1), ("user_id", 1)], unique=True)
            await self.db['votes'].create_index("room_id")
            await self.db['votes'].create_index("photo_id")
            await self.db['votes'].create_index("user_id")
            logger.info("✓ 'votes' collection created with indexes")
        
        except Exception as e:
            if "already exists" in str(e):
                logger.info("✓ 'votes' collection already exists")
            else:
                raise
    
    async def create_import_jobs_collection(self):
        """
        Create import_jobs collection (tracks photo import progress)
        
        Schema:
        - _id: ObjectId
        - room_id: string
        - source_type: string (local, drive)
        - source_path: string
        - status: string (pending, processing, completed, failed)
        - total_photos: number
        - processed_photos: number
        - created_at: timestamp
        """
        logger.info("Creating 'import_jobs' collection...")
        
        try:
            await self.db.create_collection(
                "import_jobs",
                validator={
                    "$jsonSchema": {
                        "bsonType": "object",
                        "required": ["room_id", "source_type", "status", "created_at"],
                        "properties": {
                            "_id": {"bsonType": "objectId"},
                            "room_id": {
                                "bsonType": "string",
                                "description": "ID of the room"
                            },
                            "source_type": {
                                "bsonType": "string",
                                "enum": ["local", "drive"],
                                "description": "Type of import source"
                            },
                            "source_path": {
                                "bsonType": "string",
                                "description": "Source path or folder ID"
                            },
                            "status": {
                                "bsonType": "string",
                                "enum": ["pending", "processing", "completed", "failed"],
                                "description": "Import job status"
                            },
                            "total_photos": {
                                "bsonType": "int",
                                "description": "Total photos to import"
                            },
                            "processed_photos": {
                                "bsonType": "int",
                                "description": "Photos imported so far"
                            },
                            "created_at": {
                                "bsonType": "date",
                                "description": "Job creation timestamp"
                            }
                        }
                    }
                }
            )
            
            # Create indexes
            await self.db['import_jobs'].create_index("room_id")
            await self.db['import_jobs'].create_index("status")
            logger.info("✓ 'import_jobs' collection created with indexes")
        
        except Exception as e:
            if "already exists" in str(e):
                logger.info("✓ 'import_jobs' collection already exists")
            else:
                raise
    
    async def create_export_jobs_collection(self):
        """
        Create export_jobs collection (tracks photo export progress)
        
        Schema:
        - _id: ObjectId
        - room_id: string
        - top_n: number (how many top photos to export)
        - destination_type: string (local, drive)
        - destination_path: string
        - status: string (pending, processing, completed, failed)
        - created_at: timestamp
        """
        logger.info("Creating 'export_jobs' collection...")
        
        try:
            await self.db.create_collection(
                "export_jobs",
                validator={
                    "$jsonSchema": {
                        "bsonType": "object",
                        "required": ["room_id", "top_n", "destination_type", "status", "created_at"],
                        "properties": {
                            "_id": {"bsonType": "objectId"},
                            "room_id": {
                                "bsonType": "string",
                                "description": "ID of the room"
                            },
                            "top_n": {
                                "bsonType": "int",
                                "description": "Number of top photos to export"
                            },
                            "destination_type": {
                                "bsonType": "string",
                                "enum": ["local", "drive"],
                                "description": "Export destination type"
                            },
                            "destination_path": {
                                "bsonType": "string",
                                "description": "Destination path or folder ID"
                            },
                            "status": {
                                "bsonType": "string",
                                "enum": ["pending", "processing", "completed", "failed"],
                                "description": "Export job status"
                            },
                            "created_at": {
                                "bsonType": "date",
                                "description": "Job creation timestamp"
                            }
                        }
                    }
                }
            )
            
            # Create indexes
            await self.db['export_jobs'].create_index("room_id")
            await self.db['export_jobs'].create_index("status")
            logger.info("✓ 'export_jobs' collection created with indexes")
        
        except Exception as e:
            if "already exists" in str(e):
                logger.info("✓ 'export_jobs' collection already exists")
            else:
                raise
```

---

## Integration with FastAPI Server

Update your **backend/server.py** to run initialization on startup:

```python
from fastapi import FastAPI
from contextlib import asynccontextmanager
from database.init_db import DatabaseInitializer

# ... your existing imports ...

db_initializer = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown"""
    # Startup
    logger.info("Application starting up...")
    initializer = DatabaseInitializer(db)
    await initializer.initialize()
    
    yield
    
    # Shutdown
    logger.info("Application shutting down...")
    client.close()

# Create the main app with lifespan
app = FastAPI(title="VowSelect API", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ... rest of your code ...
```

---

## What Gets Created

### Collections Structure

```
vowselect (Database)
├── users
│   ├── _id: ObjectId
│   ├── username: string (unique index)
│   └── created_at: timestamp
│
├── rooms
│   ├── _id: ObjectId
│   ├── code: string (unique index)
│   ├── creator_id: string (indexed)
│   ├── created_at: timestamp
│   └── status: string
│
├── room_participants
│   ├── _id: ObjectId
│   ├── room_id: string (composite unique index with user_id)
│   ├── user_id: string (indexed)
│   ├── username: string
│   └── joined_at: timestamp
│
├── photos
│   ├── _id: ObjectId
│   ├── room_id: string (indexed)
│   ├── source_type: string
│   ├── path: string (optional)
│   ├── drive_id: string (optional)
│   ├── drive_thumbnail_url: string (optional)
│   ├── filename: string
│   ├── index: number (composite index with room_id)
│   └── created_at: timestamp
│
├── votes
│   ├── _id: ObjectId
│   ├── room_id: string (indexed)
│   ├── photo_id: string (indexed)
│   ├── user_id: string (indexed)
│   ├── score: number (-3 to +3)
│   └── timestamp: timestamp (composite unique index with room_id, photo_id, user_id)
│
├── import_jobs
│   ├── _id: ObjectId
│   ├── room_id: string (indexed)
│   ├── source_type: string
│   ├── source_path: string
│   ├── status: string (indexed)
│   ├── total_photos: number
│   ├── processed_photos: number
│   └── created_at: timestamp
│
└── export_jobs
    ├── _id: ObjectId
    ├── room_id: string (indexed)
    ├── top_n: number
    ├── destination_type: string
    ├── destination_path: string
    ├── status: string (indexed)
    └── created_at: timestamp
```

---

## Indexes Explained

Indexes improve query performance. VowSelect creates these indexes:

### Primary Indexes (Single Field)
```
users.username - Unique, fast username lookups
rooms.code - Unique, fast room code lookups
rooms.creator_id - Fast lookup of rooms by creator
photos.room_id - Fast lookup of photos in a room
votes.room_id - Fast lookup of votes for a room
votes.photo_id - Fast lookup of votes for a photo
votes.user_id - Fast lookup of votes by user
```

### Composite Indexes (Multiple Fields)
```
room_participants(room_id, user_id) - Unique, prevents duplicate entries
photos(room_id, index) - Fast ordered lookup of photos
votes(room_id, photo_id, user_id) - Unique, prevents duplicate votes
```

---

## Data Validation

Each collection has JSON Schema validation:

```javascript
// Example: Users must have username and created_at
{
  "username": "john_doe",      // Required, string
  "created_at": ISODate(...)   // Required, date
}

// Example: Votes must have valid scores
{
  "score": 3,  // Must be -3, -2, -1, 1, 2, or 3
  "timestamp": ISODate(...)
}

// Example: Room status must be valid
{
  "status": "active"  // Must be "active", "completed", or "archived"
}
```

---

## Manual Collection Creation (MongoDB CLI)

If you want to create collections manually in MongoDB Shell:

```javascript
// Connect to MongoDB
use vowselect

// Create users collection
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["username", "created_at"],
      properties: {
        username: {bsonType: "string"},
        created_at: {bsonType: "date"}
      }
    }
  }
})

// Create index on username
db.users.createIndex({username: 1}, {unique: true})

// Similarly for other collections...
```

---

## Checking Collections

After the server starts, verify collections were created:

```bash
# In MongoDB shell
show collections

# Output should show:
# export_jobs
# import_jobs
# photos
# room_participants
# rooms
# users
# votes
```

---

## Summary

✅ **Collections are created automatically** when first document is inserted
✅ **Initialization script** creates them explicitly on server startup  
✅ **Indexes** are created for performance optimization
✅ **Validation rules** ensure data integrity
✅ **No manual setup needed** - everything happens automatically!

When you start the backend server, it will:
1. Connect to MongoDB
2. Create all 7 collections
3. Set up all indexes
4. Set up validation rules
5. Log the progress

Your database will be ready to use! 🎉

