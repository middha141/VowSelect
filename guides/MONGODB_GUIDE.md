# MongoDB Guide for VowSelect

A comprehensive guide to MongoDB collections, setup, integration, and best practices for VowSelect.

---

## 📋 Quick Reference

### Collections at a Glance

| # | Collection | Purpose | Docs |
|---|-----------|---------|------|
| 1 | **users** | User accounts | ~100-1000 |
| 2 | **rooms** | Photo selection rooms | ~10-100 |
| 3 | **room_participants** | Room memberships | ~100-10000 |
| 4 | **photos** | Photo references | ~100-10000 |
| 5 | **votes** | Voting scores | ~1000-100000 |
| 6 | **import_jobs** | Import progress | ~50-500 |
| 7 | **export_jobs** | Export progress | ~50-500 |

### Server Startup Flow

```
Server Starts
    ↓
Connect to MongoDB
    ↓
DatabaseInitializer runs
    ↓
Create each collection with:
  - JSON Schema validation
  - Indexes for performance
  - Unique constraints
    ↓
Collections ready for use ✓
```

**Result:** Collections are created **automatically** when the server starts. No manual setup needed!

---

## 🏗️ Understanding MongoDB

MongoDB is a NoSQL database that stores data in **collections** (similar to SQL tables) with **documents** (similar to rows).

### Automatic vs Explicit Creation

**Automatic Creation (Default):**
```python
# This creates "users" collection automatically
await db['users'].insert_one({
    "username": "john",
    "created_at": datetime.utcnow()
})
```
- **Pros:** Simple, no setup required
- **Cons:** No validation, no indexes, unpredictable

