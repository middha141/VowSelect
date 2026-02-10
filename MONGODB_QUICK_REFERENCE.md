# MongoDB Collections - Quick Reference

## The Short Answer

MongoDB collections are **created automatically** when the VowSelect server starts.

There are **7 collections** in total:

| # | Collection | Purpose |
|---|-----------|---------|
| 1 | **users** | User accounts |
| 2 | **rooms** | Photo selection rooms |
| 3 | **room_participants** | Room memberships |
| 4 | **photos** | Photo references |
| 5 | **votes** | User voting scores |
| 6 | **import_jobs** | Import progress tracking |
| 7 | **export_jobs** | Export progress tracking |

---

## How Collections Are Created

### Process
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
Collections ready for use
```

### Code Location
- **File**: `backend/database/init_db.py`
- **Class**: `DatabaseInitializer`
- **Method**: `initialize()`

### When It Happens
- **Automatic**: Every time the server starts
- **Manual**: You can also run it programmatically

---

## Collection Structure

### 1. users
```javascript
{
  "_id": ObjectId,
  "username": "john_doe",        // unique index
  "created_at": ISODate
}
```

### 2. rooms
```javascript
{
  "_id": ObjectId,
  "code": "12345",               // unique index
  "creator_id": ObjectId,        // indexed
  "created_at": ISODate,
  "status": "active"             // active, completed, archived
}
```

### 3. room_participants
```javascript
{
  "_id": ObjectId,
  "room_id": ObjectId,           // composite unique with user_id
  "user_id": ObjectId,           // indexed
  "username": "john_doe",
  "joined_at": ISODate
}
```

### 4. photos
```javascript
{
  "_id": ObjectId,
  "room_id": ObjectId,           // indexed
  "source_type": "drive",        // local, drive, upload
  "filename": "photo.jpg",
  "index": 0,
  "drive_id": "abc123",          // optional
  "drive_thumbnail_url": "...",  // optional
  "path": "/path/to/file",       // optional
  "base64_data": "...",          // optional
  "created_at": ISODate
}
```

### 5. votes
```javascript
{
  "_id": ObjectId,
  "room_id": ObjectId,           // indexed
  "photo_id": ObjectId,          // indexed
  "user_id": ObjectId,           // indexed
  "score": 3,                    // -3 to +3
  "timestamp": ISODate
  // Composite unique index on (room_id, photo_id, user_id)
}
```

### 6. import_jobs
```javascript
{
  "_id": ObjectId,
  "room_id": ObjectId,           // indexed
  "source_type": "drive",        // local, drive
  "source_path": "folder_id",
  "status": "completed",         // pending, processing, completed, failed
  "total_photos": 50,
  "processed_photos": 50,
  "created_at": ISODate
}
```

### 7. export_jobs
```javascript
{
  "_id": ObjectId,
  "room_id": ObjectId,           // indexed
  "top_n": 10,
  "destination_type": "local",   // local, drive
  "destination_path": "/path",
  "status": "completed",         // pending, processing, completed, failed
  "created_at": ISODate
}
```

---

## Indexes Created

**Unique Indexes:**
- `users.username`
- `rooms.code`
- `room_participants(room_id, user_id)`
- `votes(room_id, photo_id, user_id)`

**Single Field Indexes:**
- `rooms.creator_id`
- `room_participants.room_id`
- `room_participants.user_id`
- `photos.room_id`
- `votes.room_id`
- `votes.photo_id`
- `votes.user_id`
- `import_jobs.room_id`
- `import_jobs.status`
- `export_jobs.room_id`
- `export_jobs.status`

**Composite Indexes:**
- `photos(room_id, index)`

---

## What You Need to Do

### Nothing! ✅

Collections are created automatically when the server starts.

### But if you want to verify:

**Option 1: Check server logs**
```
INFO:     Initializing MongoDB database...
INFO:     Creating 'users' collection...
✓ 'users' collection created with indexes
INFO:     Creating 'rooms' collection...
✓ 'rooms' collection created with indexes
...
INFO:     ✓ Database initialization completed successfully
```

**Option 2: Use MongoDB Compass**
- Open MongoDB Compass
- Connect to MongoDB
- Select `vowselect` database
- See all 7 collections

**Option 3: Use MongoDB Shell**
```javascript
use vowselect
show collections
```

---

## Data Validation

Each collection has JSON Schema validation that:
- Enforces required fields
- Validates data types
- Restricts allowed values (enums)
- Prevents invalid data insertion

Example: Votes must have a score of -3, -2, -1, 1, 2, or 3:
```javascript
{
  "score": 0  // ❌ INVALID - rejected
}

{
  "score": 3  // ✅ VALID - accepted
}
```

---

## Performance

Collections are optimized with:
- **15+ indexes** for fast queries
- **Composite indexes** for common multi-field searches
- **Unique constraints** preventing duplicates
- **Sorted queries** for ordered results

Result: Fast, efficient data access even with thousands of photos! ⚡

---

## Typical Data Flow

```
1. User creates account
   → Document inserted into 'users' collection

2. User creates room
   → Document inserted into 'rooms' collection

3. User joins room
   → Document inserted into 'room_participants' collection

4. User imports photos
   → ImportJob created in 'import_jobs' collection
   → Multiple documents inserted into 'photos' collection

5. User votes on photos
   → Document inserted into 'votes' collection for each vote

6. User exports top photos
   → ExportJob created in 'export_jobs' collection
```

---

## Files Related to Collections

| File | Purpose |
|------|---------|
| `backend/database/init_db.py` | DatabaseInitializer class |
| `backend/database/__init__.py` | Package init |
| `backend/server.py` | Calls initializer on startup |
| `MONGODB_COLLECTIONS.md` | Detailed guide |
| `MONGODB_SETUP_GUIDE.md` | Complete reference |

---

## Next Steps

1. ✅ Server is running
2. ✅ Collections are created automatically
3. ✅ Data is validated
4. ✅ Indexes are optimized

You're ready to start using VowSelect! 🚀

---

## FAQ

**Q: Do I need to manually create collections?**
A: No! They're created automatically on server startup.

**Q: What if a collection already exists?**
A: The initializer gracefully skips it and continues.

**Q: Can I add new collections later?**
A: Yes, just add a new method to DatabaseInitializer.

**Q: What if MongoDB is not running?**
A: Server startup will fail with a clear error message.

**Q: Can I delete and recreate collections?**
A: Yes, manually drop them in MongoDB, then restart the server.

