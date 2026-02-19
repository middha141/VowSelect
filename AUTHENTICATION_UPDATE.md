# Google Authentication & Room Names Update

## Overview

This update adds comprehensive Google Sign-in functionality to VowSelect, along with room naming features. Users can now:

- **Sign in with Google** to access Drive import/export features
- **Skip sign-in** to use the app as a guest
- **Create named rooms** for better organization
- **Sign out** from any page
- View their **Google profile** when authenticated
- See **authentication prompts** when trying to use Drive features without signing in

## What Changed

### Backend Changes

#### 1. Database Schema Updates

**Users Collection:**
- Added `is_guest` (Boolean) - Distinguishes between guest and Google users
- Added `google_id` (String) - Google account ID for authenticated users
- Added `email` (String) - User's email address
- Added `display_name` (String) - Full name from Google
- Added `profile_picture` (String) - Profile picture URL
- Added `last_login` (DateTime) - Last login timestamp

**Rooms Collection:**
- Added `name` (String) - Optional room name

#### 2. New Authentication Endpoints

- **GET `/api/auth/login`** - Initiate Google OAuth for user login
- **GET `/api/auth/callback/login`** - Handle OAuth callback and create JWT token
- **GET `/api/auth/verify`** - Verify JWT token validity
- **GET `/api/auth/me`** - Get current authenticated user
- **POST `/api/auth/logout`** - Logout (client clears token)

#### 3. JWT Token Management

- Added JWT token creation with 7-day expiration
- Token includes: user_id, email, is_guest status
- Secret key from environment variable: `SECRET_KEY`

#### 4. Authentication Middleware

- Drive import operations now require Google authentication
- Drive export operations now require Google authentication
- Returns 401/403 errors with clear messages when unauthenticated

#### 5. Updated Endpoints

- **POST `/api/rooms`** - Now accepts `CreateRoomRequest` body with `creator_id` and optional `name`
- **GET `/api/users/{user_id}/rooms`** - Get all rooms a user is part of (creator or participant)

### Frontend Changes

#### 1. New Pages

**login.tsx** - Login Page
- Google Sign-in button with OAuth flow
- Skip sign-in option for guest users
- Shows benefits of signing in
- Auto-redirects if already authenticated

**login-callback.tsx** - OAuth Callback Handler
- Handles deep link callback from Google OAuth
- Saves JWT token to AsyncStorage
- Redirects to main page after successful login

#### 2. Updated Pages

**index.tsx** - Main Page
- Shows authenticated user info with profile picture
- Room name input when creating rooms
- Sign-out button at top
- Prompt to sign in if guest user
- Enhanced user info display

**room/[id].tsx** - Room Page
- Sign-out button at top right
- Authentication check before Drive import
- Dialog prompt to sign in when unauthenticated user attempts Drive operations

#### 3. New Components

**components/SignOutButton.tsx** - Reusable Sign-out Button
- Shows confirmation dialog
- Clears auth token
- Redirects to login page
- Prevents back navigation

#### 4. Updated API Service

**services/api.ts**
- Added axios interceptor to include JWT token in all requests
- New functions:
  - `initiateGoogleLogin()` - Start OAuth flow
  - `verifyAuthToken()` - Verify token
  - `logout()` - Clear auth state
  - `getCurrentAuthUser()` - Get authenticated user
  - `saveAuthToken()` / `getCurrentAuthToken()` / `clearAuthToken()` - Token management
  - `getUserRooms()` - Get user's rooms
- Updated `createRoom()` to accept optional room name

## Setup Instructions

### 1. Update Database Schema

Run the schema migration to update existing collections:

```bash
cd backend
python update_schema.py
```

This will:
- Add new fields to users collection
- Mark existing users as guests
- Add name field to rooms collection
- Add default names to existing rooms

### 2. Update Environment Variables

Add to `backend/.env`:

```env
# Required: Secret key for JWT tokens (generate with below command)
SECRET_KEY=your_generated_secret_key_here

# Required: Google OAuth credentials (same as before, but add login redirect)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:8001/api/auth/callback
GOOGLE_LOGIN_REDIRECT_URI=http://localhost:8001/api/auth/callback/login
```

Generate a secret key:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Update Google Cloud Console

Add the new redirect URI to your Google OAuth credentials:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services > Credentials
3. Edit your OAuth 2.0 Client ID
4. Add to "Authorized redirect URIs":
   - `http://localhost:8001/api/auth/callback/login` (for user login)
   - Keep existing `http://localhost:8001/api/auth/callback` (for Drive access)

### 4. Install Frontend Dependencies

