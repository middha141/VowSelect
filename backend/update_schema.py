"""
Script to update the import_jobs collection schema to include 'upload' source_type
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import OperationFailure
from pymongo.server_api import ServerApi
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


async def update_import_jobs_schema():
    """Update the import_jobs collection validator to include 'upload' source_type"""
    
    # Connect to MongoDB using environment variable (same as server.py)
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "vowselect")
    
    client = AsyncIOMotorClient(mongo_url, server_api=ServerApi('1'))
    db = client[db_name]
    
    print(f"Connecting to database: {db_name}")
    print(f"MongoDB URL (first 30 chars): {mongo_url[:30]}...")
    
    try:
        # Check if collection exists
        collections = await db.list_collection_names()
        collection_exists = "import_jobs" in collections
        
        if collection_exists:
            print("Collection 'import_jobs' exists, updating validator...")
            # Update the validator for existing import_jobs collection
            await db.command({
                "collMod": "import_jobs",
                "validator": {
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
            })
            print("✓ Successfully updated import_jobs collection schema")
        else:
            print("Collection 'import_jobs' does not exist yet.")
            print("✓ It will be created with the correct schema when the server starts")

        
    except OperationFailure as e:
        print(f"✗ Failed to update schema: {e}")
        raise
    
    finally:
        client.close()


async def update_photos_schema():
    """Update the photos collection validator to include compressed_data and compressed_size_kb"""
    
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "vowselect")
    
    client = AsyncIOMotorClient(mongo_url, server_api=ServerApi('1'))
    db = client[db_name]
    
    print(f"Connecting to database: {db_name}")
    
    try:
        collections = await db.list_collection_names()
        collection_exists = "photos" in collections
        
        if collection_exists:
            print("Collection 'photos' exists, updating validator...")
            await db.command({
                "collMod": "photos",
                "validator": {
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
            })
            print("✓ Successfully updated photos collection schema")
        else:
            print("Collection 'photos' does not exist yet.")
            print("✓ It will be created with the correct schema when the server starts")
    
    except OperationFailure as e:
        print(f"✗ Failed to update photos schema: {e}")
        raise
    
    finally:
        client.close()


async def update_users_schema():
    """Update the users collection to support Google authentication"""
    
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "vowselect")
    
    client = AsyncIOMotorClient(mongo_url, server_api=ServerApi('1'))
    db = client[db_name]
    
    print(f"Connecting to database: {db_name}")
    
    try:
        collections = await db.list_collection_names()
        collection_exists = "users" in collections
        
        if collection_exists:
            print("Collection 'users' exists, updating validator...")
            await db.command({
                "collMod": "users",
                "validator": {
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
            })
            print("✓ Successfully updated users collection schema")
            
            # Add index on google_id (sparse index - only for non-null values)
            await db['users'].create_index("google_id", unique=True, sparse=True)
            print("✓ Added google_id index")
            
            # Add index on email (sparse index)
            await db['users'].create_index("email", sparse=True)
            print("✓ Added email index")
            
            # Update existing users to have is_guest = True
            result = await db['users'].update_many(
                {"is_guest": {"$exists": False}},
                {"$set": {"is_guest": True}}
            )
            print(f"✓ Updated {result.modified_count} existing users to mark as guests")
            
        else:
            print("Collection 'users' does not exist yet.")
            print("✓ It will be created with the correct schema when the server starts")
    
    except OperationFailure as e:
        print(f"✗ Failed to update users schema: {e}")
        raise
    
    finally:
        client.close()


async def update_rooms_schema():
    """Update the rooms collection to include room names"""
    
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "vowselect")
    
    client = AsyncIOMotorClient(mongo_url, server_api=ServerApi('1'))
    db = client[db_name]
    
    print(f"Connecting to database: {db_name}")
    
    try:
        collections = await db.list_collection_names()
        collection_exists = "rooms" in collections
        
        if collection_exists:
            print("Collection 'rooms' exists, updating validator...")
            await db.command({
                "collMod": "rooms",
                "validator": {
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
            })
            print("✓ Successfully updated rooms collection schema")
            
            # Add default room name for existing rooms (based on code)
            result = await db['rooms'].update_many(
                {"name": {"$exists": False}},
                [{"$set": {"name": {"$concat": ["Room ", "$code"]}}}]
            )
            print(f"✓ Added default names to {result.modified_count} existing rooms")
            
        else:
            print("Collection 'rooms' does not exist yet.")
            print("✓ It will be created with the correct schema when the server starts")
    
    except OperationFailure as e:
        print(f"✗ Failed to update rooms schema: {e}")
        raise
    
    finally:
        client.close()


async def update_all_schemas():
    """Run all schema updates"""
    await update_import_jobs_schema()
    await update_photos_schema()
    await update_users_schema()
    await update_rooms_schema()


if __name__ == "__main__":
    asyncio.run(update_all_schemas())
