from fastapi import FastAPI, APIRouter, HTTPException, Query, Body, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse, HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.server_api import ServerApi
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path
import os
import logging
import random
import string
import io
import ssl
import certifi
import base64
import asyncio
import zipfile
from PIL import Image
from bson import ObjectId
import time

# ==================== IN-MEMORY CACHE ====================

class TTLCache:
    """Simple in-memory cache with per-key time-to-live."""
    def __init__(self, default_ttl: int = 30):
        self._store: Dict[str, Any] = {}
        self._expiry: Dict[str, float] = {}
        self._default_ttl = default_ttl

    def get(self, key: str) -> Any:
        if key in self._store and time.time() < self._expiry.get(key, 0):
            return self._store[key]
        # Expired – clean up
        self._store.pop(key, None)
        self._expiry.pop(key, None)
        return None

    def set(self, key: str, value: Any, ttl: int | None = None):
        self._store[key] = value
        self._expiry[key] = time.time() + (ttl if ttl is not None else self._default_ttl)

    def invalidate(self, key: str):
        self._store.pop(key, None)
        self._expiry.pop(key, None)

    def invalidate_prefix(self, prefix: str):
        """Remove all keys starting with `prefix`."""
        keys = [k for k in self._store if k.startswith(prefix)]
        for k in keys:
            self._store.pop(k, None)
            self._expiry.pop(k, None)


# Global caches
rankings_cache = TTLCache(default_ttl=30)   # rankings: 30s TTL
photos_cache = TTLCache(default_ttl=60)     # room photos: 60s TTL

# Database initialization
from database.init_db import DatabaseInitializer

# Google Drive imports
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection - initialized on app startup
mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI')
GOOGLE_SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.readonly',  # Read access for imports
    'https://www.googleapis.com/auth/drive.file',       # Write access for exports
]

# Photo import configuration
DRIVE_BATCH_SIZE = int(os.environ.get('DRIVE_BATCH_SIZE', '10'))
logger_init = logging.getLogger(__name__)
logger_init.info(f"Drive batch size: {DRIVE_BATCH_SIZE}")

print(f"MongoDB URL: {mongo_url}")
print(f"Database name: {db_name}")
client = None
db = None

# Create the main app
app = FastAPI(title="VowSelect API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ==================== MODELS ====================

class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)


