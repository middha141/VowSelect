from fastapi import FastAPI, APIRouter, HTTPException, Query, Body, UploadFile, File
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path
import os
import logging
import random
import string
import io
from bson import ObjectId

# Google Drive imports
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2.credentials import Credentials

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
    source_type: str  # "local" or "drive"
    path: Optional[str] = None  # For local files
    drive_id: Optional[str] = None  # For Google Drive files
    drive_thumbnail_url: Optional[str] = None
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


async def get_room_by_code(code: str) -> Optional[Dict]:
    """Get room by code"""
    room = await db.rooms.find_one({"code": code})
    return room


async def get_user_votes_in_room(room_id: str, user_id: str) -> List[Dict]:
    """Get all votes by a user in a room"""
    votes = await db.votes.find({"room_id": room_id, "user_id": user_id}).sort("timestamp", -1).to_list(1000)
    return votes


async def calculate_photo_rankings(room_id: str) -> List[PhotoRanking]:
    """Calculate weighted rankings for all photos in a room"""
    # Get all photos
    photos = await db.photos.find({"room_id": room_id}).to_list(1000)
    
    # Calculate scores for each photo
    rankings = []
    for photo in photos:
        photo_id = str(photo["_id"])
        votes = await db.votes.find({"room_id": room_id, "photo_id": photo_id}).to_list(1000)
        
        if votes:
            weighted_score = sum(v["score"] for v in votes) / len(votes)
            vote_count = len(votes)
        else:
            weighted_score = 0
            vote_count = 0
        
        rankings.append(PhotoRanking(
            photo_id=photo_id,
            filename=photo.get("filename", ""),
            source_type=photo.get("source_type", "local"),
            path=photo.get("path"),
            drive_id=photo.get("drive_id"),
            drive_thumbnail_url=photo.get("drive_thumbnail_url"),
            weighted_score=weighted_score,
            vote_count=vote_count,
            rank=0  # Will be set after sorting
        ))
    
    # Sort by weighted score descending
    rankings.sort(key=lambda x: x.weighted_score, reverse=True)
    
    # Assign ranks
    for idx, ranking in enumerate(rankings, 1):
        ranking.rank = idx
    
    return rankings


# ==================== GOOGLE DRIVE SERVICE ====================

class GoogleDriveService:
    def __init__(self, access_token: str):
        credentials = Credentials(token=access_token)
        self.service = build('drive', 'v3', credentials=credentials)
    
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
    
    # Get photo count
    photo_count = await db.photos.count_documents({"room_id": room_id})
    
    room["_id"] = str(room["_id"])
    for p in participants:
        p["_id"] = str(p["_id"])
    
    return {
        "room": room,
        "participants": participants,
        "photo_count": photo_count
    }


@api_router.get("/rooms/{room_id}/participants")
async def get_room_participants(room_id: str):
    """Get all participants in a room"""
    participants = await db.room_participants.find({"room_id": room_id}).to_list(100)
    for p in participants:
        p["_id"] = str(p["_id"])
    return {"participants": participants}


# ==================== PHOTO IMPORT ROUTES ====================

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


@api_router.post("/photos/import")
async def import_photos(request: ImportPhotosRequest):
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
                await db.photos.insert_one(photo_dict)
                imported_count += 1
                current_index += 1
        
        elif request.source_type == "drive":
            # Import from Google Drive
            if not request.drive_folder_id or not request.drive_access_token:
                raise HTTPException(status_code=400, detail="Drive folder ID and access token required")
            
            drive_service = GoogleDriveService(request.drive_access_token)
            files = drive_service.list_images_in_folder(request.drive_folder_id)
            
            if not files:
                raise HTTPException(status_code=400, detail="No image files found in the Drive folder")
            
            # Get current max index
            max_photo = await db.photos.find_one(
                {"room_id": request.room_id},
                sort=[("index", -1)]
            )
            current_index = max_photo["index"] + 1 if max_photo else 0
            
            for file in files:
                photo_dict = {
                    "room_id": request.room_id,
                    "source_type": "drive",
                    "drive_id": file['id'],
                    "drive_thumbnail_url": file['thumbnail_url'],
                    "filename": file['name'],
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


@api_router.get("/photos/room/{room_id}")
async def get_room_photos(
    room_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get photos for a room with pagination"""
    total = await db.photos.count_documents({"room_id": room_id})
    
    photos = await db.photos.find({"room_id": room_id}).sort("index", 1).skip(skip).limit(limit).to_list(limit)
    
    for photo in photos:
        photo["_id"] = str(photo["_id"])
    
    return {
        "photos": photos,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@api_router.get("/photos/{photo_id}")
async def get_photo(photo_id: str):
    """Get a single photo"""
    photo = await db.photos.find_one({"_id": ObjectId(photo_id)})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    photo["_id"] = str(photo["_id"])
    return photo


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
    """Export top N photos"""
    # Get rankings
    rankings = await calculate_photo_rankings(request.room_id)
    
    # Get top N
    top_photos = rankings[:request.top_n]
    
    # Create export job
    job_dict = {
        "room_id": request.room_id,
        "top_n": request.top_n,
        "destination_type": request.destination_type,
        "destination_path": request.destination_path,
        "status": "completed",
        "created_at": datetime.utcnow()
    }
    job_result = await db.export_jobs.insert_one(job_dict)
    
    # Generate CSV report
    csv_data = "rank,photo_id,filename,score,votes\n"
    for photo in top_photos:
        csv_data += f"{photo.rank},{photo.photo_id},{photo.filename},{photo.weighted_score:.2f},{photo.vote_count}\n"
    
    return {
        "job_id": str(job_result.inserted_id),
        "status": "completed",
        "top_photos": [p.dict() for p in top_photos],
        "csv_report": csv_data
    }


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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