**Explicit Creation (Recommended - VowSelect's approach):**
```python
# Explicitly create collections with validation and indexes
from database.init_db import DatabaseInitializer

initializer = DatabaseInitializer(db)
await initializer.initialize()
```
- **Pros:** Control, validation, indexes, predictable
- **Cons:** Requires code (but it's automatic on server startup!)

---

## 📊 Complete Collection Schemas

### 1. **users** - User Accounts

Stores guest user information.

```javascript
{
  "_id": ObjectId("..."),
  "username": "john_doe",
  "created_at": ISODate("2026-02-08T...")
}
```

**Indexes:**
- `username` (unique) - Prevent duplicate usernames

**Schema Validation:**
```json
{
  "required": ["username", "created_at"],
  "properties": {
    "username": {"bsonType": "string"},
    "created_at": {"bsonType": "date"}
  }
}
```

---

### 2. **rooms** - Selection Rooms

Stores room metadata and configuration.

```javascript
{
  "_id": ObjectId("..."),
  "code": "12345",
  "creator_id": ObjectId("..."),
  "created_at": ISODate("2026-02-08T..."),
  "status": "active"
}
```

**Indexes:**
- `code` (unique) - One room per code
- `creator_id` - Find rooms by creator

**Statuses:**
- `active` - Room is accepting votes
- `completed` - Voting finished
- `archived` - Room is archived

**Schema Validation:**
```json
{
  "required": ["code", "creator_id", "created_at", "status"],
  "properties": {
    "code": {"bsonType": "string"},
    "creator_id": {"bsonType": "string"},
    "created_at": {"bsonType": "date"},
    "status": {"enum": ["active", "completed", "archived"]}
  }
}
```

---

### 3. **room_participants** - Room Membership

Tracks which users are in which rooms.

```javascript
{
  "_id": ObjectId("..."),
  "room_id": ObjectId("..."),
  "user_id": ObjectId("..."),
  "username": "john_doe",
  "joined_at": ISODate("2026-02-08T...")
}
```

**Indexes:**
- `room_id` + `user_id` (unique composite) - One entry per user per room
- `room_id` - Find participants in a room
- `user_id` - Find rooms user joined

---

### 4. **photos** - Photo References

Stores photo metadata and source information.

```javascript
{
  "_id": ObjectId("..."),
  "room_id": ObjectId("..."),
  "source_type": "drive",
  "drive_id": "abc123...",
  "drive_thumbnail_url": "https://...",
  "filename": "wedding-photo-1.jpg",
  "index": 0,
  "created_at": ISODate("2026-02-08T...")
}
```

**Indexes:**
- `room_id` - Find photos in a room
- `room_id` + `index` - Get ordered photos

**Source Types:**
- `local` - File path on local system
- `drive` - Google Drive file
- `upload` - User uploaded file

---

### 5. **votes** - User Votes

Stores voting scores for photos.

```javascript
{
  "_id": ObjectId("..."),
  "room_id": ObjectId("..."),
  "photo_id": ObjectId("..."),
  "user_id": ObjectId("..."),
  "score": 3,
  "timestamp": ISODate("2026-02-08T...")
}
```

**Indexes:**
- `room_id` + `photo_id` + `user_id` (unique composite) - One vote per user per photo
- `room_id` - Find votes in a room
- `photo_id` - Find votes for a photo
- `user_id` - Find votes by user

**Valid Scores:**
- `-3` - Definitely exclude
- `-2` - Don't like
- `-1` - Not great
- `+1` - Pretty good
- `+2` - Really like
- `+3` - Must include

---

### 6. **import_jobs** - Import Tracking

Tracks progress of photo imports.

```javascript
{
  "_id": ObjectId("..."),
  "room_id": ObjectId("..."),
  "source_type": "drive",
  "source_path": "folder_id_123",
  "status": "completed",
  "total_photos": 50,
  "processed_photos": 50,
  "created_at": ISODate("2026-02-08T...")
}
```

**Indexes:**
- `room_id` - Find imports for a room
- `status` - Find jobs by status

**Statuses:**
- `pending` - Waiting to start
- `processing` - Currently importing  
- `completed` - Import finished
- `failed` - Import failed

---

### 7. **export_jobs** - Export Tracking

Tracks progress of photo exports.

```javascript
{
  "_id": ObjectId("..."),
  "room_id": ObjectId("..."),
  "top_n": 10,
  "destination_type": "local",
  "destination_path": "C:/exports",
  "status": "completed",
  "created_at": ISODate("2026-02-08T...")
}
```

**Indexes:**
- `room_id` - Find exports for a room
- `status` - Find jobs by status

**Statuses:**
- `pending` - Waiting to start
- `processing` - Currently exporting
- `completed` - Export finished
- `failed` - Export failed

---

## 🔗 Collection Relationships

```
rooms
  ├─ creator_id ──→ users
  ├─ room_participants[room_id] ──→ room_participants
  │   └─ user_id ──→ users
  ├─ photos[room_id] ──→ photos
  │   ├─ votes[photo_id] ──→ votes
  │   │   └─ user_id ──→ users
  │   └─ import_jobs[room_id] ──→ import_jobs
  └─ export_jobs[room_id] ──→ export_jobs
```

---

## 🚀 Integration with FastAPI

### Step 1: Create Initialization Module

**File:** `backend/database/init_db.py`

This file contains the `DatabaseInitializer` class that creates all collections on startup.

### Step 2: Update Server Configuration

**File:** `backend/server.py`

Add the lifespan handler to initialize the database on startup:

```python
from contextlib import asynccontextmanager
from database.init_db import DatabaseInitializer
from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB setup
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown"""
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

# Create app with lifespan
app = FastAPI(
    title="VowSelect API",
    lifespan=lifespan
)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 📈 Visual Database Structure

```
┌─────────────────────────────────────────────────────────────┐
│                  VowSelect Application                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (Expo/React Native) ←→ Backend (FastAPI/Python)  │
│                                       ↓                     │
│                              MongoDB Database                │
│                                       ↓                     │
│              ┌──────────────────────────────────┐           │
│              │  vowselect (Database)           │           │
│              ├──────────────────────────────────┤           │
│              │  📝 users                        │           │
│              │  🏠 rooms                        │           │
│              │  👥 room_participants           │           │
│              │  🖼️  photos                     │           │
│              │  ⭐ votes                       │           │
│              │  📥 import_jobs                 │           │
│              │  📤 export_jobs                 │           │
│              └──────────────────────────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 💾 Server Startup Initialization

### What Happens When Server Starts

```
1. Server initializes
2. MongoDB connection established
3. DatabaseInitializer.initialize() called
4. Each collection is created:
   ✓ users
   ✓ rooms
   ✓ room_participants
   ✓ photos
   ✓ votes
   ✓ import_jobs
   ✓ export_jobs
5. Indexes are created (15+ total)
6. Validation rules are applied
7. Server logs: "✓ Database initialization completed successfully"
8. Server is ready! ✨
```

### Example Server Logs

```
INFO:     Initializing MongoDB database...
INFO:     Creating 'users' collection...
✓ 'users' collection created with indexes
INFO:     Creating 'rooms' collection...
✓ 'rooms' collection created with indexes
INFO:     Creating 'room_participants' collection...
✓ 'room_participants' collection created with indexes
INFO:     Creating 'photos' collection...
✓ 'photos' collection created with indexes
INFO:     Creating 'votes' collection...
✓ 'votes' collection created with indexes
INFO:     Creating 'import_jobs' collection...
✓ 'import_jobs' collection created with indexes
INFO:     Creating 'export_jobs' collection...
✓ 'export_jobs' collection created with indexes
INFO:     ✓ Database initialization completed successfully
```

---

## 🔍 Verifying Collections

### Using MongoDB Compass (GUI)
1. Open MongoDB Compass
2. Connect to MongoDB
3. Select `vowselect` database
4. See all 7 collections listed

### Using MongoDB Shell
```javascript
use vowselect
show collections

// Output:
// export_jobs
// import_jobs
// photos
// room_participants
// rooms
// users
// votes
```

### Using Python
```python
collections = await db.list_collection_names()
print(collections)
# Output: ['users', 'rooms', 'room_participants', 'photos', 'votes', 'import_jobs', 'export_jobs']
```

---

## 📚 Working with Collections

### Querying Examples

```python
# Find user by username
user = await db['users'].find_one({"username": "john_doe"})

# Find all rooms created by user
rooms = await db['rooms'].find({
    "creator_id": user_id
}).to_list(length=100)

# Find all photos in a room (ordered)
photos = await db['photos'].find({
    "room_id": room_id
}).sort("index", 1).to_list(length=None)

# Find all votes for a photo
votes = await db['votes'].find({
    "photo_id": photo_id
}).to_list(length=None)

# Calculate average score for a photo
pipeline = [
    {"$match": {"photo_id": ObjectId(photo_id)}},
    {"$group": {
        "_id": "$photo_id",
        "avg_score": {"$avg": "$score"},
        "vote_count": {"$sum": 1}
    }}
]
result = await db['votes'].aggregate(pipeline).to_list(length=1)
```

### Inserting Data

```python
# Create a user
user = await db['users'].insert_one({
    "username": "john_doe",
    "created_at": datetime.utcnow()
})

# Create a room
room = await db['rooms'].insert_one({
    "code": "12345",
    "creator_id": str(user.inserted_id),
    "created_at": datetime.utcnow(),
    "status": "active"
})

# Add a participant
await db['room_participants'].insert_one({
    "room_id": str(room.inserted_id),
    "user_id": str(user.inserted_id),
    "username": "john_doe",
    "joined_at": datetime.utcnow()
})
```

---

## 🎯 Indexes Explained

Indexes speed up queries by creating sorted lookup tables.

### Simple Index
```python
await db['users'].create_index("username", unique=True)
```
- Fast username lookups
- Prevents duplicate usernames
- Automatically enforced

### Composite Index
```python
await db['votes'].create_index(
    [("room_id", 1), ("photo_id", 1), ("user_id", 1)],
    unique=True
)
```
- Fast lookup by all three fields
- Prevents duplicate votes
- Ensures one vote per user per photo

### Index Performance Impact

| Operation | Without Index | With Index |
|-----------|-------------|-----------|
| Find by username | ~100ms (1000 docs) | ~1ms |
| Find votes for photo | ~200ms (10000 votes) | ~5ms |
| Update user | ~50ms | ~5ms |

---

## ✅ Data Validation

Each collection has JSON Schema validation to ensure data integrity:

```python
validator={
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["username", "created_at"],
        "properties": {
            "username": {"bsonType": "string"},
            "created_at": {"bsonType": "date"}
        }
    }
}
```

**Benefits:**
- ✅ Rejects invalid data
- ✅ Documents collection structure
- ✅ Prevents typos
- ✅ Enforces data types
- ✅ Prevents "score: 0" in votes (only -3 to 3 allowed)

---

## 🛠️ Troubleshooting

### Collections Not Created?
1. Check server logs for errors
2. Verify MongoDB is running
3. Check `MONGO_URL` in `.env`
4. Ensure `DB_NAME` is set

### Data Not Persisting?
1. Check MongoDB connection
2. Verify data is being inserted
3. Check for validation errors in logs

### Queries Are Slow?
1. Check if indexes exist
2. Verify index on queried fields
3. Add missing indexes if needed

### "Collection Already Exists" Error?
This is handled gracefully - server continues without error. No problem!

---

## 📈 Typical Data Flow

```
1. User creates account
   → Document inserted into 'users'
   
2. User creates room
   → Document inserted into 'rooms'
   
3. User joins room
   → Document inserted into 'room_participants'
   
4. User imports photos
   → ImportJob created in 'import_jobs'
   → Multiple documents inserted into 'photos'
   
5. User votes on photos
   → Document inserted into 'votes' for each vote
   
6. User exports top photos
   → ExportJob created in 'export_jobs'
```

---

## ✨ Best Practices

✅ **DO:**
- Use the DatabaseInitializer on startup
- Create indexes for frequently queried fields
- Use validation to ensure data quality
- Document your collection schemas
- Handle "collection already exists" errors gracefully

❌ **DON'T:**
- Manually create collections in MongoDB Shell (let the code do it)
- Skip indexes (queries will be slow)
- Ignore validation errors
- Insert data before collections are created
- Store duplicate data (use references instead)

---

## 📚 Summary Table

| Aspect | Details |
|--------|---------|
| **Collections** | 7 total (users, rooms, room_participants, photos, votes, import_jobs, export_jobs) |
| **Creation** | Automatic on server startup via DatabaseInitializer |
| **Validation** | JSON Schema validation on each collection |
| **Indexes** | 15+ indexes for performance |
| **Relationships** | Normalized with foreign key lookups |
| **Security** | Unique constraints prevent duplicates |
| **Scalability** | Indexed queries scale well with large datasets |

---

## 🚀 You're Ready!

Your VowSelect database is fully managed and ready to scale. Collections are created automatically, data is validated, and queries are fast.

Start the backend server and watch the database initialization happen automatically! ✨
