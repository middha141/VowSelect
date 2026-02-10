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


if __name__ == "__main__":
    asyncio.run(update_import_jobs_schema())
