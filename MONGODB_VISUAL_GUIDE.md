# MongoDB Collections - Visual Guide

## Quick Visual Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    VowSelect Application                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend (Expo/React Native)  ←→  Backend (FastAPI/Python)    │
│                                           ↓                      │
│                                    MongoDB Database              │
│                                           ↓                      │
│                    ┌──────────────────────────────────┐         │
│                    │  vowselect (Database)           │         │
│                    ├──────────────────────────────────┤         │
│                    │  📝 users                        │         │
│                    │  🏠 rooms                        │         │
│                    │  👥 room_participants           │         │
│                    │  🖼️  photos                     │         │
│                    │  ⭐ votes                       │         │
│                    │  📥 import_jobs                 │         │
│                    │  📤 export_jobs                 │         │
│                    └──────────────────────────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Structure Diagram

```
┌─────────────┐
│   users     │
├─────────────┤
│ _id         │◄────────────────┐
│ username    │                 │
│ created_at  │                 │
└─────────────┘                 │
                                │
                    ┌───────────┴─────────┐
                    │                     │
              ┌─────▼───────┐      ┌──────▼──────┐
              │   rooms     │      │  room_      │
              ├─────────────┤      │  participants
              │ _id         │      ├──────────────┤
              │ code        │      │ room_id      │
              │ creator_id  │◄─────┤ user_id      │
              │ status      │      │ username     │
              │ created_at  │      │ joined_at    │
              └─────┬───────┘      └──────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    ┌────▼────────┐      ┌─────▼──────────┐
    │   photos    │      │ import_jobs    │
    ├─────────────┤      ├────────────────┤
    │ _id         │      │ _id            │
    │ room_id     │      │ room_id        │
    │ filename    │      │ source_type    │
    │ index       │      │ status         │
    │ source_type │      │ total_photos   │
    │ created_at  │      │ created_at     │
    └────┬────────┘      └────────────────┘
         │
         └────────┐
                  │
              ┌───▼──────┐      ┌──────────────┐
              │   votes  │      │ export_jobs  │
              ├──────────┤      ├──────────────┤
              │ _id      │      │ _id          │
              │ photo_id │      │ room_id      │
              │ user_id  │      │ top_n        │
              │ score    │      │ status       │
              │ timestamp│      │ created_at   │
              └──────────┘      └──────────────┘
```

---

## Server Startup Flow

```
┌──────────────────┐
│ Start uvicorn    │
└────────┬─────────┘
         │
         ↓
┌──────────────────────────┐
│ Load FastAPI app         │
└────────┬─────────────────┘
         │
         ↓
┌──────────────────────────┐
│ Run @lifespan startup    │
└────────┬─────────────────┘
         │
         ↓
┌──────────────────────────────────┐
│ DatabaseInitializer.initialize() │
└────────┬─────────────────────────┘
         │
         ├─→ Create users collection
         │
         ├─→ Create rooms collection
         │
         ├─→ Create room_participants collection
         │
         ├─→ Create photos collection
         │
         ├─→ Create votes collection
         │
         ├─→ Create import_jobs collection
         │
         └─→ Create export_jobs collection
         │
         ↓
┌──────────────────────────────┐
│ All collections ready!       │
│ All indexes created!         │
│ All validation rules set!    │
└────────┬─────────────────────┘
         │
         ↓
┌──────────────────────────────┐
│ Server accepting requests    │
│ ✓ Ready for frontend!        │
└──────────────────────────────┘
```

---

## User Journey & Collection Usage

```
1. User Opens App
   └─→ Creates account
       └─→ INSERT into 'users'
           {username: "john", created_at: now}

2. User Creates Room
   └─→ Generates 5-digit code
       └─→ INSERT into 'rooms'
           {code: "12345", creator_id: ..., status: "active"}

3. User Joins Room
   └─→ Records participation
       └─→ INSERT into 'room_participants'
           {room_id: ..., user_id: ..., joined_at: now}

4. User Imports Photos from Google Drive
   └─→ Starts import job
       └─→ INSERT into 'import_jobs'
           {room_id: ..., status: "processing", total_photos: 50}
   
   └─→ Photos imported
       └─→ INSERT INTO 'photos' (× 50)
           {room_id: ..., filename: "photo1.jpg", source_type: "drive"}
   
   └─→ Update import job
       └─→ UPDATE 'import_jobs'
           {status: "completed", processed_photos: 50}

5. User Votes on Photos
   └─→ For each vote
       └─→ INSERT into 'votes'
           {room_id: ..., photo_id: ..., user_id: ..., score: 3}
   
   └─→ See rankings (calculated from votes)
       └─→ AGGREGATE 'votes'
           Group by photo_id, calculate average score

6. User Exports Top Photos
   └─→ Starts export job
       └─→ INSERT into 'export_jobs'
           {room_id: ..., top_n: 10, status: "processing"}
   
   └─→ Photos exported
       └─→ UPDATE 'export_jobs'
           {status: "completed"}
```

---

## Index Architecture

```
┌──────────────────────────────────────┐
│         Index Strategy               │
├──────────────────────────────────────┤
│                                      │
│ UNIQUE INDEXES (Prevent Duplicates)  │
│ ├─ users.username                    │
│ ├─ rooms.code                        │
│ ├─ room_participants(room_id,        │
│ │  user_id)                          │
│ └─ votes(room_id, photo_id,          │
│    user_id)                          │
│                                      │
│ SINGLE-FIELD INDEXES (Fast Lookups)  │
│ ├─ rooms.creator_id                  │
│ ├─ room_participants.room_id         │
│ ├─ room_participants.user_id         │
│ ├─ photos.room_id                    │
│ ├─ votes.room_id                     │
│ ├─ votes.photo_id                    │
│ ├─ votes.user_id                     │
│ ├─ import_jobs.room_id               │
│ ├─ import_jobs.status                │
│ ├─ export_jobs.room_id               │
│ └─ export_jobs.status                │
│                                      │
│ COMPOSITE INDEXES (Multi-field)      │
│ ├─ photos(room_id, index)            │
│ └─ votes(room_id, photo_id, user_id) │
│                                      │
└──────────────────────────────────────┘
```