class User(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    username: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class Room(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    code: str  # 5-digit code
    creator_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "active"  # active, completed, archived

    class Config:
        populate_by_name = True


class RoomParticipant(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    room_id: str
    user_id: str
    username: str
    joined_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class Photo(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    room_id: str
    source_type: str  # "local", "drive", or "upload"
    path: Optional[str] = None  # For local files
    drive_id: Optional[str] = None  # For Google Drive files
    drive_thumbnail_url: Optional[str] = None
    compressed_data: Optional[str] = None  # Compressed mobile-friendly version (always stored)
    compressed_size_kb: Optional[float] = None  # Size of compressed image in KB
    filename: str
    index: int  # Order in the room
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class Vote(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    room_id: str
    photo_id: str
    user_id: str
    score: int  # -3, -2, -1, +1, +2, +3
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class ImportJob(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    room_id: str
    source_type: str  # "local" or "drive"
    source_path: Optional[str] = None
    status: str = "pending"  # pending, processing, completed, failed
    total_photos: int = 0
    processed_photos: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class ExportJob(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    room_id: str
    top_n: int
    destination_type: str  # "local" or "drive"
    destination_path: Optional[str] = None
    status: str = "pending"  # pending, processing, completed, failed
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


# ==================== REQUEST/RESPONSE MODELS ====================

class CreateUserRequest(BaseModel):
    username: str


class CreateRoomResponse(BaseModel):
    room_id: str
    code: str
    creator_id: str


class JoinRoomRequest(BaseModel):
    code: str
    user_id: str
    username: str


class ImportPhotosRequest(BaseModel):
    room_id: str
    source_type: str
    folder_path: Optional[str] = None  # For local folder
    drive_folder_id: Optional[str] = None  # For Google Drive
    drive_access_token: Optional[str] = None


class VoteRequest(BaseModel):
    room_id: str
    photo_id: str
    user_id: str
    score: int


class UndoVoteRequest(BaseModel):
    room_id: str
    user_id: str


class PhotoRanking(BaseModel):
    photo_id: str
    filename: str
    source_type: str
    path: Optional[str] = None
    drive_id: Optional[str] = None
    drive_thumbnail_url: Optional[str] = None
    compressed_data: Optional[str] = None
    compressed_size_kb: Optional[float] = None
    weighted_score: float
    vote_count: int
    rank: int


class ExportRequest(BaseModel):
    room_id: str
    top_n: int
    destination_type: str
    destination_path: Optional[str] = None
    drive_folder_id: Optional[str] = None
    drive_access_token: Optional[str] = None


# ==================== HELPER FUNCTIONS ====================

def generate_room_code() -> str:
    """Generate a unique 5-digit room code"""
    return ''.join(random.choices(string.digits, k=5))


def extract_drive_folder_id(folder_input: str) -> str:
    """Extract folder ID from URL or return as-is if already an ID"""
    if not folder_input:
        return ""
    
    folder_input = folder_input.strip()
    
    # Check if it's a URL
    if "drive.google.com" in folder_input:
        # Extract from URL like: https://drive.google.com/drive/folders/1ABC123xyz
        if "/folders/" in folder_input:
            parts = folder_input.split("/folders/")
            if len(parts) > 1:
                # Get the ID part and strip any query params
                folder_id = parts[1].split("?")[0].split("/")[0]
                return folder_id
    
    # If not a URL, assume it's already a folder ID
    return folder_input


async def get_room_by_code(code: str) -> Optional[Dict]:
    """Get room by code"""
    room = await db.rooms.find_one({"code": code})
    return room


async def get_user_votes_in_room(room_id: str, user_id: str) -> List[Dict]:
    """Get all votes by a user in a room"""
    votes = await db.votes.find({"room_id": room_id, "user_id": user_id}).sort("timestamp", -1).to_list(1000)
    return votes


async def calculate_photo_rankings(room_id: str) -> List[PhotoRanking]:
    """Calculate weighted rankings for all photos in a room (with caching)."""
    cache_key = f"rankings:{room_id}"
    cached = rankings_cache.get(cache_key)
    if cached is not None:
        return cached

    # Get all photos
    photos = await db.photos.find({"room_id": room_id}).to_list(1000)
    
    # Batch-fetch ALL votes for this room in one query (avoids N+1)
    all_votes = await db.votes.find({"room_id": room_id}).to_list(10000)
    # Group votes by photo_id
    votes_by_photo: Dict[str, list] = {}
    for v in all_votes:
        pid = v["photo_id"]
        votes_by_photo.setdefault(pid, []).append(v)
    
    # Calculate scores for each photo
    rankings = []
    for photo in photos:
        photo_id = str(photo["_id"])
        votes = votes_by_photo.get(photo_id, [])
        
        if votes:
            weighted_score = sum(v["score"] for v in votes) / len(votes)
            vote_count = len(votes)
        else:
            weighted_score = 0
            vote_count = 0
        
        # Ensure we have compressed data
        compressed_data = photo.get("compressed_data")
        
        # If missing compressed data, log warning but skip the photo
        if not compressed_data and photo.get("source_type") == "drive":
            logger.warning(f"Drive photo {photo_id} ({photo.get('filename')}) missing compressed_data - skipping to avoid 429 errors")
            continue
        
        rankings.append(PhotoRanking(
            photo_id=photo_id,
            filename=photo.get("filename", ""),
            source_type=photo.get("source_type", "local"),
            path=photo.get("path"),
            drive_id=photo.get("drive_id"),
            drive_thumbnail_url=None,
            compressed_data=compressed_data,
            compressed_size_kb=photo.get("compressed_size_kb"),
            weighted_score=weighted_score,
            vote_count=vote_count,
            rank=0
        ))
    
    # Sort by weighted score descending
    rankings.sort(key=lambda x: x.weighted_score, reverse=True)
    
    # Assign ranks
    for idx, ranking in enumerate(rankings, 1):
        ranking.rank = idx
    
    rankings_cache.set(cache_key, rankings)
    return rankings


# ==================== GOOGLE DRIVE SERVICE ====================

class GoogleDriveService:
    def __init__(self, access_token: str):
        # Google Drive API requires OAuth credentials to download files
        # API keys only work for metadata, not file content
        if not access_token:
            raise ValueError(
                "Google Drive access requires user authentication. "
                "Please sign in with Google to import photos from Drive."
            )
        
        credentials = Credentials(token=access_token)
        self.service = build('drive', 'v3', credentials=credentials)
        logger.info("GoogleDriveService initialized with user OAuth token")
    
    def verify_folder_access(self, folder_id: str) -> bool:
        """Verify user has access to the folder"""
        try:
            # Try to get folder metadata
            self.service.files().get(
                fileId=folder_id,
                fields='id,name',
                supportsAllDrives=True
            ).execute()
            return True
        except Exception as e:
            logger.error(f"Cannot access folder {folder_id}: {e}")
            return False
    
    def download_file(self, file_id: str) -> bytes:
        """Download file content from Google Drive"""
        try:
            request = self.service.files().get_media(fileId=file_id)
            file_buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(file_buffer, request)
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
            return file_buffer.getvalue()
        except Exception as e:
            logger.error(f"Error downloading file {file_id}: {e}")
            raise
    
    def list_images_in_folder(self, folder_id: str, recursive: bool = True) -> List[Dict]:
        """List all image files in a Google Drive folder"""
        results = []
        
        def scan_folder(fid: str, prefix: str = ""):
            try:
                query = f"'{fid}' in parents and trashed=false"
                page_token = None
                
                while True:
                    response = self.service.files().list(
                        q=query,
                        spaces='drive',
                        fields='nextPageToken, files(id, name, mimeType, thumbnailLink)',
                        pageToken=page_token,
                        supportsAllDrives=True,
                        includeItemsFromAllDrives=True
                    ).execute()
                    
                    files = response.get('files', [])
                    
                    for file in files:
                        if file['mimeType'] == 'application/vnd.google-apps.folder' and recursive:
                            # Recursively scan subfolders
                            scan_folder(file['id'], f"{prefix}/{file['name']}")
                        elif file['mimeType'].startswith('image/'):
                            # It's an image file
                            results.append({
                                'id': file['id'],
                                'name': file['name'],
                                'path': f"{prefix}/{file['name']}",
                                'thumbnail_url': file.get('thumbnailLink', '')
                            })
                    
                    page_token = response.get('nextPageToken')
                    if not page_token:
                        break
            except Exception as e:
                logger.error(f"Error scanning folder {fid}: {e}")
        
        scan_folder(folder_id)
        return results


# ==================== API ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "VowSelect API", "version": "1.0"}


# ==================== GOOGLE OAUTH ROUTES ====================

@api_router.get("/auth/google")
async def google_auth_init():
    """Initiate Google OAuth flow"""
    if not all([GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI]):
        raise HTTPException(
            status_code=500,
            detail="Google OAuth not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env"
        )
    
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uris": [GOOGLE_REDIRECT_URI],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=GOOGLE_SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI
    )
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        prompt='consent'
    )
    
    return {"auth_url": authorization_url, "state": state}


@api_router.get("/auth/callback")
async def google_auth_callback(code: str, state: str = None, request=None):
    """Handle Google OAuth callback and return token via redirect or deep link"""
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code missing")
    
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uris": [GOOGLE_REDIRECT_URI],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=GOOGLE_SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI
    )
    
    try:
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Return HTML with embedded token that can be extracted by mobile app or web
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Authentication Successful</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }}
                .container {{
                    background: white;
                    padding: 40px;
                    border-radius: 20px;
                    text-align: center;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    max-width: 400px;
                }}
                h1 {{ color: #D946B2; margin-bottom: 20px; }}
                p {{ color: #666; margin-bottom: 30px; }}
                .checkmark {{
                    font-size: 60px;
                    color: #34a853;
                    margin-bottom: 20px;
                }}
                .instructions {{
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 10px;
                    margin-top: 20px;
                    font-size: 14px;
                }}
                .token-display {{
                    background: #f0f0f0;
                    padding: 10px;
                    border-radius: 5px;
                    font-family: monospace;
                    font-size: 12px;
                    word-break: break-all;
                    margin-top: 15px;
                    display: none;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="checkmark">✓</div>
                <h1>Authentication Successful!</h1>
                <p id="status">Redirecting...</p>
                <div class="instructions">
                    <strong>Next step:</strong> Go back to the app and import your photos.
                </div>
                <div class="token-display" id="tokenDisplay">
                    Token: <span id="token">{credentials.token}</span>
                </div>
            </div>
            <script>
                const token = '{credentials.token}';
                const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                
                console.log('Is Mobile:', isMobile);
                console.log('Has opener:', !!window.opener);
                
                if (window.opener && !isMobile) {{
                    // Web environment with popup - use postMessage
                    try {{
                        console.log('Web environment: Sending token to parent window via postMessage...');
                        window.opener.postMessage({{
                            type: 'google_auth_success',
                            token: token
                        }}, '*');
                        
                        document.querySelector('#status').textContent = 'Success! This window will close automatically...';
                        
                        setTimeout(() => {{
                            window.close();
                        }}, 1500);
                    }} catch (e) {{
                        console.error('Error sending message to parent:', e);
                        document.querySelector('#status').textContent = 'Please close this window and return to the app.';
                    }}
                }} else if (isMobile) {{
                    // Mobile environment - redirect via deep link
                    console.log('Mobile environment: Attempting deep link redirect...');
                    document.querySelector('#status').textContent = 'Opening app...';
                    
                    // Try deep link with token in the URL
                    const deepLink = 'vowselect://auth-callback?token=' + encodeURIComponent(token);
                    console.log('Deep link:', deepLink);
                    
                    // Set a timeout to show token as fallback if deep link doesn't work
                    setTimeout(() => {{
                        console.log('Deep link may have failed, showing token as fallback');
                        document.querySelector('#tokenDisplay').style.display = 'block';
                        document.querySelector('#status').textContent = 'Copy the token below and paste it in your app:';
                    }}, 2000);
                    
                    // Attempt the deep link
                    window.location.href = deepLink;
                }} else {{
                    // Fallback - show token
                    console.log('Fallback: Showing token');
                    document.querySelector('#tokenDisplay').style.display = 'block';
                    document.querySelector('#status').textContent = 'Copy the token below and paste it in your app:';
                }}
            </script>
        </body>
        </html>
        """)
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to complete authentication: {str(e)}")


@api_router.post("/auth/exchange-token")
async def exchange_token(body: dict = Body(...)):
    """Exchange authorization code for access token"""
    code = body.get('code')
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code required")
    
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uris": [GOOGLE_REDIRECT_URI],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=GOOGLE_SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI
    )
    
    try:
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        return {
            "access_token": credentials.token,
            "expires_at": credentials.expiry.isoformat() if credentials.expiry else None
        }
    except Exception as e:
        logger.error(f"Token exchange error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to exchange token: {str(e)}")


# ==================== USER ROUTES ====================

@api_router.post("/users", response_model=User)
async def create_user(request: CreateUserRequest):
    """Create a guest user"""
    user_dict = {
        "username": request.username,
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_dict)
    user_dict["_id"] = str(result.inserted_id)
    
    return User(**user_dict)


@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    """Get user by ID"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user["_id"] = str(user["_id"])
    return User(**user)


# ==================== ROOM ROUTES ====================

@api_router.post("/rooms", response_model=CreateRoomResponse)
async def create_room(user_id: str = Query(...)):
    """Create a new selection room"""
    # Generate unique code
    code = generate_room_code()
    while await get_room_by_code(code):
        code = generate_room_code()
    
    # Create room
    room_dict = {
        "code": code,
        "creator_id": user_id,
        "created_at": datetime.utcnow(),
        "status": "active"
    }
    
    result = await db.rooms.insert_one(room_dict)
    room_id = str(result.inserted_id)
    
    # Add creator as participant
    participant_dict = {
        "room_id": room_id,
        "user_id": user_id,
        "username": (await db.users.find_one({"_id": ObjectId(user_id)}))["username"],
        "joined_at": datetime.utcnow()
    }
    await db.room_participants.insert_one(participant_dict)
    
    return CreateRoomResponse(
        room_id=room_id,
        code=code,
        creator_id=user_id
    )


@api_router.post("/rooms/join")
async def join_room(request: JoinRoomRequest):
    """Join an existing room"""
    room = await get_room_by_code(request.code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room_id = str(room["_id"])
    
    # Check if user already in room
    existing = await db.room_participants.find_one({
        "room_id": room_id,
        "user_id": request.user_id
    })
    
    if existing:
        return {"room_id": room_id, "message": "Already in room"}
    
    # Add participant
    participant_dict = {
        "room_id": room_id,
        "user_id": request.user_id,
        "username": request.username,
        "joined_at": datetime.utcnow()
    }
    await db.room_participants.insert_one(participant_dict)
    
    return {"room_id": room_id, "message": "Joined successfully"}


@api_router.get("/rooms/{room_id}")
async def get_room(room_id: str):
    """Get room details"""
    room = await db.rooms.find_one({"_id": ObjectId(room_id)})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Get participants
    participants = await db.room_participants.find({"room_id": room_id}).to_list(100)
    
    # Count only photos that are ready (have compressed_data)
    photo_count = await db.photos.count_documents({
        "room_id": room_id,
        "compressed_data": {"$exists": True, "$ne": None},
    })
    
    # Check if there's an active import job and get its details
    active_import = await db.import_jobs.find_one({
        "room_id": room_id,
        "status": "processing"
    })
    
    import_job = None
    if active_import:
        active_import["_id"] = str(active_import["_id"])
        import_job = {
            "job_id": active_import["_id"],
            "status": active_import.get("status", "processing"),
            "total_photos": active_import.get("total_photos", 0),
            "processed_photos": active_import.get("processed_photos", 0),
            "failed_photos": active_import.get("failed_photos", 0),
        }
    
    room["_id"] = str(room["_id"])
    for p in participants:
        p["_id"] = str(p["_id"])
    
    return {
        "room": room,
        "participants": participants,
        "photo_count": photo_count,
        "importing": active_import is not None,
        "import_job": import_job,
    }


@api_router.get("/rooms/{room_id}/participants")
async def get_room_participants(room_id: str):
    """Get all participants in a room"""
    participants = await db.room_participants.find({"room_id": room_id}).to_list(100)
    for p in participants:
        p["_id"] = str(p["_id"])
    return {"participants": participants}


# ==================== PHOTO IMPORT ROUTES ====================

def compress_image_to_base64(raw_data: bytes = None, file_path: str = None) -> tuple[str, float]:
    """
    Synchronous helper to compress image data for mobile.
    Returns (compressed_base64, size_kb) tuple.
    """
    from PIL import ImageOps
    
    image = None
    if raw_data:
        image = Image.open(io.BytesIO(raw_data))
    elif file_path:
        image = Image.open(file_path)
        
    if not image:
        raise ValueError("No image data provided")

    # Apply EXIF orientation
    try:
        image = ImageOps.exif_transpose(image)
    except Exception:
        pass

    # Convert to RGB
    if image.mode not in ('RGB',):
        image = image.convert('RGB')

    # Resize for mobile (1440px width max - doubled for better quality)
    MOBILE_MAX_WIDTH = 1440
    orig_w, orig_h = image.size
    if orig_w > MOBILE_MAX_WIDTH:
        scale = MOBILE_MAX_WIDTH / orig_w
        new_h = int(orig_h * scale)
        image = image.resize((MOBILE_MAX_WIDTH, new_h), Image.Resampling.LANCZOS)

    # Save as progressive JPEG with higher quality
    output_buffer = io.BytesIO()
    image.save(
        output_buffer,
        format='JPEG',
        quality=88,
        optimize=True,
        progressive=True,
        subsampling='4:2:0',
    )
    compressed_bytes = output_buffer.getvalue()
    compressed_base64 = base64.b64encode(compressed_bytes).decode('utf-8')
    size_kb = len(compressed_bytes) / 1024
    
    return compressed_base64, round(size_kb, 2)


async def compress_photo_background(photo_id: str, raw_data: bytes = None, file_path: str = None):
    """
    Background task to compress local photos that only have a file path.
    Updates the photo document with compressed data.
    """
    try:
        compressed_base64, size_kb = compress_image_to_base64(raw_data=raw_data, file_path=file_path)
        
        # Update database with compressed version
        await db.photos.update_one(
            {"_id": ObjectId(photo_id)},
            {"$set": {
                "compressed_data": compressed_base64,
                "compressed_size_kb": size_kb
            }}
        )
        logger.info(f"Background compressed photo {photo_id}: {size_kb:.1f}KB")
        
    except Exception as e:
        logger.error(f"Error compressing photo {photo_id}: {e}")


async def process_drive_photos_background(
    job_id: str,
    room_id: str,
    access_token: str,
    remaining_files: List[Dict],
    start_index: int,
    already_processed: int,
    batch_size: int = 10,
):
    """
    Background async task: downloads & compresses remaining Drive photos
    in batches after the initial batch has already been returned to the client.
    """
    total_remaining = len(remaining_files)
    logger.info(
        f"Background Drive import started – job {job_id}, "
        f"{total_remaining} photos remaining, batch_size={batch_size}"
    )
    processed = 0
    failed = 0
    current_index = start_index

    try:
        drive_service = GoogleDriveService(access_token=access_token)

        # Process in batches
        for batch_start in range(0, total_remaining, batch_size):
            batch = remaining_files[batch_start:batch_start + batch_size]
            batch_num = (batch_start // batch_size) + 1
            total_batches = (total_remaining + batch_size - 1) // batch_size
            logger.info(f"Background batch {batch_num}/{total_batches} – {len(batch)} photos")

            for file_info in batch:
                try:
                    # Download from Drive (blocking I/O – run in thread)
                    file_bytes = await asyncio.to_thread(
                        drive_service.download_file, file_info['id']
                    )
                    # Compress (CPU-bound – run in thread)
                    compressed_base64, size_kb = await asyncio.to_thread(
                        compress_image_to_base64, raw_data=file_bytes
                    )

                    # Insert the fully-ready photo document
                    photo_dict = {
                        "room_id": room_id,
                        "source_type": "drive",
                        "drive_id": file_info['id'],
                        "drive_thumbnail_url": file_info.get('thumbnail_url', ''),
                        "compressed_data": compressed_base64,
                        "compressed_size_kb": size_kb,
                        "filename": file_info['name'],
                        "index": current_index,
                        "status": "ready",
                        "created_at": datetime.utcnow(),
                    }
                    await db.photos.insert_one(photo_dict)
                    processed += 1
                    current_index += 1

                except Exception as e:
                    logger.error(
                        f"Background: failed to process Drive file "
                        f"{file_info['name']}: {e}"
                    )
                    failed += 1
                    current_index += 1  # keep index advancing
                    continue

            # Update job progress after each batch
            await db.import_jobs.update_one(
                {"_id": ObjectId(job_id)},
                {"$set": {
                    "processed_photos": already_processed + processed,
                    "total_photos": already_processed + total_remaining - failed,
                    "failed_photos": failed,
                }},
            )
            logger.info(
                f"Background batch {batch_num} done – "
                f"{already_processed + processed}/{already_processed + total_remaining} total"
            )

            # Invalidate caches so new photos show up
            photos_cache.invalidate_prefix(f"photos:{room_id}:")
            rankings_cache.invalidate(f"rankings:{room_id}")

            # Small yield between batches to keep the event loop responsive
            await asyncio.sleep(0.1)

        # Mark job as completed
        final_status = "completed" if failed < total_remaining else "failed"
        await db.import_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {
                "status": final_status,
                "processed_photos": already_processed + processed,
                "total_photos": already_processed + processed,
                "failed_photos": failed,
            }},
        )
        logger.info(
            f"Background Drive import done – job {job_id}: "
            f"{processed} succeeded, {failed} failed"
        )

    except Exception as e:
        logger.error(f"Background Drive import crashed – job {job_id}: {e}")
        await db.import_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "failed"}},
        )



def scan_local_folder_for_images(folder_path: str) -> List[str]:
    """Recursively scan a folder for image files"""
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg'}
    image_files = []
    
    try:
        folder = Path(folder_path)
        if not folder.exists():
            return []
        
        # Recursively find all image files
        for file_path in folder.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in image_extensions:
                image_files.append(str(file_path))
        
        return sorted(image_files)
    except Exception as e:
        logger.error(f"Error scanning folder {folder_path}: {e}")
        return []


class UploadPhotosRequest(BaseModel):
    room_id: str
    photos: List[Dict[str, str]]  # List of {filename, base64_data}


@api_router.post("/photos/upload-json")
async def upload_photos_json(request: UploadPhotosRequest, background_tasks: BackgroundTasks):
    """Upload photos as JSON with base64 data"""
    logger.info(f"JSON upload request received for room: {request.room_id}")
    logger.info(f"Number of photos: {len(request.photos)}")
    
    room = await db.rooms.find_one({"_id": ObjectId(request.room_id)})
    if not room:
        logger.error(f"Room not found: {request.room_id}")
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Create import job
    job_dict = {
        "room_id": request.room_id,
        "source_type": "upload",
        "status": "processing",
        "total_photos": 0,
        "processed_photos": 0,
        "created_at": datetime.utcnow()
    }
    job_result = await db.import_jobs.insert_one(job_dict)
    job_id = str(job_result.inserted_id)
    
    try:
        imported_count = 0
        
        # Get current max index
        max_photo = await db.photos.find_one(
            {"room_id": request.room_id},
            sort=[("index", -1)]
        )
        current_index = max_photo["index"] + 1 if max_photo else 0
        
        for photo_data in request.photos:
            # Compress inline - never store original heavy data
            try:
                b64_str = photo_data["base64_data"]
                if ',' in b64_str:
                    b64_str = b64_str.split(',')[1]
                raw_data = base64.b64decode(b64_str)
                compressed_base64, size_kb = compress_image_to_base64(raw_data=raw_data)
            except Exception as e:
                logger.error(f"Failed to compress photo {photo_data['filename']}: {e}")
                continue  # Skip photos that fail to compress
            
            # Store only compressed version
            photo_dict = {
                "room_id": request.room_id,
                "source_type": "upload",
                "filename": photo_data["filename"],
                "compressed_data": compressed_base64,
                "compressed_size_kb": size_kb,
                "index": current_index,
                "created_at": datetime.utcnow()
            }
            await db.photos.insert_one(photo_dict)

            imported_count += 1
            current_index += 1
        
        # Update job status
        await db.import_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {
                "status": "completed",
                "total_photos": imported_count,
                "processed_photos": imported_count
            }}
        )
        
        logger.info(f"Successfully uploaded {imported_count} photos")
        photos_cache.invalidate_prefix(f"photos:{request.room_id}:")
        rankings_cache.invalidate(f"rankings:{request.room_id}")
        return {
            "job_id": job_id,
            "status": "completed",
            "imported_count": imported_count
        }
    
    except Exception as e:
        logger.error(f"Error uploading photos: {e}")
        await db.import_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "failed"}}
        )
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/photos/upload")
async def upload_photos(
    background_tasks: BackgroundTasks,
    room_id: str = Query(...),
    files: List[UploadFile] = File(...)
):
    """Upload photos directly from client"""
    logger.info(f"Upload request received for room: {room_id}")
    logger.info(f"Number of files: {len(files) if files else 0}")
    
    room = await db.rooms.find_one({"_id": ObjectId(room_id)})
    if not room:
        logger.error(f"Room not found: {room_id}")
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Create import job
    job_dict = {
        "room_id": room_id,
        "source_type": "upload",
        "status": "processing",
        "total_photos": 0,
        "processed_photos": 0,
        "created_at": datetime.utcnow()
    }
    job_result = await db.import_jobs.insert_one(job_dict)
    job_id = str(job_result.inserted_id)
    
    try:
        imported_count = 0
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'}
        
        # Get current max index
        max_photo = await db.photos.find_one(
            {"room_id": room_id},
            sort=[("index", -1)]
        )
        current_index = max_photo["index"] + 1 if max_photo else 0
        
        for file in files:
            # Check if file is an image
            file_ext = Path(file.filename).suffix.lower()
            if file_ext not in image_extensions:
                continue
            
            # Read and compress inline - never store original
            content = await file.read()
            
            try:
                compressed_base64, size_kb = compress_image_to_base64(raw_data=content)
            except Exception as e:
                logger.error(f"Failed to compress {file.filename}: {e}")
                continue  # Skip photos that fail to compress
            
            # Store only compressed version
            photo_dict = {
                "room_id": room_id,
                "source_type": "upload",
                "filename": file.filename,
                "compressed_data": compressed_base64,
                "compressed_size_kb": size_kb,
                "index": current_index,
                "created_at": datetime.utcnow()
            }
            await db.photos.insert_one(photo_dict)

            imported_count += 1
            current_index += 1
        
        # Update job status
        await db.import_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {
                "status": "completed",
                "total_photos": imported_count,
                "processed_photos": imported_count
            }}
        )
        
        photos_cache.invalidate_prefix(f"photos:{room_id}:")
        rankings_cache.invalidate(f"rankings:{room_id}")
        return {
            "job_id": job_id,
            "status": "completed",
            "imported_count": imported_count
        }
    
    except Exception as e:
        logger.error(f"Error uploading photos: {e}")
        await db.import_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "failed"}}
        )
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/photos/import")
async def import_photos(request: ImportPhotosRequest, background_tasks: BackgroundTasks):
    """Import photos into a room"""
    room = await db.rooms.find_one({"_id": ObjectId(request.room_id)})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Create import job
    job_dict = {
        "room_id": request.room_id,
        "source_type": request.source_type,
        "status": "processing",
        "total_photos": 0,
        "processed_photos": 0,
        "created_at": datetime.utcnow()
    }
    job_result = await db.import_jobs.insert_one(job_dict)
    job_id = str(job_result.inserted_id)
    
    try:
        imported_count = 0
        
        if request.source_type == "local":
            # Import from local folder
            if not request.folder_path:
                raise HTTPException(status_code=400, detail="Folder path required for local import")
            
            # Scan folder recursively for images
            image_paths = scan_local_folder_for_images(request.folder_path)
            
            if not image_paths:
                raise HTTPException(status_code=400, detail="No image files found in the specified folder")
            
            # Get current max index
            max_photo = await db.photos.find_one(
                {"room_id": request.room_id},
                sort=[("index", -1)]
            )
            current_index = max_photo["index"] + 1 if max_photo else 0
            
            for path in image_paths:
                photo_dict = {
                    "room_id": request.room_id,
                    "source_type": "local",
                    "path": path,
                    "filename": Path(path).name,
                    "index": current_index,
                    "created_at": datetime.utcnow()
                }
                result = await db.photos.insert_one(photo_dict)
                photo_id = str(result.inserted_id)
                
                # Schedule background compression
                background_tasks.add_task(compress_photo_background, photo_id, file_path=path)

                imported_count += 1
                current_index += 1
        
        elif request.source_type == "drive":
            # Import from Google Drive
            if not request.drive_folder_id:
                raise HTTPException(status_code=400, detail="Drive folder ID required")
            
            # Extract folder ID from URL if needed
            folder_id = extract_drive_folder_id(request.drive_folder_id)
            if not folder_id:
                raise HTTPException(status_code=400, detail="Invalid Google Drive folder ID or URL")
            
            logger.info(f"Drive import - raw input: '{request.drive_folder_id}', extracted folder_id: '{folder_id}'")
            
            # Try public access first
            drive_service = GoogleDriveService(access_token=request.drive_access_token)
            
            # If no access token provided, check if folder is public
            if not request.drive_access_token:
                is_public = drive_service.is_folder_public(folder_id)
                if not is_public:
                    raise HTTPException(
                        status_code=401,
                        detail="This folder is private. Please authenticate with Google Drive to access it."
                    )
            
            # First verify the folder exists and list ALL files (for debugging)
            try:
                folder_meta = drive_service.service.files().get(
                    fileId=folder_id, fields='id,name,mimeType', supportsAllDrives=True
                ).execute()
                logger.info(f"Drive folder info: name='{folder_meta.get('name')}', mimeType='{folder_meta.get('mimeType')}'")
                
                # List ALL files (not just images) for debugging
                all_files_resp = drive_service.service.files().list(
                    q=f"'{folder_id}' in parents and trashed=false",
                    spaces='drive',
                    fields='files(id, name, mimeType)',
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=True
                ).execute()
                all_files = all_files_resp.get('files', [])
                logger.info(f"All files in folder ({len(all_files)}):")
                for f in all_files:
                    logger.info(f"  - {f['name']} (type: {f['mimeType']})")
            except Exception as e:
                logger.error(f"Error checking folder: {e}")
            
            try:
                files = drive_service.list_images_in_folder(folder_id)
            except Exception as e:
                if "401" in str(e) or "403" in str(e) or "auth" in str(e).lower():
                    raise HTTPException(
                        status_code=401,
                        detail="Authentication required. This folder is private or you don't have access."
                    )
                raise
            
            if not files:
                raise HTTPException(status_code=400, detail="No image files found in the Drive folder")
            
            # Get current max index
            max_photo = await db.photos.find_one(
                {"room_id": request.room_id},
                sort=[("index", -1)]
            )
            current_index = max_photo["index"] + 1 if max_photo else 0
            
            # ---- Async strategy: process first batch immediately, queue the rest ----
            initial_files = files[:DRIVE_BATCH_SIZE]
            remaining_files = files[DRIVE_BATCH_SIZE:]
            
            # Process the initial batch synchronously so the user has photos right away
            for file in initial_files:
                try:
                    file_bytes = drive_service.download_file(file['id'])
                    compressed_base64, size_kb = compress_image_to_base64(raw_data=file_bytes)
                except Exception as e:
                    logger.error(f"Failed to download/compress Drive file {file['name']}: {e}")
                    continue  # Skip files that fail
                
                photo_dict = {
                    "room_id": request.room_id,
                    "source_type": "drive",
                    "drive_id": file['id'],
                    "drive_thumbnail_url": file.get('thumbnail_url', ''),
                    "compressed_data": compressed_base64,
                    "compressed_size_kb": size_kb,
                    "filename": file['name'],
                    "index": current_index,
                    "status": "ready",
                    "created_at": datetime.utcnow()
                }
                await db.photos.insert_one(photo_dict)
                imported_count += 1
                current_index += 1
            
            total_found = len(files)
            
            if remaining_files:
                # Update job as "processing" – background work continues
                await db.import_jobs.update_one(
                    {"_id": ObjectId(job_id)},
                    {"$set": {
                        "status": "processing",
                        "total_photos": total_found,
                        "processed_photos": imported_count,
                    }}
                )
                
                # Fire-and-forget background task for the remaining photos
                asyncio.create_task(
                    process_drive_photos_background(
                        job_id=job_id,
                        room_id=request.room_id,
                        access_token=request.drive_access_token,
                        remaining_files=remaining_files,
                        start_index=current_index,
                        already_processed=imported_count,
                        batch_size=DRIVE_BATCH_SIZE,
                    )
                )
                
                return {
                    "job_id": job_id,
                    "status": "processing",
                    "imported_count": imported_count,
                    "total_found": total_found,
                    "pending_count": len(remaining_files),
                    "message": f"First {imported_count} photos ready. {len(remaining_files)} more downloading in background."
                }
        
        # Update job status (for local imports or small Drive imports)
        await db.import_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {
                "status": "completed",
                "total_photos": imported_count,
                "processed_photos": imported_count
            }}
        )
        
        photos_cache.invalidate_prefix(f"photos:{request.room_id}:")
        rankings_cache.invalidate(f"rankings:{request.room_id}")
        
        return {
            "job_id": job_id,
            "status": "completed",
            "imported_count": imported_count
        }
    
    except Exception as e:
        logger.error(f"Error importing photos: {e}")
        await db.import_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "failed"}}
        )
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/import-jobs/{job_id}")
async def get_import_job_status(job_id: str):
    """Get the status / progress of a photo import job (useful for polling)."""
    job = await db.import_jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")

    job["_id"] = str(job["_id"])

    # Also return how many photos are actually available (status=ready) right now
    ready_count = await db.photos.count_documents({
        "room_id": job["room_id"],
        "compressed_data": {"$exists": True, "$ne": None},
    })

    return {
        "job": job,
        "ready_photo_count": ready_count,
    }


