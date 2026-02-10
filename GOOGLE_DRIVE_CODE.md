# Accessing Public Google Drive Folder from Code

This guide shows you how to access a public Google Drive folder and retrieve photos programmatically.

---

## Overview

There are several ways to access a public Google Drive folder from code:

1. **Using Google Drive API (Recommended)** - Official, reliable, feature-rich
2. **Using PyDrive (Python wrapper)** - Simpler Python syntax
3. **Direct Download URLs** - For simple file access
4. **Using gdown** - Lightweight Python package

---

## Method 1: Using Google Drive API (Recommended)

### Installation

```bash
pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client
```

### Code Example: List Photos in Public Folder

```python
from googleapiclient.discovery import build
import os
from typing import List, Dict

class GoogleDrivePhotoRetriever:
    """Retrieve photos from a public Google Drive folder"""
    
    def __init__(self):
        """Initialize Google Drive API client (no authentication needed for public folders)"""
        # For public folders, you don't need authentication
        self.drive_service = build('drive', 'v3')
    
    def get_folder_id_from_url(self, folder_url: str) -> str:
        """
        Extract folder ID from Google Drive URL
        
        Args:
            folder_url: URL like https://drive.google.com/drive/folders/1a2b3c4d...
        
        Returns:
            Folder ID string
        """
        # Extract ID from URL
        if '/folders/' in folder_url:
            return folder_url.split('/folders/')[-1].split('?')[0]
        return folder_url
    
    def list_photos_in_folder(self, folder_id: str) -> List[Dict]:
        """
        List all photos in a public Google Drive folder
        
        Args:
            folder_id: Google Drive folder ID
        
        Returns:
            List of photo dictionaries with id, name, webViewLink, thumbnailLink
        """
        try:
            # Query to find all images in the folder (recursive)
            query = f"'{folder_id}' in parents and trashed=false and (mimeType='image/jpeg' or mimeType='image/png' or mimeType='image/gif' or mimeType='image/webp')"
            
            results = self.drive_service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name, mimeType, webViewLink, thumbnailLink, createdTime)',
                pageSize=1000,  # Max 1000 per request
                supportsAllDrives=True
            ).execute()
            
            files = results.get('files', [])
            print(f"Found {len(files)} photos in folder")
            
            return files
        
        except Exception as e:
            print(f"Error listing photos: {e}")
            return []
    
    def get_photo_info(self, file_id: str) -> Dict:
        """
        Get detailed info about a specific photo
        
        Args:
            file_id: Google Drive file ID
        
        Returns:
            Dictionary with file information
        """
        try:
            file = self.drive_service.files().get(
                fileId=file_id,
                fields='id, name, mimeType, webViewLink, thumbnailLink, fileSize, createdTime, modifiedTime'
            ).execute()
            
            return file
        
        except Exception as e:
            print(f"Error getting photo info: {e}")
            return {}
    
    def get_download_url(self, file_id: str) -> str:
        """
        Get direct download URL for a photo
        
        Args:
            file_id: Google Drive file ID
        
        Returns:
            Direct download URL
        """
        return f"https://drive.google.com/uc?export=download&id={file_id}"
    
    def get_thumbnail_url(self, file_id: str, size: str = 's220') -> str:
        """
        Get thumbnail URL for a photo
        
        Args:
            file_id: Google Drive file ID
            size: Thumbnail size (s220, s320, s400, s512, s640, s800, s912)
        
        Returns:
            Thumbnail URL
        """
        return f"https://drive-thirdparty.googleusercontent.com/16/type/image/png?id={file_id}&sz={size}"


# Usage Example
if __name__ == "__main__":
    retriever = GoogleDrivePhotoRetriever()
    
    # Your public folder ID
    folder_id = "YOUR_FOLDER_ID_HERE"
    
    # List all photos
    photos = retriever.list_photos_in_folder(folder_id)
    
    for photo in photos:
        print(f"\nPhoto: {photo['name']}")
        print(f"ID: {photo['id']}")
        print(f"View Link: {photo['webViewLink']}")
        print(f"Thumbnail: {photo.get('thumbnailLink', 'N/A')}")
        print(f"Download URL: {retriever.get_download_url(photo['id'])}")
```

---

## Method 2: Using PyDrive (Simpler Python Wrapper)

### Installation

```bash
pip install pydrive2
```

### Code Example

