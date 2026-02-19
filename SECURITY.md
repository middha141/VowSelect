# VowSelect Security Guide

## 🔐 Security Measures Implemented

### 1. Environment Variable Protection

**✅ Implemented:**
- All sensitive credentials are stored in `.env` files
- `.env` files are in `.gitignore` and never committed to version control
- `.env.example` templates provided for setup without exposing real credentials

**Backend `.env` contains:**
- MongoDB connection string (with credentials)
- Google OAuth Client ID and Secret
- Secret key for session management
- API keys

**Action Required:**
Never commit the actual `.env` file. Use `.env.example` to share configuration structure.

---

### 2. Input Validation & Sanitization

**✅ Implemented:**

#### Username Sanitization
```python
def sanitize_username(username: str) -> str:
    """Sanitize username to prevent XSS and injection attacks"""
    clean = escape(username.strip())
    clean = re.sub(r'[^a-zA-Z0-9_ -]', '', clean)
    return clean[:50]  # Limit length
```

#### Room Code Validation
```python
def validate_room_code(code: str) -> bool:
    """Validate room code is exactly 5 digits"""
    return bool(re.match(r'^\\d{5}$', code))
```

#### ObjectId Validation
```python
def validate_object_id(obj_id: str) -> bool:
    """Validate MongoDB ObjectId format"""
    return bool(re.match(r'^[a-f0-9]{24}$', obj_id))
```

#### Pydantic Validators
All request models include validators:
- Username: 2-50 characters, alphanumeric + spaces, underscores, hyphens
- Room codes: Exactly 5 digits
- Vote scores: Must be -3 to -1 or 1 to 3 (no zero)
- Object IDs: Valid 24-character hex strings

---

### 3. Rate Limiting

**✅ Implemented using SlowAPI:**

#### Global Rate Limit
- Default: 60 requests per minute per IP address
- Configurable via `RATE_LIMIT_PER_MINUTE` in `.env`

#### Endpoint-Specific Limits
```python
# User creation: 10/minute (prevent spam accounts)
@limiter.limit("10/minute")
async def create_user(...)

# Room creation: 5/minute (prevent room spam)
@limiter.limit("5/minute")
async def create_room(...)

# Voting: 100/minute (allow rapid voting)
@limiter.limit("100/minute")
async def create_vote(...)
```

**Protects against:**
- Brute force attacks
- API abuse
- Denial of Service (DoS)

---

### 4. CORS (Cross-Origin Resource Sharing)

**✅ Implemented:**

```python
# Restricted to specific origins (not wildcard)
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 
    'http://localhost:8081,http://localhost:19006').split(',')

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # Whitelist only
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_credentials=True,
)
```

**Update `.env` to add production domains:**
```bash
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006,https://yourdomain.com
```

---

### 5. Security Headers

**✅ Implemented:**

```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response
```

**Headers explained:**
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - Enables XSS filter
- `Referrer-Policy` - Controls referrer information

**For Production:** Add HTTPS and enable HSTS:
```python
response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
```

---

### 6. Session Management

**✅ Implemented:**

```python
app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    session_cookie="vowselect_session",
    max_age=3600,  # 1 hour
    same_site="lax",
    https_only=False  # Set to True in production
)
```

**Secure session configuration:**
- Secret key required (auto-generated if not set)
- 1-hour session timeout
- SameSite=lax (CSRF protection)
- HTTPS-only in production

---

### 7. MongoDB Security

**Current Setup:**
- MongoDB Atlas with authentication
- Connection uses TLS/SSL

**Recommended Improvements:**

#### Add MongoDB User with Limited Permissions
```javascript
// In MongoDB shell
use admin
db.createUser({
  user: "vowselect_app",
  pwd: "strong_random_password",
  roles: [
    { role: "readWrite", db: "vowselect" }
  ]
})
```

#### Update Connection String
```bash
# In backend/.env
MONGO_URL=mongodb+srv://vowselect_app:password@cluster.mongodb.net/vowselect?retryWrites=true&w=majority
```

#### Enable IP Whitelist in MongoDB Atlas
1. Go to MongoDB Atlas Network Access
2. Add your server's IP address
3. Remove 0.0.0.0/0 (allow from anywhere)

---

### 8. Secrets Management

**✅ Current Protection:**
- All secrets in `.env` (not in code)
- `.gitignore` excludes `.env` files
- `.env.example` provided for reference

**Best Practices:**

#### Generate Strong Secret Key
```python
import secrets
print(secrets.token_urlsafe(32))
# Output: Use this as SECRET_KEY in .env
```

#### Never Commit These Files:
```
.env
.env.local
.env.*.local
*credentials*.json
*token*.json
*.pem
*.key
```

