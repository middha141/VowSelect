# VowSelect - Quick Start Guide

## 🚀 What is VowSelect?

VowSelect is a **collaborative wedding photo selection app** that lets multiple users vote on photos together using a Tinder-style swipe interface. Perfect for couples, wedding planners, and families to select the best photos from their wedding!

## ✨ Key Features

- 💑 **No Authentication Required** - Just enter a username and start
- 🎴 **Tinder-Style Swipe** - Swipe right to like, left to dislike
- 🔢 **5-Digit Room Codes** - Easy sharing with friends and family
- 📁 **Multiple Import Sources** - Local files or Google Drive
- ⭐ **Weighted Voting** - Score from -3 to +3 for precise ranking
- 👥 **Multi-User Support** - Everyone can vote simultaneously
- 📊 **Real-Time Rankings** - See top photos based on all votes
- 📤 **Easy Export** - Get top N photos with CSV report

## 🎯 How to Use

### Step 1: Set Your Username
1. Open the app
2. Enter your name (no signup required!)
3. You're ready to go!

### Step 2: Create or Join a Room
**Creating a Room:**
- Tap "Create Selection Room"
- You'll get a unique 5-digit code
- Share this code with others

**Joining a Room:**
- Get the 5-digit code from the room creator
- Enter the code
- Tap "Join Selection Room"

### Step 3: Import Photos
**From Local Storage:**
1. Go to the room
2. Enter photo paths (one per line)
3. Tap "Import Local Photos"

**From Google Drive:**
1. Get your Drive folder ID
2. Get a Drive access token (see Google Drive Setup below)
3. Enter both in the app
4. Tap "Import from Google Drive"

### Step 4: Start Voting
1. Tap "Start Voting"
2. **Swipe Right** for photos you like → Choose +1, +2, or +3
3. **Swipe Left** for photos you don't like → Choose -1, -2, or -3
4. Track your progress at the top
5. Use "Undo" button to change your last vote

### Step 5: View Rankings
1. Tap "View Rankings" in the room
2. See all photos sorted by score
3. Check vote counts and average scores

### Step 6: Export Top Photos
1. In Rankings screen, tap "Export"
2. Enter how many top photos you want
3. Choose destination (local or Google Drive)
4. Get a CSV report with all the rankings!

## 🎨 Understanding Scores

- **+3**: Absolute favorite! Must include
- **+2**: Really like this one
- **+1**: Pretty good
- **-1**: Not great
- **-2**: Don't like it
- **-3**: Definitely exclude

The app calculates **weighted average** of all users' votes to rank photos.

## 📱 Mobile Tips

- Use **single finger swipes** for best experience
- **Hold and drag** to see like/dislike preview
- **Tap "Undo"** if you change your mind
- The app **saves your progress** automatically

## 🌐 Google Drive Setup (Optional)

If you want to import from Google Drive:

1. **Get Folder ID:**
   - Open your Drive folder in browser
   - Copy ID from URL: `drive.google.com/drive/folders/YOUR_FOLDER_ID`

2. **Get Access Token:**
   - Go to [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
   - Select "Drive API v3"
   - Authorize and get access token
   - ⚠️ Token expires in 1 hour

3. **Import Photos:**
   - Paste folder ID and token in app
   - App scans all images recursively
   - Only stores references (no photo duplication!)

## 🔥 Pro Tips

1. **Vote in Batches** - You don't have to vote on all photos at once
2. **Use Undo Wisely** - Only undoes the very last vote
3. **Check Rankings Often** - See what others are voting
4. **Export Early** - You can export at any time, not just at the end
5. **Multiple Rounds** - Import more photos anytime

## ❓ Troubleshooting

**"Room not found"**
- Double-check the 5-digit code
- Make sure room creator hasn't archived it

**"No photos to vote on"**
- Room creator needs to import photos first
- Wait for import to complete

**"Google Drive import failed"**
- Check your access token hasn't expired
- Verify folder ID is correct
- Ensure folder has image files

**Swipe not responding**
- Try refreshing the app
- Check you're on the swipe screen (not room screen)

## 🏆 Best Practices

### For Room Creators:
- ✅ Import all photos before inviting others
- ✅ Share room code via text/email
- ✅ Set clear voting guidelines (what makes a good photo?)
- ✅ Export results periodically

### For Voters:
- ✅ Be honest with your scores
- ✅ Take your time - quality over speed
- ✅ Use the full range of scores (-3 to +3)
- ✅ Check rankings to avoid duplicates

## 🎊 Example Workflow

**Wedding Photo Selection:**
1. Photographer shares Drive folder with 500 photos
2. Groom creates room → Code: 12345
3. Bride, parents, and best friends join room
4. Groom imports all 500 photos from Drive
5. Everyone votes over the next few days
6. Check rankings together
7. Export top 100 photos for the album!

## 📞 Support

Need help? Common solutions:
- Restart the app
- Clear your browser cache
- Check internet connection
- Try a different browser/device

## 🎉 You're Ready!

Start creating beautiful photo collections together! 📸💕

---

**Made with love for collaborative photo selection** 💍✨
