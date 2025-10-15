# Admin User Creation Scripts

This directory contains scripts to create admin users for the bill-chatbot application.

## Available Scripts

### 1. create-admin-simple.py (Recommended)
A simple, non-interactive Python script for creating admin users.

**Usage:**
1. Edit the script and update the `EMAIL` and `PASSWORD` variables at the top
2. Run the script:
   ```bash
   cd /Users/vineet/Desktop/bill-chatbot/server
   source venv/bin/activate
   cd ../web
   python scripts/create-admin-simple.py
   ```

**Features:**
- No interactive prompts needed
- Creates new admin users or updates existing users to admin role
- Works with the SQLite database directly

### 2. create-admin.py
An interactive Python script that prompts for email and password.

**Usage:**
```bash
cd /Users/vineet/Desktop/bill-chatbot/server
source venv/bin/activate
cd ../web
python scripts/create-admin.py
```

### 3. create-admin.js (Original)
The original Node.js script that creates a default admin user.

**Default Credentials:**
- Email: `admin@billchatbot.com`
- Password: `admin123`

**Usage:**
```bash
cd /Users/vineet/Desktop/bill-chatbot/web
node scripts/create-admin.js
```

### 4. create-custom-admin.js
An interactive Node.js script for creating custom admin users.

**Usage:**
```bash
cd /Users/vineet/Desktop/bill-chatbot/web
node scripts/create-custom-admin.js
```

## Created Admin Users

### Current Admin User
- **Email:** admin@example.com
- **Password:** admin123
- **Role:** Admin
- **ID:** c9913487417s7qtge5qoyhbd59

**⚠️ IMPORTANT:** Change this password after your first login!

## Requirements

### For Python Scripts:
- Python 3.x
- bcrypt module (install with: `pip install bcrypt`)

### For JavaScript Scripts:
- Node.js
- @prisma/client
- bcryptjs

## Notes

- The scripts check if a user already exists before creating a new one
- If a user exists, you can update their role to Admin
- All passwords are hashed using bcrypt with 12 rounds
- The database is located at: `web/prisma/dev.db`