#### Use Environment-Specific Variables
```bash
# Development
.env.development

# Production
.env.production
```

---

### 9. OAuth Security

**✅ Implemented:**

#### Secure OAuth Flow
1. Client redirects to Google OAuth
2. User authenticates with Google
3. Google redirects back with authorization code
4. Backend exchanges code for token (client never sees secret)
5. Access token stored securely

**Security measures:**
- Client credentials never exposed to frontend
- State parameter prevents CSRF
- Tokens have limited scope (read-only Drive access)
- Tokens expire and require refresh

---

### 10. File Upload Security

**✅ Implemented:**

#### Image Validation
```python
# Only accept valid image files
allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

# Validate with PIL
try:
    img = Image.open(io.BytesIO(file_data))
    img.verify()
except:
    raise HTTPException(400, "Invalid image file")
```

#### Size Limits
- Images compressed to < 500KB for mobile
- Original size validation recommended

---

## 🚨 Security Checklist

### Development
- [x] `.env` files in `.gitignore`
- [x] Input validation on all user inputs
- [x] Rate limiting on endpoints
- [x] CORS restricted to localhost
- [x] Security headers enabled
- [x] Session management configured

### Pre-Production
- [ ] Review and update `ALLOWED_ORIGINS`
- [ ] Generate strong `SECRET_KEY`
- [ ] Enable MongoDB IP whitelist
- [ ] Set up MongoDB user with limited permissions
- [ ] Review rate limits for production traffic
- [ ] Test OAuth flow thoroughly

### Production
- [ ] Enable HTTPS
- [ ] Set `https_only=True` for sessions
- [ ] Add HSTS header
- [ ] Use production MongoDB credentials
- [ ] Monitor rate limit violations
- [ ] Set up logging and monitoring
- [ ] Regular security audits
- [ ] Keep dependencies updated

---

## 🔍 Security Testing

### Test Input Validation
```bash
# Test username sanitization
curl -X POST http://localhost:8001/api/users \\
  -H "Content-Type: application/json" \\
  -d '{"username":"<script>alert(1)</script>"}'

# Should return sanitized username: scriptalert1script
```

### Test Rate Limiting
```bash
# Rapid requests should be blocked
for i in {1..20}; do
  curl -X POST http://localhost:8001/api/users \\
    -H "Content-Type: application/json" \\
    -d '{"username":"test'$i'"}'
done

# Should see 429 Too Many Requests after limit
```

### Test CORS
```bash
# Request from unauthorized origin should fail
curl -X GET http://localhost:8001/api/rooms/12345 \\
  -H "Origin: https://evil.com"

# Should block or return CORS error
```

---

## 🛡️ Additional Recommendations

### 1. Add HTTPS in Production
Use Let's Encrypt for free SSL certificates:
```bash
sudo certbot --nginx -d api.yourdomain.com
```

### 2. Use Environment Variables Manager
Consider using:
- AWS Secrets Manager
- Azure Key Vault
- HashiCorp Vault
- Doppler

### 3. Add Logging
```python
import logging

# Log security events
logger.info(f"User {user_id} created")
logger.warning(f"Rate limit exceeded from {ip}")
logger.error(f"Authentication failed: {error}")
```

### 4. Regular Updates
```bash
# Check for security updates
pip list --outdated

# Update packages
pip install --upgrade package_name
```

### 5. Security Headers Service
Use [securityheaders.com](https://securityheaders.com) to test your headers.

---

## 💡 Common Security Issues Fixed

### ❌ Before: Credentials in Frontend
```typescript
// BAD - Never do this!
const GOOGLE_CLIENT_ID = "975958994980-xxx.apps.googleusercontent.com"
```

### ✅ After: Backend OAuth Flow
```typescript
// Good - Frontend just initiates, backend handles credentials
const authUrl = await fetch(`${API_URL}/api/auth/google`)
```

---

### ❌ Before: Wildcard CORS
```python
allow_origins=["*"]  # Accepts requests from anywhere
```

### ✅ After: Whitelist Origins
```python
allow_origins=ALLOWED_ORIGINS  # Only approved domains
```

---

### ❌ Before: No Input Validation
```python
username = request.username  # Accepts anything
```

### ✅ After: Validated & Sanitized
```python
username = sanitize_username(request.username)
# Regex validated, length limited, HTML escaped
```

---

## 📞 Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Email: security@yourdomain.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

---

## 📚 Further Reading

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [MongoDB Security Checklist](https://docs.mongodb.com/manual/administration/security-checklist/)
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/rfc8252)

---

**Last Updated:** February 16, 2026  
**Version:** 1.0