All required dependencies are already in package.json:
- `expo-web-browser` - For OAuth web browser
- `expo-linking` - For deep link handling

If needed, run:
```bash
cd frontend
npm install
```

### 5. Restart Backend Server

```bash
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

### 6. Test Deep Links (Mobile)

Add to `frontend/app.json` if not present:

```json
{
  "expo": {
    "scheme": "vowselect",
    "ios": {
      "bundleIdentifier": "com.yourcompany.vowselect"
    },
    "android": {
      "package": "com.yourcompany.vowselect"
    }
  }
}
```

## User Flow

### New User Flow

1. **First Visit** → Login Page
   - Option 1: Sign in with Google → Full access
   - Option 2: Skip sign in → Guest mode

2. **Guest User**
   - Can create/join rooms
   - Can swipe and vote
   - **Cannot** import from Drive
   - **Cannot** export to Drive
   - Prompted to sign in when attempting Drive operations

3. **Authenticated User**
   - Full Drive import/export access
   - Profile displayed
   - Rooms persist across devices
   - Can sign out from any page

### Sign-in Required Dialog

When a guest user tries to use Drive features:
```
Title: "Sign in Required"
Message: "You must be signed in with Google to import/export photos from Google Drive."
Buttons: [Cancel] [Sign In]
```

### Sign-out Flow

When user clicks "Sign Out":
```
Title: "Sign Out"
Message: "Are you sure you want to sign out? You will be returned to the login page."
Buttons: [Cancel] [Sign Out]
Action: Clears token → Redirects to /login → No back navigation
```

## Security Features

1. **JWT Tokens** - 7-day expiration, includes user context
2. **Authentication Middleware** - Blocks Drive operations for guests
3. **Token Verification** - Every request validates token
4. **Secure Redirects** - No back navigation after sign-out

## API Changes Summary

### New Endpoints
- `GET /api/auth/login` - Initiate Google login
- `GET /api/auth/callback/login` - Handle login callback
- `GET /api/auth/verify` - Verify token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `GET /api/users/{user_id}/rooms` - Get user's rooms

### Modified Endpoints
- `POST /api/rooms` - Now requires body: `{creator_id, name?}`
- `POST /api/photos/import` - Requires auth token for Drive imports
- `POST /api/export` - Requires auth token for Drive exports

### Response Models Updated
- `User` - Added: is_guest, google_id, email, display_name, profile_picture, last_login
- `Room` - Added: name
- `CreateRoomResponse` - Added: name

## Testing Checklist

- [ ] Run schema migration: `python backend/update_schema.py`
- [ ] Add SECRET_KEY and GOOGLE_LOGIN_REDIRECT_URI to .env
- [ ] Update Google Cloud Console redirect URIs
- [ ] Restart backend server
- [ ] Test Google sign-in flow
- [ ] Test skip sign-in flow
- [ ] Test creating room with name
- [ ] Test Drive import as guest (should prompt to sign in)
- [ ] Test Drive import as authenticated user (should work)
- [ ] Test sign-out functionality
- [ ] Verify no back navigation after sign-out
- [ ] Test authentication persistence across app restarts

## Migration Notes

### Existing Data
- All existing users will be marked as `is_guest: true`
- All existing rooms will get default names: "Room {code}"
- No data loss occurs
- Existing functionality remains intact

### Backward Compatibility
- Guest users can continue using the app as before
- Authentication is optional via "Skip sign-in"
- Drive operations maintain same behavior for authenticated users

## Troubleshooting

### "Invalid or expired token"
- User's JWT token expired (7 days)
- Solution: User needs to sign in again

### "You must be signed in with Google"
- Guest user attempting Drive operation
- Solution: User should sign in from login page or prompt

### OAuth callback not working
- Check GOOGLE_LOGIN_REDIRECT_URI in .env
- Verify redirect URI in Google Cloud Console
- For mobile: Ensure deep link scheme is configured in app.json

### Profile picture not showing
- Check network permissions
- User might not have Google profile picture
- Non-issue, gracefully handles missing pictures

## Next Steps

Optional enhancements you could add:
1. **My Rooms Page** - List all rooms user is part of
2. **Refresh Tokens** - Extend sessions beyond 7 days
3. **Social Sharing** - Share room codes via messaging apps
4. **Remember Device** - Extended sessions for returning users
5. **Multi-device Sync** - Real-time updates across devices
6. **Profile Management** - Edit display name, avatar

---

**Questions?** Check the implementation files:
- Backend: `backend/server.py`
- Frontend: `frontend/app/login.tsx`, `frontend/services/api.ts`
- Database: `backend/database/init_db.py`, `backend/update_schema.py`
