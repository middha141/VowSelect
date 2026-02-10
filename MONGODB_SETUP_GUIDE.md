# MongoDB Collections & Database Setup Guide

Complete guide on how MongoDB collections are created and managed in VowSelect.

---

## Quick Summary

**MongoDB collections are created automatically** in two ways:

1. **Implicit Creation**: When you insert the first document into a collection, MongoDB creates it automatically
2. **Explicit Creation** (Recommended): Using the `DatabaseInitializer` class that runs on server startup

VowSelect uses **explicit creation** for better control, validation, and performance.

---

## How It Works in VowSelect

### Step 1: Server Startup
```
1. FastAPI server starts
2. Database connection established
3. DatabaseInitializer runs
4. Collections are created with:
   - JSON Schema validation
   - Indexes for performance
   - Unique constraints
5. Server is ready to accept requests
```

### Step 2: Collections Are Ready
```
Users can start using the app immediately
All data is validated and indexed
No manual database setup needed
```

---

## The 7 Collections

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
  "source_type": "drive",  // "local", "drive", or "upload"
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

## Collection Relationships

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

## How Collections Are Created

### Option 1: Automatic (First Document Insertion)
```python
# This creates "users" collection automatically
await db['users'].insert_one({
    "username": "john",
    "created_at": datetime.utcnow()
})
```

**Pros:** Simple, no setup
**Cons:** No validation, no indexes, unpredictable

### Option 2: Explicit with Validation (Recommended)
```python
# This is what VowSelect does
from database.init_db import DatabaseInitializer

initializer = DatabaseInitializer(db)
await initializer.initialize()
```

**Pros:** Control, validation, indexes, predictable
**Cons:** Requires code

---

## The Initialization Process

### File: `backend/database/init_db.py`

The `DatabaseInitializer` class handles everything:

```python
class DatabaseInitializer:
    async def initialize(self):
        """Create all collections"""
        await self.create_users_collection()
        await self.create_rooms_collection()
        await self.create_room_participants_collection()
        await self.create_photos_collection()
        await self.create_votes_collection()
        await self.create_import_jobs_collection()
        await self.create_export_jobs_collection()
```

Each method:
1. Creates the collection
2. Adds JSON Schema validation
3. Creates necessary indexes
4. Handles "already exists" errors gracefully

### Integration in Server

Update `backend/server.py`:

```python
from contextlib import asynccontextmanager
from database.init_db import DatabaseInitializer

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    initializer = DatabaseInitializer(db)
    await initializer.initialize()
    yield
    # Shutdown
    client.close()

app = FastAPI(lifespan=lifespan)
```

---

## What Happens When Server Starts

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
5. Indexes are created
6. Validation rules are applied
7. Server logs: "✓ Database initialization completed successfully"
8. Server is ready!
```

---

## Checking Collections in MongoDB

### Using MongoDB Compass (GUI)
1. Connect to MongoDB
2. Select `vowselect` database
3. See all 7 collections listed

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

## Indexes Explained

Indexes speed up queries by creating sorted lookup tables.

### Simple Index
```python
await db['users'].create_index("username", unique=True)
```
- Fast username lookups
- Prevents duplicates

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

---

## JSON Schema Validation

Every collection has JSON Schema validation to ensure data integrity:

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
- Rejects invalid data
- Documents collection structure
- Prevents typos
- Enforces data types

---

## Adding Data to Collections

After collections are created, insert documents:

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

## Querying Collections

```python
# Find user by username
user = await db['users'].find_one({"username": "john_doe"})

# Find all rooms created by user
rooms = await db['rooms'].find({
    "creator_id": user_id
}).to_list(length=100)

# Find all photos in a room
photos = await db['photos'].find({
    "room_id": room_id
}).sort("index", 1).to_list(length=None)

# Find all votes for a photo
votes = await db['votes'].find({
    "photo_id": photo_id
}).to_list(length=None)

# Calculate average score
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

---

## Troubleshooting

### Collections not created?
1. Check server logs for errors
2. Verify MongoDB is running
3. Check `MONGO_URL` in `.env`

### Data not persisting?
1. Check MongoDB connection
2. Verify data is being inserted
3. Check for validation errors

### Queries are slow?
1. Check if indexes exist
2. Check query patterns
3. Add missing indexes

### "Collection already exists" error?
This is handled gracefully - server continues without error.

---

## Best Practices

✅ **DO:**
- Use the DatabaseInitializer on startup
- Create indexes for frequently queried fields
- Use validation to ensure data quality
- Document your collection schemas

❌ **DON'T:**
- Manually create collections in MongoDB Shell (let the code do it)
- Skip indexes (queries will be slow)
- Ignore validation errors
- Insert data before collections are created

---

## Summary

| Aspect | Details |
|--------|---------|
| **Collections** | 7 total (users, rooms, room_participants, photos, votes, import_jobs, export_jobs) |
| **Creation** | Automatic on server startup via DatabaseInitializer |
| **Validation** | JSON Schema validation on each collection |
| **Indexes** | 15+ indexes for performance |
| **Relationships** | Normalized with foreign key lookups |
| **Security** | Unique constraints prevent duplicates |
| **Scalability** | Indexed queries scale well with large datasets |

Your VowSelect database is fully managed and ready to scale! 🚀

