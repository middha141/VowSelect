# VowSelect - Wedding Photo Selection & Ranking App

A collaborative wedding photo selection app with Tinder-style swipe interface and multi-user scoring system.

## 🎯 Features

### Core Features
- **Guest Mode**: Skip authentication and start immediately with just a username
- **Room System**: Create or join selection rooms with unique 5-digit codes
- **Photo Import**: 
  - Local folder/file paths
  - Google Drive integration (folder scanning with recursive support)
- **Tinder-Style Swipe Interface**: Smooth gesture-based voting
- **Multi-User Voting**: 
  - Score photos from -3 to +3
  - Real-time progress tracking
  - Undo last vote capability
- **Weighted Rankings**: Calculate average scores across all users
- **Export Feature**: Export top N photos with CSV reports

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React Native (Expo) + TypeScript
- **Backend**: FastAPI + Python
- **Database**: MongoDB
- **Storage**: Reference-based (paths/Drive IDs only, no photo duplication)

### Database Models
1. **User**: Guest user management
2. **Room**: Selection room with 5-digit code
3. **RoomParticipant**: Users in a room
4. **Photo**: Photo references with source info
5. **Vote**: User votes with scores
6. **ImportJob**: Photo import tracking
7. **ExportJob**: Export job tracking

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB
- Expo CLI

### Installation

1. **Backend Setup**
```bash
cd backend
pip install -r requirements.txt

# Configure .env
# MONGO_URL=mongodb://localhost:27017
# DB_NAME=vowselect
```

2. **Frontend Setup**
```bash
cd frontend
yarn install

# .env is already configured
# EXPO_PUBLIC_BACKEND_URL will point to the correct backend
```

3. **Start Services**
```bash
# Backend
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8001

# Frontend
cd frontend
yarn start
```

## 📱 User Flow

### 1. Landing Page
- Set username (guest mode)
- Create new room → Get 5-digit code
- Join existing room → Enter code

### 2. Room Screen
- View room code and participants
- Import photos:
  - **Local**: Enter file paths (one per line)
  - **Google Drive**: Enter folder ID and access token
- Start voting or view rankings

### 3. Swipe Interface
- Swipe right for positive (shows +1, +2, +3 buttons)
- Swipe left for negative (shows -1, -2, -3 buttons)
- Select score to confirm
- Undo last vote anytime
- Progress indicator (e.g., 34/520 photos)

### 4. Rankings Screen
- View all photos sorted by weighted score
- Shows rank, filename, score, vote count
- Export top N photos

### 5. Export
- Select number of top photos
- Choose destination (local/Drive)
- Get CSV report with rankings

## 🎨 UI/UX Highlights

