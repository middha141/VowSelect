# Google Drive Integration Guide for VowSelect

This guide explains how to set up Google Drive access for importing photos into VowSelect.

## 📋 Overview

VowSelect can import photos directly from Google Drive folders. You have two main options:

1. **Using a Public Google Drive Folder** (Simplest)
2. **Using OAuth 2.0 Authentication** (Most Secure)

---

## Option 1: Using a Public Google Drive Folder (Recommended for Simple Sharing)

### Prerequisites
- A Google Account
- A Google Drive folder with photos
- Internet connection

### Step 1: Create or Use an Existing Google Drive Folder

1. Go to [Google Drive](https://drive.google.com)
2. Create a new folder or use an existing one
3. Name it something like "Wedding Photos" or "VowSelect Photos"

### Step 2: Get Your Folder ID

The **Folder ID** is a unique identifier for your Google Drive folder.

**Method A: From the URL**
1. Open your folder in Google Drive
2. Look at the browser URL - it will look like:
   ```
   https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7
   ```
3. Copy the part after `/folders/` - that's your **Folder ID**
   ```
   1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7
   ```

**Method B: Right-click in Google Drive**
1. Right-click on your folder
2. Click "Get link"
3. Copy the link
4. Extract the Folder ID from the URL (same format as Method A)

### Step 3: Make the Folder Public (Optional)

If you want anyone to access the folder without authentication:

1. Right-click on the folder in Google Drive
2. Click **"Share"**
3. Click the **"Change"** button (next to "Restricted")
4. Select **"Anyone with the link"**
5. Change permission to **"Viewer"**
6. Click **"Share"**
7. Copy and share the link with others

**Note**: This makes the folder public. Anyone with the link can view your photos.

### Step 4: Use in VowSelect

In the VowSelect app:

1. Go to your room
2. Select **"Import from Google Drive"**
3. Enter your **Folder ID** (from Step 2)
4. Leave the access token field empty (not needed for public folders)
5. Click **"Import Photos"**

VowSelect will:
- Scan your folder for all image files
- Recursively check subfolders
- Import photos with their Drive IDs (not the actual files)

---

## Option 2: Using OAuth 2.0 Authentication (Most Secure)

This option is more secure and gives you full control over permissions.

### Prerequisites
- A Google Account
- Google Cloud Console access
- The VowSelect app

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click **"NEW PROJECT"**
4. Enter a project name (e.g., "VowSelect")
5. Click **"CREATE"**
6. Wait for the project to be created

### Step 2: Enable Google Drive API

1. In the Google Cloud Console, go to **"APIs & Services"** > **"Library"**
2. Search for **"Google Drive API"**
3. Click on **"Google Drive API"**
4. Click the **"ENABLE"** button
5. Wait for it to enable (usually takes a few seconds)

### Step 3: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** > **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**
4. If prompted to create a consent screen first:
   - Click **"CREATE CONSENT SCREEN"**
   - Select **"External"** user type
   - Click **"CREATE"**
   - Fill in the app name (e.g., "VowSelect")
   - Add your email as the contact
   - Click **"SAVE AND CONTINUE"**
   - Skip scopes and click **"SAVE AND CONTINUE"**
   - Add your email as a test user
   - Click **"SAVE AND CONTINUE"**
   - Click **"BACK TO DASHBOARD"**

5. Now create the OAuth client ID:
   - Go back to **"Credentials"**
   - Click **"+ CREATE CREDENTIALS"**
   - Select **"OAuth client ID"**
   - Select **"Desktop application"** (or **"Web application"** if using on a server)
   - Click **"CREATE"**
   - Click **"DOWNLOAD JSON"** to download your credentials file
   - Save this file securely

### Step 4: Get an Access Token

You have two options to get an access token:

#### Option 2A: Using Google OAuth 2.0 Playground (Easy, but token expires in 1 hour)

1. Go to [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the **gear icon** (⚙️) in the top right
3. Check **"Use your own OAuth credentials"**
4. Enter your Client ID and Client Secret (from the JSON file you downloaded)
5. Click **"Close"**
6. On the left side, search for **"Google Drive API v3"**
7. Select the scopes you want:
   - For read-only access: Select **"https://www.googleapis.com/auth/drive.readonly"**
   - For full access: Select **"https://www.googleapis.com/auth/drive"**
8. Click **"Authorize APIs"**
9. Select your Google account
10. Click **"Allow"** when prompted
11. In Step 2, click **"Exchange authorization code for tokens"**
12. Copy the **"Access Token"** (you'll see it in the result)

#### Option 2B: Using VowSelect Backend (Recommended for Production)

If you're running the VowSelect backend locally, you can use the backend's built-in OAuth flow. Contact your backend administrator for details.

### Step 5: Use in VowSelect

In the VowSelect app:

1. Go to your room
2. Select **"Import from Google Drive"**
3. Enter your **Folder ID** (see Option 1, Step 2)
4. Enter your **Access Token** (from Step 4)
5. Click **"Import Photos"**

**Important**: Access tokens from the OAuth Playground expire in **1 hour**. You'll need to refresh the token if importing again later.

---

## Option 3: Using Service Account (Advanced - For Automated Imports)

If you want to automate photo imports without user intervention, use a Service Account.

### Prerequisites
- Google Cloud Project (from Option 2)
- Administrator access to Google Cloud Console

### Step 1: Create a Service Account

1. In Google Cloud Console, go to **"APIs & Services"** > **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"**
3. Select **"Service Account"**
4. Enter a service account name (e.g., "vowselect-service")
5. Click **"CREATE AND CONTINUE"**
6. Skip the optional steps and click **"DONE"**

### Step 2: Create a Key

1. Click on the service account you just created
2. Go to the **"Keys"** tab
3. Click **"Add Key"** > **"Create new key"**
4. Select **"JSON"**
5. Click **"CREATE"**
6. A JSON file will download - keep it safe!

### Step 3: Share the Drive Folder with Service Account

1. Open the JSON key file and find the **"client_email"** field
2. In Google Drive, right-click on your folder
3. Click **"Share"**
4. Paste the client email in the sharing dialog
5. Give it **"Editor"** permissions (or **"Viewer"** if read-only)
6. Click **"Share"**

### Step 4: Configure VowSelect Backend

In your backend `.env` file, add:
```
GOOGLE_SERVICE_ACCOUNT_KEY=path/to/your/service-account-key.json
```

This allows the backend to automatically access Google Drive folders without user authentication.

---

## 📊 Comparison: Which Option Should I Use?

| Option | Best For | Pros | Cons |
|--------|----------|------|------|
| **Public Folder** | Simple sharing, wedding guests | No authentication needed, easy setup | Folder is public to anyone with link |
| **OAuth 2.0** | Individual users | Secure, user controls permissions | Token expires (1 hour for Playground) |
| **Service Account** | Automated imports, backend | Doesn't expire, fully automated | Requires backend configuration |

---

## 🔍 Troubleshooting Google Drive Integration

### Issue: "Folder not found" or "Access denied"

**Solutions:**
1. Verify the Folder ID is correct (copy from URL again)
2. Check that the folder exists and isn't deleted
3. If using OAuth, ensure the access token hasn't expired
4. If using Service Account, verify the email is shared with the folder

### Issue: "No photos found in folder"

**Solutions:**
1. Ensure the folder contains image files (JPEG, PNG, GIF, WebP, etc.)
2. Check that subfolders also have images (VowSelect scans recursively)
3. Verify the access token has permission to read files
4. Check that images aren't in a shared folder you don't have access to

### Issue: "Access token expired"

**Solutions:**
1. Generate a new access token using the OAuth Playground
2. Re-enter the new token in the VowSelect app
3. Try importing again

### Issue: "Invalid credentials"

**Solutions:**
1. Double-check the Folder ID (no extra spaces)
2. Verify the access token is complete and not truncated
3. Try generating a new access token
4. Check that you're using the correct Google account

---

## 🔐 Security Best Practices

### For Public Folders
- ✅ Safe to share link publicly
- ✅ Great for open wedding photo sharing
- ⚠️ Anyone with the link can see all photos

### For OAuth 2.0
- ✅ Secure - user controls permissions
- ✅ Can revoke access anytime
- ⚠️ Token expires and needs refresh
- **Never share your access token with untrusted people**

### For Service Accounts
- ✅ Most secure for automated systems
- ✅ No token expiration
- ⚠️ Key file must be kept secure
- **Never commit the service account key to version control**
- **Store the key file in a secure location**

---

## 📱 Step-by-Step: Using VowSelect with Google Drive

### Scenario 1: Sharing wedding photos with family

1. Create a Google Drive folder with wedding photos
2. Make it public (Share > Anyone with link)
3. Get the Folder ID from the URL
4. In VowSelect app:
   - Create or join a room
   - Click "Import from Google Drive"
   - Enter the Folder ID
   - Leave access token empty
   - Click "Import"
5. Share the room code with family members
6. Everyone can start voting!

### Scenario 2: Importing client photos (professional use)

1. Set up OAuth 2.0 (Option 2)
2. Get an access token from Google OAuth Playground
3. In VowSelect app:
   - Create a new room
   - Click "Import from Google Drive"
   - Enter Folder ID and access token
   - Click "Import"
4. Share room code with clients
5. Clients vote and rank photos

### Scenario 3: Automated backend imports (advanced)

1. Set up a Service Account (Option 3)
2. Configure backend `.env` with service account key
3. Backend can automatically scan and import photos
4. No user intervention needed
5. Great for batch processing

---

## 🎯 Supported Image Formats

VowSelect supports the following image formats from Google Drive:
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- BMP (.bmp)
- TIFF (.tiff, .tif)
- SVG (.svg)

---

## ❓ FAQ

**Q: Do I need to download photos to use them in VowSelect?**
A: No! VowSelect only stores references to photos (Folder ID, File ID, thumbnail URL). Photos remain in Google Drive.

**Q: Can I import from multiple Google Drive folders?**
A: Currently, each room can import from one folder at a time. You can create multiple rooms for different folders.

**Q: What happens if someone deletes a photo from Google Drive?**
A: The photo will no longer be accessible in VowSelect. The voting data for that photo is preserved.

**Q: Can I use a shared folder that someone else owns?**
A: Yes, as long as they've shared the folder with you. The folder will need to be shared with your Google account.

**Q: How many photos can I import?**
A: VowSelect can handle large collections. The app uses pagination, so performance remains smooth even with thousands of photos.

**Q: Do I need a Google Cloud project for public folders?**
A: No! For public folders, you only need the Folder ID. OAuth and Service Accounts are only needed for more advanced use cases.

**Q: Can multiple people vote at the same time?**
A: Yes! VowSelect is designed for real-time multi-user voting. All participants can vote simultaneously.

---

## 📞 Need Help?

- Check the main [README.md](./README.md) for general setup instructions
- Review the [QUICKSTART.md](./QUICKSTART.md) for a quick overview
- Open an issue on GitHub for specific problems

---

**Happy photo voting! 📸**