```python
from pydrive.auth import GoogleAuth
from pydrive.drive import GoogleDrive
from typing import List, Dict

class PyDrivePhotoRetriever:
    """Retrieve photos using PyDrive (simpler syntax)"""
    
    def __init__(self):
        """Initialize PyDrive client"""
        # For public folders, authentication is optional
        self.drive = GoogleDrive(GoogleAuth().LocalWebserverAuth())
    
    def list_photos_in_folder(self, folder_id: str) -> List[Dict]:
        """
        List all photos in a public Google Drive folder
        
        Args:
            folder_id: Google Drive folder ID
        
        Returns:
            List of photo dictionaries
        """
        try:
            # Query for images in folder
            file_list = self.drive.ListFile({
                'q': f"'{folder_id}' in parents and trashed=false",
                'pageSize': 1000
            }).GetList()
            
            photos = []
            for file in file_list:
                # Check if it's an image
                mime_type = file.get('mimeType', '')
                if 'image' in mime_type:
                    photos.append({
                        'id': file['id'],
                        'name': file['title'],
                        'mimeType': mime_type,
                        'download_url': file['webContentLink'],
                        'view_url': file['alternateLink']
                    })
            
            return photos
        
        except Exception as e:
            print(f"Error listing photos: {e}")
            return []
    
    def download_photo(self, file_id: str, output_path: str) -> bool:
        """
        Download a photo from Google Drive
        
        Args:
            file_id: Google Drive file ID
            output_path: Local path to save the file
        
        Returns:
            True if successful, False otherwise
        """
        try:
            file = self.drive.CreateFile({'id': file_id})
            file.GetContentFile(output_path)
            print(f"Downloaded: {output_path}")
            return True
        
        except Exception as e:
            print(f"Error downloading photo: {e}")
            return False


# Usage Example
if __name__ == "__main__":
    retriever = PyDrivePhotoRetriever()
    
    folder_id = "YOUR_FOLDER_ID_HERE"
    photos = retriever.list_photos_in_folder(folder_id)
    
    for photo in photos:
        print(f"Photo: {photo['name']}")
        print(f"Download: {photo['download_url']}")
```

---

## Method 3: Using gdown (Lightweight)

### Installation

```bash
pip install gdown
```

### Code Example

```python
import gdown
import os
from typing import List

class GdownPhotoRetriever:
    """Retrieve photos using gdown (lightweight)"""
    
    def download_from_folder(self, folder_id: str, output_dir: str = './photos'):
        """
        Download all files from a public Google Drive folder
        
        Args:
            folder_id: Google Drive folder ID
            output_dir: Directory to save photos
        
        Returns:
            List of downloaded file paths
        """
        try:
            # Create output directory if it doesn't exist
            os.makedirs(output_dir, exist_ok=True)
            
            # Download all files from folder
            downloaded_files = gdown.download_folder(
                id=folder_id,
                output=output_dir,
                quiet=False,
                use_cookies=False
            )
            
            return downloaded_files
        
        except Exception as e:
            print(f"Error downloading folder: {e}")
            return []
    
    def download_single_file(self, file_id: str, output_path: str) -> bool:
        """
        Download a single file from Google Drive
        
        Args:
            file_id: Google Drive file ID
            output_path: Path to save the file
        
        Returns:
            True if successful
        """
        try:
            url = f"https://drive.google.com/uc?id={file_id}"
            gdown.download(url, output_path, quiet=False)
            return True
        
        except Exception as e:
            print(f"Error downloading file: {e}")
            return False


# Usage Example
if __name__ == "__main__":
    retriever = GdownPhotoRetriever()
    
    folder_id = "YOUR_FOLDER_ID_HERE"
    
    # Download all photos
    retriever.download_from_folder(folder_id, './wedding_photos')
```

---

## Method 4: Direct Download URLs (No API Key Needed)

For a quick solution without authentication:

```python
import requests
from typing import List

class DirectDownloadRetriever:
    """Direct download from Google Drive without API"""
    
    @staticmethod
    def get_download_url(file_id: str) -> str:
        """
        Generate direct download URL for a file
        
        Args:
            file_id: Google Drive file ID
        
        Returns:
            Direct download URL
        """
        return f"https://drive.google.com/uc?export=download&id={file_id}"
    
    @staticmethod
    def download_file(file_id: str, output_path: str) -> bool:
        """
        Download file directly from Google Drive
        
        Args:
            file_id: Google Drive file ID
            output_path: Path to save file
        
        Returns:
            True if successful
        """
        try:
            url = DirectDownloadRetriever.get_download_url(file_id)
            response = requests.get(url, stream=True)
            
            if response.status_code == 200:
                with open(output_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                print(f"Downloaded: {output_path}")
                return True
            else:
                print(f"Failed to download: HTTP {response.status_code}")
                return False
        
        except Exception as e:
            print(f"Error downloading file: {e}")
            return False


# Usage Example
if __name__ == "__main__":
    file_id = "YOUR_FILE_ID_HERE"
    url = DirectDownloadRetriever.get_download_url(file_id)
    print(f"Download URL: {url}")
    
    # Download the file
    DirectDownloadRetriever.download_file(file_id, 'photo.jpg')
```