@api_router.get("/photos/room/{room_id}")
async def get_room_photos(
    room_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get photos for a room with pagination (only returns ready photos with compressed_data)"""
    cache_key = f"photos:{room_id}:{skip}:{limit}"
    cached = photos_cache.get(cache_key)
    if cached is not None:
        return cached

    # Only count and return photos that are ready
    ready_filter = {
        "room_id": room_id,
        "compressed_data": {"$exists": True, "$ne": None},
    }
    total = await db.photos.count_documents(ready_filter)
    
    photos = await db.photos.find(
        ready_filter
    ).sort("index", 1).skip(skip).limit(limit).to_list(limit)
    
    for photo in photos:
        photo["_id"] = str(photo["_id"])
    
    result = {
        "photos": photos,
        "total": total,
        "skip": skip,
        "limit": limit
    }
    photos_cache.set(cache_key, result)
    return result


@api_router.get("/photos/{photo_id}")
async def get_photo(photo_id: str):
    """Get a single photo (includes compressed_data)"""
    photo = await db.photos.find_one({"_id": ObjectId(photo_id)})
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    photo["_id"] = str(photo["_id"])
    return photo


@api_router.get("/photos/{photo_id}/base64")
async def get_photo_base64(photo_id: str, high_quality: bool = False):
    """Get base64 data for a photo (defaults to compressed; high_quality=true reads from disk for local files)"""
    photo = await db.photos.find_one({"_id": ObjectId(photo_id)})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Return compressed data (default for all photos)
    if not high_quality and photo.get("compressed_data"):
        return {
            "base64_data": photo["compressed_data"],
            "compressed_size_kb": photo.get("compressed_size_kb"),
            "is_compressed": True
        }
    
    # High quality requested - read from source
    # For local files, read from disk
    if photo.get("source_type") == "local" and photo.get("path"):
        try:
            file_path = Path(photo["path"])
            if not file_path.exists():
                raise HTTPException(status_code=404, detail="Photo file not found on disk")
            
            with open(file_path, "rb") as f:
                image_data = f.read()
                base64_data = base64.b64encode(image_data).decode('utf-8')
            
            return {
                "base64_data": base64_data,
                "is_compressed": False
            }
        except Exception as e:
            logger.error(f"Error reading local photo {photo_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to read photo: {str(e)}")
    
    # For Drive photos requesting high quality, return thumbnail URL as fallback
    # (actual re-download would require storing access token, which we don't do for privacy)
    if photo.get("source_type") == "drive" and high_quality:
        if photo.get("drive_thumbnail_url"):
            return {
                "base64_data": None,
                "drive_thumbnail_url": photo.get("drive_thumbnail_url"),
                "is_compressed": False
            }
    
    raise HTTPException(status_code=400, detail="Photo has no accessible data")


# ==================== VOTING ROUTES ====================

@api_router.post("/votes")
async def create_vote(request: VoteRequest):
    """Submit a vote for a photo"""
    # Validate score
    if request.score not in [-3, -2, -1, 1, 2, 3]:
        raise HTTPException(status_code=400, detail="Invalid score. Must be -3, -2, -1, 1, 2, or 3")
    
    # Check if user already voted on this photo
    existing_vote = await db.votes.find_one({
        "room_id": request.room_id,
        "photo_id": request.photo_id,
        "user_id": request.user_id
    })
    
    if existing_vote:
        # Update existing vote
        await db.votes.update_one(
            {"_id": existing_vote["_id"]},
            {"$set": {
                "score": request.score,
                "timestamp": datetime.utcnow()
            }}
        )
        rankings_cache.invalidate(f"rankings:{request.room_id}")
        return {"message": "Vote updated"}
    else:
        # Create new vote
        vote_dict = {
            "room_id": request.room_id,
            "photo_id": request.photo_id,
            "user_id": request.user_id,
            "score": request.score,
            "timestamp": datetime.utcnow()
        }
        await db.votes.insert_one(vote_dict)
        rankings_cache.invalidate(f"rankings:{request.room_id}")
        return {"message": "Vote created"}


@api_router.post("/votes/undo")
async def undo_vote(request: UndoVoteRequest):
    """Undo the last vote by a user in a room"""
    # Get the last vote
    votes = await get_user_votes_in_room(request.room_id, request.user_id)
    
    if not votes:
        raise HTTPException(status_code=404, detail="No votes to undo")
    
    last_vote = votes[0]
    
    # Delete the vote
    await db.votes.delete_one({"_id": last_vote["_id"]})
    
    rankings_cache.invalidate(f"rankings:{request.room_id}")
    
    return {
        "message": "Vote undone",
        "photo_id": str(last_vote["photo_id"])
    }


@api_router.get("/votes/room/{room_id}/user/{user_id}")
async def get_user_votes(room_id: str, user_id: str):
    """Get all votes by a user in a room"""
    votes = await db.votes.find({"room_id": room_id, "user_id": user_id}).to_list(1000)
    
    for vote in votes:
        vote["_id"] = str(vote["_id"])
    
    return {"votes": votes}


@api_router.get("/votes/room/{room_id}/photo/{photo_id}")
async def get_photo_votes(room_id: str, photo_id: str):
    """Get all votes for a photo"""
    votes = await db.votes.find({"room_id": room_id, "photo_id": photo_id}).to_list(1000)
    
    for vote in votes:
        vote["_id"] = str(vote["_id"])
    
    # Calculate average score
    if votes:
        avg_score = sum(v["score"] for v in votes) / len(votes)
    else:
        avg_score = 0
    
    return {
        "votes": votes,
        "vote_count": len(votes),
        "average_score": avg_score
    }


# ==================== RANKING ROUTES ====================

@api_router.get("/rankings/{room_id}", response_model=List[PhotoRanking])
async def get_rankings(room_id: str):
    """Get ranked photos for a room"""
    rankings = await calculate_photo_rankings(room_id)
    return rankings


# ==================== EXPORT ROUTES ====================

@api_router.post("/export")
async def export_photos(request: ExportRequest):
    """Export top N photos to local folder or Google Drive"""
    logger.info(f"Export request: room_id={request.room_id}, top_n={request.top_n}, destination_type={request.destination_type}")
    
    # Get rankings
    rankings = await calculate_photo_rankings(request.room_id)
    
    # Get top N
    top_photos = rankings[:request.top_n]
    
    if not top_photos:
        raise HTTPException(status_code=400, detail="No photos to export")
    
    # Determine destination path based on type
    destination_path = (
        request.destination_path if request.destination_type == "local"
        else request.drive_folder_id
    )
    
    # Create export job
    job_dict = {
        "room_id": request.room_id,
        "top_n": request.top_n,
        "destination_type": request.destination_type,
        "destination_path": destination_path,
        "status": "processing",
        "created_at": datetime.utcnow()
    }
    job_result = await db.export_jobs.insert_one(job_dict)
    job_id = str(job_result.inserted_id)
    
    try:
        if request.destination_type == "local":
            # Export to local folder
            if not request.destination_path:
                raise HTTPException(status_code=400, detail="Destination path required for local export")
            
            export_folder = Path(request.destination_path)
            
            # Check if path exists and is writable
            if not export_folder.exists():
                try:
                    export_folder.mkdir(parents=True, exist_ok=True)
                except Exception as e:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Cannot create folder: {str(e)}. Check path and write permissions."
                    )
            
            if not os.access(export_folder, os.W_OK):
                raise HTTPException(
                    status_code=403,
                    detail=f"No write permission for path: {request.destination_path}"
                )
            
            # Export photos
            exported_count = 0
            for photo in top_photos:
                if not photo.compressed_data:
                    logger.warning(f"Photo {photo.photo_id} has no compressed data, skipping")
                    continue
                
                # Create filename: rank__01__originalname.jpg
                rank_str = f"{photo.rank:02d}"
                original_name = Path(photo.filename).stem
                extension = Path(photo.filename).suffix or '.jpg'
                new_filename = f"rank__{rank_str}__{original_name}{extension}"
                
                file_path = export_folder / new_filename
                
                try:
                    # Decode base64 and save
                    image_data = base64.b64decode(photo.compressed_data)
                    with open(file_path, 'wb') as f:
                        f.write(image_data)
                    exported_count += 1
                except Exception as e:
                    logger.error(f"Failed to write photo {photo.photo_id}: {e}")
                    continue
            
            # Update job status
            await db.export_jobs.update_one(
                {"_id": ObjectId(job_id)},
                {"$set": {"status": "completed"}}
            )
            
            return {
                "job_id": job_id,
                "status": "completed",
                "exported_count": exported_count,
                "destination": str(export_folder),
                "message": f"Exported {exported_count} photos to {export_folder}"
            }
        
        elif request.destination_type == "drive":
            # Export to Google Drive
            if not request.drive_access_token:
                raise HTTPException(
                    status_code=401,
                    detail="Google Drive access token required. Please sign in with Google."
                )
            
            if not request.drive_folder_id:
                raise HTTPException(
                    status_code=400,
                    detail="Google Drive folder ID required"
                )
            
            # Extract folder ID from URL if needed
            folder_id = extract_drive_folder_id(request.drive_folder_id)
            if not folder_id:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid Google Drive folder ID or URL"
                )
            
            try:
                from googleapiclient.http import MediaIoBaseUpload
                
                # Initialize Drive service with user token
                credentials = Credentials(token=request.drive_access_token)
                drive_service = build('drive', 'v3', credentials=credentials)
                
                # Create export folder: vow_select_YYYYMMDD_HHMMSS
                timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                folder_name = f"vow_select_{timestamp}"
                
                folder_metadata = {
                    'name': folder_name,
                    'mimeType': 'application/vnd.google-apps.folder',
                    'parents': [folder_id]
                }
                
                try:
                    created_folder = drive_service.files().create(
                        body=folder_metadata,
                        fields='id,name,webViewLink'
                    ).execute()
                    export_folder_id = created_folder['id']
                    folder_link = created_folder.get('webViewLink', '')
                except Exception as e:
                    error_msg = str(e)
                    if '403' in error_msg or 'permission' in error_msg.lower():
                        raise HTTPException(
                            status_code=403,
                            detail="No write access to Google Drive folder. Please check folder permissions or sign in again."
                        )
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to create Drive folder: {error_msg}"
                    )
                
                # Upload photos
                exported_count = 0
                for photo in top_photos:
                    if not photo.compressed_data:
                        logger.warning(f"Photo {photo.photo_id} has no compressed data, skipping")
                        continue
                    
                    # Create filename: rank__01__originalname.jpg
                    rank_str = f"{photo.rank:02d}"
                    original_name = Path(photo.filename).stem
                    extension = Path(photo.filename).suffix or '.jpg'
                    new_filename = f"rank__{rank_str}__{original_name}{extension}"
                    
                    try:
                        # Decode base64
                        image_data = base64.b64decode(photo.compressed_data)
                        
                        # Upload to Drive
                        file_metadata = {
                            'name': new_filename,
                            'parents': [export_folder_id]
                        }
                        media = MediaIoBaseUpload(
                            io.BytesIO(image_data),
                            mimetype='image/jpeg',
                            resumable=True
                        )
                        drive_service.files().create(
                            body=file_metadata,
                            media_body=media,
                            fields='id'
                        ).execute()
                        exported_count += 1
                    except Exception as e:
                        logger.error(f"Failed to upload photo {photo.photo_id} to Drive: {e}")
                        continue
                
                # Update job status
                await db.export_jobs.update_one(
                    {"_id": ObjectId(job_id)},
                    {"$set": {"status": "completed"}}
                )
                
                return {
                    "job_id": job_id,
                    "status": "completed",
                    "exported_count": exported_count,
                    "destination": folder_link,
                    "folder_name": folder_name,
                    "message": f"Exported {exported_count} photos to Google Drive folder: {folder_name}"
                }
                
            except HTTPException:
                raise
            except Exception as e:
                error_msg = str(e)
                if '403' in error_msg or 'permission' in error_msg.lower():
                    raise HTTPException(
                        status_code=403,
                        detail="No write access to Google Drive. Please sign in with Google again and grant file access."
                    )
                raise HTTPException(
                    status_code=500,
                    detail=f"Drive export failed: {error_msg}"
                )
        else:
            raise HTTPException(status_code=400, detail="Invalid destination type")
    
    except HTTPException:
        # Update job as failed
        await db.export_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "failed"}}
        )
        raise
    except Exception as e:
        logger.error(f"Export error: {e}", exc_info=True)
        await db.export_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "failed"}}
        )
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/export/download-zip")
async def export_download_zip(
    room_id: str = Query(...),
    top_n: int = Query(..., ge=1),
):
    """Download top N photos as a ZIP file (for mobile clients)"""
    rankings = await calculate_photo_rankings(room_id)
    top_photos = rankings[:top_n]

    if not top_photos:
        raise HTTPException(status_code=400, detail="No photos to export")

    # Build ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for photo in top_photos:
            if not photo.compressed_data:
                continue
            rank_str = f"{photo.rank:02d}"
            original_name = Path(photo.filename).stem
            extension = Path(photo.filename).suffix or '.jpg'
            new_filename = f"rank__{rank_str}__{original_name}{extension}"
            image_data = base64.b64decode(photo.compressed_data)
            zf.writestr(new_filename, image_data)

    zip_buffer.seek(0)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    zip_name = f"vowselect_top{top_n}_{timestamp}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
    )


@api_router.get("/export/{job_id}")
async def get_export_job(job_id: str):
    """Get export job status"""
    job = await db.export_jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    
    job["_id"] = str(job["_id"])
    return job


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_db_client():
    global client, db
    logger.info(f"Connecting to MongoDB Atlas...")
    print(f"Connecting to MongoDB Atlas...", flush=True)
    try:
        print(f"MongoDB URL: {mongo_url}", flush=True)
        print(f"Database name: {db_name}", flush=True)
        
        # Create SSL context for Windows compatibility
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        client = AsyncIOMotorClient(
            mongo_url,
            server_api=ServerApi('1'),
            serverSelectionTimeoutMS=30000,
            tls=True,
            tlsAllowInvalidCertificates=True,
            tlsAllowInvalidHostnames=True
        )
        print(f"Client created", flush=True)
        # Verify connection
        await client.admin.command('ping')
        print(f"Ping successful", flush=True)
        db = client[db_name]
        logger.info("✓ MongoDB connection established")
        print("✓ MongoDB connection established", flush=True)
        
        # Initialize database collections
        initializer = DatabaseInitializer(db)
        await initializer.initialize()
        logger.info("✓ Database collections initialized")
        print("✓ Database collections initialized", flush=True)
    except Exception as e:
        logger.error(f"✗ Failed to connect to MongoDB: {e}")
        print(f"✗ Failed to connect to MongoDB: {e}", flush=True)
        raise


@app.on_event("shutdown")
async def shutdown_db_client():
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed")

