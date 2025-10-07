# Deployment Guide for AI IDE

This guide is optimized for AI coding assistants to help deploy the Bill Chatbot application on a new system.

## Quick Deploy (For AI Assistants)

### Step 1: Clone Repository
```bash
git clone https://github.com/sahilmehta7/bill-chatbot.git
cd bill-chatbot
```

### Step 2: Run Automated Setup
```bash
chmod +x setup.sh
./setup.sh
```

The script will guide you through the entire setup process.

### Step 3: Configure Environment Variables

#### Backend (`server/.env`)
```bash
cd server
cp env.template .env
```

Edit `server/.env` and add:
```env
OPENAI_API_KEY=sk-xxxxx  # User must provide their OpenAI API key
ALLOWED_ORIGINS=http://localhost:3000
```

#### Frontend (`web/.env.local`)
```bash
cd web
cp env.example .env.local
```

Edit `web/.env.local`:
- Generate `NEXTAUTH_SECRET`: `openssl rand -base64 32`
- Update `DATABASE_URL` with PostgreSQL credentials
- Ensure `BACKEND_URL=http://localhost:8000`

### Step 4: Start Services

#### Terminal 1 - Backend
```bash
cd server
source venv/bin/activate
uvicorn ocr_api:app --reload --host 0.0.0.0 --port 8000
```

#### Terminal 2 - Frontend
```bash
cd web
npm run dev
```

### Step 5: Access Application
- Frontend: http://localhost:3000
- Backend API Docs: http://localhost:8000/docs

## Manual Setup Instructions

If the automated script fails, follow these detailed steps:

### Prerequisites Check
```bash
# Check Python
python3 --version  # Should be 3.8+

# Check Node.js
node --version     # Should be 18+

# Check PostgreSQL
psql --version     # Should be 14+
pg_isready         # Should return "accepting connections"
```

### Install Missing Prerequisites

#### macOS
```bash
# Install Homebrew if not present
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install python3 node postgresql

# Start PostgreSQL
brew services start postgresql
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv nodejs npm postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Backend Setup

```bash
cd server

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Unix/macOS
# venv\Scripts\activate   # On Windows

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
cat > .env << 'EOF'
OPENAI_API_KEY=sk-your-key-here
ALLOWED_ORIGINS=http://localhost:3000
EOF

# Verify installation
python3 -c "import fastapi; import openai; print('Dependencies installed successfully')"
```

### Frontend Setup

```bash
cd web

# Install Node dependencies
npm install

# Generate Prisma client
npx prisma generate

# Create .env.local
cat > .env.local << 'EOF'
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bill_chatbot?schema=public"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
NEXT_PUBLIC_API_BASE="http://localhost:8000"
BACKEND_URL="http://localhost:8000"
EOF
```

### Database Setup

```bash
# Create database
createdb bill_chatbot

# If above fails, use psql
psql -U postgres << 'EOF'
CREATE DATABASE bill_chatbot;
\q
EOF

# Run migrations
cd web
npx prisma migrate deploy || npx prisma db push

# Verify database
npx prisma studio  # Opens database browser
```

### Create Admin User

```bash
cd web
node scripts/create-admin.js
```

**Default credentials:**
- Email: admin@example.com
- Password: admin123

## Verification Checklist

Run these commands to verify the setup:

```bash
# Check backend
curl http://localhost:8000/health
# Expected: {"status":"healthy","timestamp":"..."}

# Check frontend build
cd web && npm run build
# Should complete without errors

# Check database connection
cd web && npx prisma db pull
# Should succeed without errors

# Check Python packages
cd server && source venv/bin/activate && pip list
# Should show fastapi, uvicorn, openai, pymupdf, etc.
```

## Common Issues and Solutions

### Issue: Port 8000 already in use
```bash
# Find and kill process
lsof -ti:8000 | xargs kill -9
```

### Issue: PostgreSQL not accepting connections
```bash
# macOS
brew services restart postgresql

# Linux
sudo systemctl restart postgresql

# Check status
pg_isready
```

### Issue: Node modules installation fails
```bash
cd web
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Issue: Prisma migrations fail
```bash
cd web
npx prisma migrate reset  # WARNING: Deletes all data
npx prisma db push
```

### Issue: OpenAI API errors
- Verify API key is correct in `server/.env`
- Check API key has credits: https://platform.openai.com/usage
- Ensure no extra spaces in the API key

## Environment Variables Reference

### Required Variables

**server/.env:**
- `OPENAI_API_KEY` - Get from https://platform.openai.com/api-keys
- `ALLOWED_ORIGINS` - CORS allowed origins (use `http://localhost:3000` for local)

**web/.env.local:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` - Frontend URL (http://localhost:3000 for local)
- `BACKEND_URL` - Backend API URL (http://localhost:8000 for local)

### Optional Variables

**server/.env:**
- `CLASSIFY_ASSISTANT_ID` - Reuse existing OpenAI assistant (saves startup time)
- `EXTRACT_ASSISTANT_ID` - Reuse existing OpenAI assistant (saves startup time)

**web/.env.local:**
- `GOOGLE_CLIENT_ID` - For Google OAuth login
- `GOOGLE_CLIENT_SECRET` - For Google OAuth login

## Post-Deployment Steps

1. **Test Document Upload**
   - Login at http://localhost:3000/login
   - Upload a test PDF invoice
   - Verify OCR results appear

2. **Configure AI Models**
   - Go to Settings → Classification
   - Select desired model (gpt-4o, gpt-4o-mini, etc.)
   - Save changes

3. **Create Additional Users** (if needed)
   ```bash
   cd web
   node scripts/create-admin.js
   ```

4. **Monitor Logs**
   - Backend logs: Check terminal running uvicorn
   - Frontend logs: Check browser console and terminal running npm
   - Server logs: `server/ocr_api.log`

## Production Deployment Notes

For production deployment, update:

1. **Security:**
   - Change `NEXTAUTH_SECRET` to a strong random value
   - Use environment-specific database URLs
   - Enable HTTPS
   - Configure proper CORS origins

2. **Database:**
   - Use managed PostgreSQL (AWS RDS, Heroku Postgres, etc.)
   - Enable connection pooling
   - Set up automated backups

3. **API Keys:**
   - Store in secure secrets manager
   - Rotate periodically
   - Monitor usage and set limits

4. **Hosting Options:**
   - Backend: Railway, Render, Heroku, AWS Lambda
   - Frontend: Vercel, Netlify, AWS Amplify
   - Database: AWS RDS, Heroku Postgres, Supabase

---

**For AI Assistants:**
When helping a user deploy this application:
1. Always check prerequisites first
2. Run the automated setup.sh script when possible
3. Guide through manual steps only if automation fails
4. Verify each step completes successfully before proceeding
5. Check logs if any errors occur
6. Help update environment variables with user-specific values