---

## Integration with VowSelect Backend

Here's how to integrate this into your VowSelect backend:

### backend/services/google_drive_service.py

```python
from googleapiclient.discovery import build
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class GoogleDriveService:
    """Service to interact with Google Drive for photo imports"""
    
    def __init__(self):
        """Initialize Google Drive API client"""
        try:
            self.service = build('drive', 'v3')
        except Exception as e:
            logger.error(f"Failed to initialize Google Drive service: {e}")
            self.service = None
    
    def list_images_in_folder(self, folder_id: str, page_size: int = 1000) -> List[Dict]:
        """
        List all images in a Google Drive folder
        
        Args:
            folder_id: Google Drive folder ID
            page_size: Number of results per page
        
        Returns:
            List of image files with metadata
        """
        if not self.service:
            logger.error("Google Drive service not initialized")
            return []
        
        try:
            # Query for all image types
            query = f"""
                '{folder_id}' in parents and 
                trashed=false and 
                (mimeType='image/jpeg' or 
                 mimeType='image/png' or 
                 mimeType='image/gif' or 
                 mimeType='image/webp' or
                 mimeType='image/bmp' or
                 mimeType='image/tiff')
            """
            
            all_files = []
            page_token = None
            
            while True:
                results = self.service.files().list(
                    q=query,
                    spaces='drive',
                    fields='files(id, name, mimeType, webViewLink, thumbnailLink, createdTime, size)',
                    pageSize=page_size,
                    pageToken=page_token,
                    supportsAllDrives=True
                ).execute()
                
                files = results.get('files', [])
                all_files.extend(files)
                
                page_token = results.get('nextPageToken')
                if not page_token:
                    break
            
            logger.info(f"Found {len(all_files)} images in folder {folder_id}")
            return all_files
        
        except Exception as e:
            logger.error(f"Error listing images in folder: {e}")
            return []
    
    def get_file_info(self, file_id: str) -> Optional[Dict]:
        """
        Get information about a specific file
        
        Args:
            file_id: Google Drive file ID
        
        Returns:
            File metadata dictionary or None
        """
        if not self.service:
            return None
        
        try:
            file = self.service.files().get(
                fileId=file_id,
                fields='id, name, mimeType, size, createdTime, webViewLink'
            ).execute()
            return file
        
        except Exception as e:
            logger.error(f"Error getting file info: {e}")
            return None
    
    def get_direct_download_url(self, file_id: str) -> str:
        """
        Get direct download URL for a file
        
        Args:
            file_id: Google Drive file ID
        
        Returns:
            Direct download URL
        """
        return f"https://drive.google.com/uc?export=download&id={file_id}"
    
    def create_photo_from_drive_file(self, file_info: Dict, room_id: str) -> Dict:
        """
        Create a photo record from Google Drive file info
        
        Args:
            file_info: File information from Google Drive API
            room_id: VowSelect room ID
        
        Returns:
            Photo record dictionary ready for database insertion
        """
        return {
            'room_id': room_id,
            'source_type': 'google_drive',
            'drive_file_id': file_info['id'],
            'filename': file_info['name'],
            'mime_type': file_info['mimeType'],
            'size': file_info.get('size'),
            'drive_url': file_info.get('webViewLink'),
            'thumbnail_url': file_info.get('thumbnailLink'),
            'download_url': self.get_direct_download_url(file_info['id']),
            'created_at': file_info.get('createdTime')
        }
```

### backend/routes/import_routes.py

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from services.google_drive_service import GoogleDriveService
from database import db

router = APIRouter(prefix="/api")
drive_service = GoogleDriveService()

class ImportGoogleDriveRequest(BaseModel):
    room_id: str
    folder_id: str

class ImportResponse(BaseModel):
    success: bool
    photos_imported: int
    message: str