---

## Query Performance

```
┌──────────────────────────────────────────────────┐
│ Query Type           │ Without Index │ With Index │
├──────────────────────┼───────────────┼────────────┤
│ Find user by ID      │ Slow (scan)   │ ✓ Fast     │
│ Find room by code    │ Slow (scan)   │ ✓ Fast     │
│ Find user's rooms    │ Slow (scan)   │ ✓ Fast     │
│ Find room photos     │ Slow (scan)   │ ✓ Fast     │
│ Find photo votes     │ Slow (scan)   │ ✓ Fast     │
│ Calculate ranking    │ Slow (scan)   │ ✓ Fast     │
│ Prevent duplicates   │ Unreliable    │ ✓ Reliable │
└──────────────────────┴───────────────┴────────────┘
```

---

## Collection Sizes (Example)

```
For a wedding with 100 guests voting on 500 photos:

Collection          │ Document Count │ Approx Size
────────────────────┼────────────────┼──────────
users               │ 100            │ 50 KB
rooms               │ 1              │ 1 KB
room_participants   │ 100            │ 50 KB
photos              │ 500            │ 250 KB
votes               │ 50,000*        │ 2.5 MB
import_jobs         │ 5              │ 5 KB
export_jobs         │ 10             │ 10 KB
────────────────────┼────────────────┼──────────
TOTAL               │ ~50,600        │ ~2.9 MB

*Each guest votes on all 500 photos = 100 × 500 = 50,000 votes

Database scales efficiently even with large numbers! ✓
```

---

## Error Prevention

```
┌─────────────────────────────────────┐
│   JSON Schema Validation            │
├─────────────────────────────────────┤
│                                     │
│ users collection:                   │
│ ✓ username must be string           │
│ ✓ created_at must be date           │
│ ✓ Both fields required              │
│                                     │
│ votes collection:                   │
│ ✓ score must be -3,-2,-1,1,2, or 3 │
│ ✓ All fields required               │
│ ✓ Only one vote per user/photo      │
│                                     │
│ rooms collection:                   │
│ ✓ status must be active/completed   │
│ ✓ code must be unique               │
│ ✓ All fields required               │
│                                     │
└─────────────────────────────────────┘

Benefits:
✓ Invalid data is rejected at insert
✓ No corrupted data in database
✓ Type safety guaranteed
✓ Constraints enforced
```

---

## Initialization Checklist

When server starts:

```
Server Start
  ↓
☐ Connect to MongoDB
  ↓
☐ Create users collection
  ☐ Add username index
  ☐ Add JSON Schema validation
  ↓
☐ Create rooms collection
  ☐ Add code index
  ☐ Add creator_id index
  ☐ Add JSON Schema validation
  ↓
☐ Create room_participants collection
  ☐ Add composite index (room_id, user_id)
  ☐ Add room_id index
  ☐ Add user_id index
  ☐ Add JSON Schema validation
  ↓
☐ Create photos collection
  ☐ Add room_id index
  ☐ Add composite index (room_id, index)
  ☐ Add JSON Schema validation
  ↓
☐ Create votes collection
  ☐ Add composite index (room_id, photo_id, user_id)
  ☐ Add room_id index
  ☐ Add photo_id index
  ☐ Add user_id index
  ☐ Add JSON Schema validation
  ↓
☐ Create import_jobs collection
  ☐ Add room_id index
  ☐ Add status index
  ☐ Add JSON Schema validation
  ↓
☐ Create export_jobs collection
  ☐ Add room_id index
  ☐ Add status index
  ☐ Add JSON Schema validation
  ↓
✓ ALL COMPLETE - Server Ready!
```

---

## File Organization

```
VowSelect/
├── backend/
│   ├── server.py                    # FastAPI app (updated)
│   ├── .env                         # Configuration
│   ├── requirements_clean.txt       # Dependencies
│   ├── venv/                        # Virtual environment
│   ├── database/                    # NEW: Database package
│   │   ├── __init__.py              # NEW: Package init
│   │   └── init_db.py               # NEW: DatabaseInitializer
│   └── ...other files...
│
├── MONGODB_COLLECTIONS.md           # Detailed guide
├── MONGODB_SETUP_GUIDE.md           # Complete reference
├── MONGODB_QUICK_REFERENCE.md       # Quick lookup
└── DATABASE_INTEGRATION.md          # Integration steps
```

---

## Summary Table

```
┌──────────────────┬────────┬──────────┬─────────────────┐
│ Collection       │ Docs   │ Indexes  │ Validation      │
├──────────────────┼────────┼──────────┼─────────────────┤
│ users            │ Var    │ 1        │ ✓ Required      │
│ rooms            │ Var    │ 2        │ ✓ Status enum   │
│ room_participants│ Var    │ 3        │ ✓ Required      │
│ photos           │ Var    │ 2        │ ✓ Source type   │
│ votes            │ Var    │ 4        │ ✓ Score enum    │
│ import_jobs      │ Var    │ 2        │ ✓ Status enum   │
│ export_jobs      │ Var    │ 2        │ ✓ Status enum   │
└──────────────────┴────────┴──────────┴─────────────────┘
```

---

You now have a complete visual understanding of how MongoDB collections are created and used in VowSelect! 🎉

