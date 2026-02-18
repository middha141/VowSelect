"""
Database initialization module for VowSelect.
Creates collections, indexes, and validation rules on startup.
"""

import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class DatabaseInitializer:
    """Initialize MongoDB database with collections, indexes, and validation"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def initialize(self):
        """Initialize all collections, indexes, and validation"""
        logger.info("Initializing MongoDB database...")
        
        try:
            # Get list of existing collections
            existing_collections = await self.db.list_collection_names()
            logger.info(f"Found {len(existing_collections)} existing collections")
            
            # Create collections if they don't exist
            if "users" not in existing_collections:
                await self.create_users_collection()
            else:
                logger.info("✓ 'users' collection already exists")
            
            if "rooms" not in existing_collections:
                await self.create_rooms_collection()
            else:
                logger.info("✓ 'rooms' collection already exists")
            
            if "room_participants" not in existing_collections:
                await self.create_room_participants_collection()
            else:
                logger.info("✓ 'room_participants' collection already exists")
            
            if "photos" not in existing_collections:
                await self.create_photos_collection()
            else:
                logger.info("✓ 'photos' collection already exists")
            
            if "votes" not in existing_collections:
                await self.create_votes_collection()
            else:
                logger.info("✓ 'votes' collection already exists")
            
            if "import_jobs" not in existing_collections:
                await self.create_import_jobs_collection()
            else:
                logger.info("✓ 'import_jobs' collection already exists")
            
            if "export_jobs" not in existing_collections:
                await self.create_export_jobs_collection()
            else:
                logger.info("✓ 'export_jobs' collection already exists")
            
            logger.info("✓ Database initialization completed successfully")
        
        except Exception as e:
            logger.error(f"✗ Database initialization failed: {e}")
            raise
    
    async def create_users_collection(self):
        """Create users collection with validation"""
        logger.info("Creating 'users' collection...")
        
        await self.db.create_collection(
            "users",
            validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["username", "created_at", "is_guest"],
                    "properties": {
                        "_id": {"bsonType": "objectId"},
                        "username": {
                            "bsonType": "string",
                            "description": "Username (guest) or display name (Google user)"
                        },
                        "is_guest": {
                            "bsonType": "bool",
                            "description": "Whether this is a guest user or Google-authenticated user"
                        },
                        "google_id": {
                            "bsonType": "string",
                            "description": "Google user ID (for authenticated users)"
                        },
                        "email": {
                            "bsonType": "string",
                            "description": "Email address (for authenticated users)"
                        },
                        "display_name": {
                            "bsonType": "string",
                            "description": "Full display name from Google (for authenticated users)"
                        },
                        "profile_picture": {
                            "bsonType": "string",
                            "description": "Profile picture URL from Google (for authenticated users)"
                        },
                        "created_at": {
                            "bsonType": "date",
                            "description": "Account creation timestamp"
                        },
                        "last_login": {
                            "bsonType": "date",
                            "description": "Last login timestamp (for authenticated users)"
                        }
                    }
                }
            }
        )
        
        await self.db['users'].create_index("username", unique=True)
        await self.db['users'].create_index("google_id", unique=True, sparse=True)
        await self.db['users'].create_index("email", sparse=True)
        logger.info("✓ 'users' collection created with indexes")
    
    async def create_rooms_collection(self):
        """Create rooms collection with validation"""
        logger.info("Creating 'rooms' collection...")
        
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
                        "name": {
                            "bsonType": "string",
                            "description": "Room name (optional)"
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
        
        await self.db['rooms'].create_index("code", unique=True)
        await self.db['rooms'].create_index("creator_id")
        logger.info("✓ 'rooms' collection created with indexes")
    
    async def create_room_participants_collection(self):
        """Create room_participants collection with validation"""
        logger.info("Creating 'room_participants' collection...")
        
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
        
        await self.db['room_participants'].create_index(
            [("room_id", 1), ("user_id", 1)], 
            unique=True
        )
        await self.db['room_participants'].create_index("room_id")
        await self.db['room_participants'].create_index("user_id")
        logger.info("✓ 'room_participants' collection created with indexes")
    
    async def create_photos_collection(self):
        """Create photos collection with validation"""
        logger.info("Creating 'photos' collection...")
        
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
                        "compressed_data": {
                            "bsonType": "string",
                            "description": "Compressed base64 image for mobile (always stored for uploads)"
                        },
                        "compressed_size_kb": {
                            "bsonType": "double",
                            "description": "Size of compressed image in KB (optional)"
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
        
        await self.db['photos'].create_index("room_id")
        await self.db['photos'].create_index([("room_id", 1), ("index", 1)])
        logger.info("✓ 'photos' collection created with indexes")
    
    async def create_votes_collection(self):
        """Create votes collection with validation"""
        logger.info("Creating 'votes' collection...")
        
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
        
        await self.db['votes'].create_index(
            [("room_id", 1), ("photo_id", 1), ("user_id", 1)], 
            unique=True
        )
        await self.db['votes'].create_index("room_id")
        await self.db['votes'].create_index("photo_id")
        await self.db['votes'].create_index("user_id")
        logger.info("✓ 'votes' collection created with indexes")
    
    async def create_import_jobs_collection(self):
        """Create import_jobs collection with validation"""
        logger.info("Creating 'import_jobs' collection...")
        
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
                            "enum": ["local", "drive", "upload"],
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
        
        await self.db['import_jobs'].create_index("room_id")
        await self.db['import_jobs'].create_index("status")
        logger.info("✓ 'import_jobs' collection created with indexes")
    
    async def create_export_jobs_collection(self):
        """Create export_jobs collection with validation"""
        logger.info("Creating 'export_jobs' collection...")
        
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
        
        await self.db['export_jobs'].create_index("room_id")
        await self.db['export_jobs'].create_index("status")
        logger.info("✓ 'export_jobs' collection created with indexes")