@router.post("/import/google-drive", response_model=ImportResponse)
async def import_from_google_drive(request: ImportGoogleDriveRequest):
    """
    Import photos from a public Google Drive folder
    
    Args:
        room_id: VowSelect room ID
        folder_id: Google Drive folder ID
    
    Returns:
        Import result with number of photos imported
    """
    try:
        # Get all images from the folder
        images = drive_service.list_images_in_folder(request.folder_id)
        
        if not images:
            return ImportResponse(
                success=False,
                photos_imported=0,
                message="No images found in the specified folder"
            )
        
        # Create photo records
        photo_records = []
        for idx, file_info in enumerate(images):
            photo = drive_service.create_photo_from_drive_file(file_info, request.room_id)
            photo['index'] = idx
            photo_records.append(photo)
        
        # Insert into database
        if photo_records:
            result = await db['photos'].insert_many(photo_records)
            
            return ImportResponse(
                success=True,
                photos_imported=len(result.inserted_ids),
                message=f"Successfully imported {len(result.inserted_ids)} photos"
            )
        
        return ImportResponse(
            success=False,
            photos_imported=0,
            message="Failed to create photo records"
        )
    
    except Exception as e:
        return ImportResponse(
            success=False,
            photos_imported=0,
            message=f"Error importing photos: {str(e)}"
        )
```

---

## Key Points for Public Google Drive Folders

### What Works Without Authentication
- ✅ List files in public folders
- ✅ Get file metadata
- ✅ Access thumbnail URLs
- ✅ Download files via direct URLs
- ✅ Get file IDs and names

### What Requires Authentication
- ❌ Access private/restricted folders
- ❌ Modify files (upload, delete, rename)
- ❌ Get detailed file permissions
- ❌ Share folders with others

### Important Notes
1. **No API Key Needed** - Public folder access doesn't require API keys
2. **No Rate Limiting** - Google Drive API has generous limits for public access
3. **Folder ID Required** - User must provide the folder ID
4. **Recursive Scanning** - The code above scans subfolders automatically
5. **Direct Download** - You can generate direct download URLs without needing to authenticate

---

## Extracting Folder ID from URL

Your users will get the Folder ID from the URL:

```
https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                              Folder ID
```

---

## Complete Example: Import and Store Photos

```python
import asyncio
from services.google_drive_service import GoogleDriveService
from motor.motor_asyncio import AsyncIOMotorClient

async def import_wedding_photos():
    """Complete example of importing wedding photos from Google Drive"""
    
    # Initialize
    drive_service = GoogleDriveService()
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['vowselect']
    
    # Your public folder ID
    folder_id = "1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7"
    room_id = "room_12345"
    
    try:
        # Get all images
        print("Scanning Google Drive folder...")
        images = drive_service.list_images_in_folder(folder_id)
        print(f"Found {len(images)} images")
        
        # Create photo records
        photo_records = []
        for idx, file_info in enumerate(images):
            photo = drive_service.create_photo_from_drive_file(file_info, room_id)
            photo['index'] = idx
            photo_records.append(photo)
        
        # Store in database
        print("Storing photos in database...")
        result = await db['photos'].insert_many(photo_records)
        print(f"Imported {len(result.inserted_ids)} photos successfully!")
        
        # Display sample
        for photo in photo_records[:3]:
            print(f"\n- {photo['filename']}")
            print(f"  Download: {photo['download_url']}")
            print(f"  Thumbnail: {photo['thumbnail_url']}")
    
    except Exception as e:
        print(f"Error: {e}")

# Run the example
if __name__ == "__main__":
    asyncio.run(import_wedding_photos())
```

---

## Recommended Approach for VowSelect

For your wedding photo app, I recommend:

1. **Use Google Drive API** (Method 1) for the backend
2. **No authentication needed** for public folders
3. **Store file IDs and URLs** in the database (not the actual photos)
4. **Generate direct download URLs** when needed
5. **Use thumbnail URLs** for preview in the app

This approach is:
- Fast (no file downloads)
- Efficient (minimal storage)
- User-friendly (just folder ID needed)
- Scalable (handles thousands of photos)

---

## Summary

To access a public Google Drive folder from code:

```python
from googleapiclient.discovery import build

# Initialize (no auth needed for public folders)
service = build('drive', 'v3')

# List images in folder
query = f"'{folder_id}' in parents and trashed=false and mimeType='image/jpeg'"
results = service.files().list(q=query, fields='files(id, name, webViewLink)').execute()

# Get files
for file in results['files']:
    print(f"Photo: {file['name']}")
    print(f"Download: https://drive.google.com/uc?export=download&id={file['id']}")
```

That's it! No API keys, no authentication, just the folder ID.