### Mobile-First Design
- Pink/purple wedding theme (#D946B2)
- Smooth animations and gestures
- Card stack interaction
- Touch-friendly buttons (min 44x44pt)

### Swipe Mechanics
- Natural swipe gestures
- Visual feedback (LIKE/NOPE labels)
- Score selection overlays
- Undo protection

## 🔧 API Endpoints

### Users
- `POST /api/users` - Create guest user
- `GET /api/users/{user_id}` - Get user details

### Rooms
- `POST /api/rooms?user_id={id}` - Create room
- `POST /api/rooms/join` - Join room
- `GET /api/rooms/{room_id}` - Get room details
- `GET /api/rooms/{room_id}/participants` - Get participants

### Photos
- `POST /api/photos/import` - Import photos
- `GET /api/photos/room/{room_id}` - Get room photos (paginated)
- `GET /api/photos/{photo_id}` - Get single photo

### Votes
- `POST /api/votes` - Submit vote
- `POST /api/votes/undo` - Undo last vote
- `GET /api/votes/room/{room_id}/user/{user_id}` - Get user votes
- `GET /api/votes/room/{room_id}/photo/{photo_id}` - Get photo votes

### Rankings
- `GET /api/rankings/{room_id}` - Get ranked photos

### Export
- `POST /api/export` - Export top N photos
- `GET /api/export/{job_id}` - Get export job status

## 🗄️ Database Schema

### Collections

**users**
```json
{
  "_id": "ObjectId",
  "username": "string",
  "created_at": "datetime"
}
```

**rooms**
```json
{
  "_id": "ObjectId",
  "code": "string (5 digits)",
  "creator_id": "string",
  "created_at": "datetime",
  "status": "active|completed|archived"
}
```

**photos**
```json
{
  "_id": "ObjectId",
  "room_id": "string",
  "source_type": "local|drive",
  "path": "string (optional)",
  "drive_id": "string (optional)",
  "drive_thumbnail_url": "string (optional)",
  "filename": "string",
  "index": "number",
  "created_at": "datetime"
}
```

**votes**
```json
{
  "_id": "ObjectId",
  "room_id": "string",
  "photo_id": "string",
  "user_id": "string",
  "score": "number (-3 to 3)",
  "timestamp": "datetime"
}
```

## 📊 Ranking Algorithm

Weighted score calculation:
```python
weighted_score = sum(all_scores) / len(all_scores)
```

Photos are ranked by weighted_score (descending), with ties broken by vote count.

## 🔐 Google Drive Integration

### Setup
1. Create Google Cloud Project
2. Enable Google Drive API
3. Create OAuth 2.0 credentials
4. Get access token via OAuth flow

### Usage in App
1. User enters Drive folder ID or URL
2. User enters access token
3. App recursively scans for images
4. Stores Drive file IDs and thumbnail URLs
5. No photos downloaded (reference only)

### Supported Image Formats
- JPEG, PNG, GIF, WebP
- SVG, BMP, TIFF

## 🎯 Key Design Decisions

### 1. Reference-Based Storage
- **Why**: Avoid duplicating large photo files
- **How**: Store only paths (local) or Drive IDs
- **Benefit**: Fast imports, efficient storage

### 2. Guest Mode Only
- **Why**: Simplify onboarding for wedding guests
- **How**: Username only, stored locally
- **Benefit**: Zero friction, immediate use

### 3. Polling for Score Sync
- **Why**: Less resource intensive than WebSockets
- **How**: Client polls rankings endpoint
- **Benefit**: Simpler architecture, reliable

### 4. Pagination for Photos
- **Why**: Handle large photo collections
- **How**: Load photos in batches (50 per request)
- **Benefit**: Fast initial load, smooth scrolling

## 🧪 Testing

### Backend Testing
```bash
cd backend
pytest tests/
```

### API Testing with curl
```bash
# Create user
curl -X POST http://localhost:8001/api/users \
  -H "Content-Type: application/json" \
  -d '{"username": "TestUser"}'

# Create room
curl -X POST "http://localhost:8001/api/rooms?user_id=USER_ID"

# Import local photos
curl -X POST http://localhost:8001/api/photos/import \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "ROOM_ID",
    "source_type": "local",
    "paths": ["/path/to/photo1.jpg", "/path/to/photo2.jpg"]
  }'
```

## 📦 Deployment

### Backend (FastAPI)
```bash
# Using uvicorn
uvicorn server:app --host 0.0.0.0 --port 8001

# Or with Docker
docker build -t vowselect-backend .
docker run -p 8001:8001 vowselect-backend
```

### Frontend (Expo)
```bash
# Development
yarn start

# Build for production
eas build --platform ios
eas build --platform android
```

## 🐛 Troubleshooting

### Common Issues

**Backend won't start**
- Check MongoDB connection in .env
- Verify Python dependencies installed
- Check port 8001 not in use

**Frontend can't connect to backend**
- Verify EXPO_PUBLIC_BACKEND_URL in .env
- Check backend is running on port 8001
- Verify CORS settings in backend

**Photos not loading**
- For local: Verify file paths are correct
- For Drive: Check access token is valid
- Verify image file extensions are supported

**Swipe not working**
- Ensure react-native-gesture-handler is installed
- Check photos are loaded (not empty array)
- Verify user is authenticated

## 🔮 Future Enhancements

- [ ] Real-time sync with WebSockets
- [ ] Photo thumbnails generation
- [ ] Comments on photos
- [ ] Multiple room sessions per user
- [ ] Advanced filtering/sorting
- [ ] Social auth (Google, Facebook)
- [ ] Photo tagging and categories
- [ ] Batch photo upload from camera roll
- [ ] Export to multiple destinations
- [ ] Analytics dashboard

## 📄 License

MIT License

## 🤝 Contributing

This is an MVP built for wedding photo selection. Contributions welcome!

## 📧 Support

For issues or questions, please open a GitHub issue.

---

**Built with ❤️ for making wedding photo selection collaborative and fun!**
