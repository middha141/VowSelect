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
- **Node.js**: 20.16.0 or higher
- **Python**: 3.11 or higher
- **MongoDB**: Running locally or remote connection
- **Yarn**: Package manager for Node.js projects
- **npm**: Comes with Node.js

### System Requirements
- Windows, macOS, or Linux
- At least 2GB RAM
- Internet connection (for Google Drive features)

---

## 📦 Installation Guide

### Step 1: Install Node.js (if not already installed)

**On Windows:**
1. Download Node.js from https://nodejs.org/ (choose LTS version 20.16.0+)
2. Run the installer and follow the prompts
3. Close and reopen PowerShell/Command Prompt
4. Verify installation:
   ```powershell
   node --version
   npm --version
   ```

**Alternative (Windows Package Manager):**
```powershell
winget install OpenJS.NodeJS
```

**On macOS:**
```bash
brew install node
```

**On Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 2: Install Yarn

Once Node.js is installed:
```powershell
npm install --global yarn
```

Verify:
```powershell
yarn --version
```

### Step 3: Install Python (if not already installed)

**On Windows:**
1. Download Python from https://www.python.org/ (choose 3.11+)
2. Run the installer and **check "Add Python to PATH"**
3. Close and reopen PowerShell
4. Verify installation:
   ```powershell
   python --version
   ```

**Alternative (Windows Package Manager):**
```powershell
winget install Python.Python.3.12
```

**On macOS:**
```bash
brew install python@3.12
```

**On Linux:**
```bash
sudo apt-get install python3.12 python3.12-venv
```

### Step 4: Install MongoDB

**Option A: Local MongoDB (Recommended for Development)**

**On Windows:**
1. Download MongoDB Community from https://www.mongodb.com/try/download/community
2. Run the installer and follow prompts
3. MongoDB will run as a Windows service automatically
4. Verify it's running: The default connection URL is `mongodb://localhost:27017`

**On macOS (using Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**On Linux (Ubuntu/Debian):**
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
```

**Option B: MongoDB Atlas (Cloud Database)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get your connection string (will look like: `mongodb+srv://username:password@cluster.mongodb.net/`)
4. Use this string in your `.env` file

### Step 5: Setup Backend

1. Navigate to the backend directory:
   ```powershell
   cd backend
   ```

2. Create a Python virtual environment:
   ```powershell
   python -m venv venv
   
   # Activate it
   .\venv\Scripts\Activate.ps1
   ```

3. Install Python dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

4. Create `.env` file in the `backend` directory:
   ```
   # MongoDB Configuration
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=vowselect
   
   # Server Configuration
   API_HOST=0.0.0.0
   API_PORT=8001
   
   # Google Drive (Optional - for Drive imports)
   GOOGLE_API_KEY=your_google_api_key_here
   ```

   **Environment Variables Explained:**
   - `MONGO_URL`: Connection string to MongoDB
     - Local: `mongodb://localhost:27017`
     - Atlas: `mongodb+srv://username:password@cluster.mongodb.net/`
   - `DB_NAME`: Name of the MongoDB database (default: `vowselect`)
   - `API_HOST`: Backend server host (default: `0.0.0.0`)
   - `API_PORT`: Backend server port (default: `8001`)
   - `GOOGLE_API_KEY`: (Optional) API key for Google Drive integration

### Step 6: Setup Frontend

1. Navigate to the frontend directory:
   ```powershell
   cd frontend
   ```

2. Install dependencies:
   ```powershell
   yarn install
   ```

3. Create `.env` file in the `frontend` directory:
   ```
   # Backend Configuration
   EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
   EXPO_PUBLIC_ENV=development
   ```

   **Environment Variables Explained:**
   - `EXPO_PUBLIC_BACKEND_URL`: URL to your backend API
     - Local development: `http://localhost:8001`
     - Production: `https://your-backend-url.com`
   - `EXPO_PUBLIC_ENV`: Environment mode (development/production)

---

## 🎯 Running the Application

### Method 1: Development Mode (Recommended)

**Terminal 1 - Backend:**
```powershell
cd backend

# Activate virtual environment (Windows)
.\venv\Scripts\Activate.ps1

# Run backend server
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
yarn start
```

After running `yarn start`, you'll see options:
- Press `w` for web browser
- Press `a` for Android (requires Android Studio)
- Press `i` for iOS (macOS only)
- Press `j` for Expo Go app

### Method 2: Using Expo Go (Easiest for Mobile Testing)

1. Download **Expo Go** app on your phone (iOS App Store or Google Play)
2. Run `yarn start` in the frontend directory
3. Scan the QR code with your phone
4. App will load on your phone automatically

---

## 🔧 Troubleshooting

### MongoDB Connection Issues
**Error**: `Connection refused` or `MongoError: connect ECONNREFUSED 127.0.0.1:27017`

**Solution:**
- Ensure MongoDB is running:
  ```powershell
  # Windows - check if service is running
  Get-Service MongoDB
  ```
- If using MongoDB Atlas, verify connection string in `.env`
- Check firewall settings

### Node.js/Yarn Version Issues
**Error**: `The engine "node" is incompatible with this module`

**Solution:**
```powershell
node --version  # Should be 20.16.0+
npm install --global yarn  # Reinstall yarn
```

### Python Virtual Environment Issues
**Error**: `command not found: python` or venv activation fails

**Solution:**
```powershell
# For Windows, ensure you're using the correct activation:
.\venv\Scripts\Activate.ps1

# If that fails, try:
python -m venv venv
.\venv\Scripts\Activate.ps1

# Check Python path:
where python
```

### Backend Port Already in Use
**Error**: `Address already in use: ('0.0.0.0', 8001)`

**Solution:**
- Kill the process using port 8001:
  ```powershell
  # Windows
  netstat -ano | findstr :8001
  taskkill /PID <PID> /F
  
  # Or use a different port:
  uvicorn server:app --reload --host 0.0.0.0 --port 8002
  ```

### CORS Errors in Frontend
**Error**: `Access to XMLHttpRequest blocked by CORS`

**Solution:**
- Verify `EXPO_PUBLIC_BACKEND_URL` in frontend `.env` matches your backend URL
- Ensure backend is running on the correct port
- Check backend CORS configuration in `server.py`

---

## 📝 Environment Variables Summary

### Backend (.env)
```
# Required
MONGO_URL=mongodb://localhost:27017
DB_NAME=vowselect

# Optional
API_HOST=0.0.0.0
API_PORT=8001
GOOGLE_API_KEY=your_key_here
```

### Frontend (.env)
```
# Required
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001

# Optional
EXPO_PUBLIC_ENV=development
```

---

## 🚀 Running the Application

### Development Mode

1. **Start Backend:**
   ```powershell
   cd backend
   uvicorn server:app --reload --host 0.0.0.0 --port 8001
   ```

2. **Start Frontend:**
   ```powershell
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
