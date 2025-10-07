# Bill Chatbot - AI-Powered Document Processing System

An intelligent document processing system that uses OpenAI's vision models to extract structured data from invoices, bills, and logistics documents.

## 🚀 Features

- **Multi-Document OCR**: Process invoices, e-way bills, lorry receipts, packing lists, and 15+ document types
- **AI-Powered Classification**: Automatically identifies document types using GPT-4o/GPT-4 Turbo
- **Structured Data Extraction**: Extracts fields like invoice numbers, dates, parties, items, taxes, etc.
- **Real-time Processing**: Stream results as pages are processed
- **Configurable Models**: Switch between GPT-4o, GPT-4o-mini, GPT-4-turbo via Admin UI
- **User Authentication**: Secure login with Google OAuth and credentials
- **Admin Dashboard**: Manage prompts, models, and document schemas
- **Multi-page Support**: Process documents with multiple pages in parallel

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.8+** - [Download](https://www.python.org/downloads/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **PostgreSQL 14+** - [Download](https://www.postgresql.org/download/)
- **OpenAI API Key** - [Get one here](https://platform.openai.com/api-keys)

### macOS Installation
```bash
brew install python3 node postgresql
brew services start postgresql
```

### Ubuntu/Debian Installation
```bash
sudo apt-get update
sudo apt-get install python3 python3-pip nodejs npm postgresql postgresql-contrib
sudo systemctl start postgresql
```

## 🛠️ Quick Setup

### Option 1: Automated Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/sahilmehta7/bill-chatbot.git
cd bill-chatbot

# Make setup script executable
chmod +x setup.sh

# Run the setup script
./setup.sh
```

The script will:
- ✅ Check all requirements
- ✅ Install Python dependencies
- ✅ Install Node.js dependencies
- ✅ Create virtual environments
- ✅ Setup PostgreSQL database
- ✅ Run database migrations
- ✅ Guide you through creating an admin user

### Option 2: Manual Setup

Follow these steps if the automated script doesn't work for your system:

#### 1. Backend Setup (Python/FastAPI)

```bash
# Navigate to server directory
cd server

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On macOS/Linux
# OR
venv\Scripts\activate     # On Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
OPENAI_API_KEY=your_openai_api_key_here
ALLOWED_ORIGINS=http://localhost:3000
EOF

# Start the server
uvicorn ocr_api:app --reload --host 0.0.0.0 --port 8000
```

#### 2. Frontend Setup (Next.js)

```bash
# Navigate to web directory (in a new terminal)
cd web

# Install dependencies
npm install

# Create .env.local file
cat > .env.local << EOF
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bill_chatbot?schema=public"

# Auth
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (optional - leave empty if not using)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Backend API
NEXT_PUBLIC_API_BASE="http://localhost:8000"
BACKEND_URL="http://localhost:8000"
EOF

# Setup database
npx prisma generate
npx prisma db push

# Create admin user
node scripts/create-admin.js

# Start the dev server
npm run dev
```

#### 3. Database Setup (PostgreSQL)

```bash
# Create database
createdb bill_chatbot

# Or manually in psql
psql -U postgres
CREATE DATABASE bill_chatbot;
\q

# Run migrations (from web directory)
cd web
npx prisma migrate deploy
```

## 🔑 Environment Variables

### Backend (`server/.env`)
```env
OPENAI_API_KEY=sk-...                    # Required: Your OpenAI API key
ALLOWED_ORIGINS=http://localhost:3000    # Required: CORS origins
CLASSIFY_ASSISTANT_ID=asst_...           # Optional: Reuse existing assistant
EXTRACT_ASSISTANT_ID=asst_...            # Optional: Reuse existing assistant
```

### Frontend (`web/.env.local`)
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/bill_chatbot?schema=public"

# Auth (required)
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Backend API (required)
NEXT_PUBLIC_API_BASE="http://localhost:8000"
BACKEND_URL="http://localhost:8000"
```

## 🏃 Running the Application

### Start Backend
```bash
cd server
source venv/bin/activate
uvicorn ocr_api:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: `http://localhost:8000`

### Start Frontend
```bash
cd web
npm run dev
```

Frontend will be available at: `http://localhost:3000`

## 👤 Creating an Admin User

### Option 1: Using the Script
```bash
cd web
node scripts/create-admin.js
```

### Option 2: Manual SQL
```sql
-- Connect to database
psql bill_chatbot

-- Insert admin user (password: admin123)
INSERT INTO users (id, email, password, name, role, "createdAt", "updatedAt")
VALUES (
  'admin-001',
  'admin@example.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5L4N0LQGB8Uq2',
  'Admin User',
  'Admin',
  NOW(),
  NOW()
);
```

## 📚 Project Structure

```
bill-chatbot/
├── server/              # Python FastAPI backend
│   ├── ocr_api.py      # Main OCR API
│   ├── prompts.json    # AI prompts configuration
│   ├── structure.json  # Document schemas
│   ├── requirements.txt
│   └── venv/           # Python virtual environment
│
├── web/                # Next.js frontend
│   ├── src/
│   │   ├── app/        # Next.js 13+ app directory
│   │   ├── components/ # React components
│   │   └── lib/        # Utilities and services
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   ├── package.json
│   └── .env.local      # Environment variables
│
├── setup.sh            # Automated setup script
└── README.md           # This file
```

## 🎯 Usage

1. **Login**: Navigate to `http://localhost:3000/login`
2. **Upload Documents**: Click the paperclip icon to upload PDF documents
3. **View Results**: See classification and extraction results in real-time
4. **Admin Settings**: Navigate to Settings to configure:
   - AI models (GPT-4o, GPT-4o-mini, GPT-4-turbo)
   - Prompts for classification and extraction
   - Document schemas

## 🔧 Configuration

### Change AI Models

1. Go to Settings → Classification/Extraction tabs
2. Select model from dropdown:
   - **gpt-4o** - Best balance of speed and accuracy
   - **gpt-4o-mini** - 60% cheaper, still accurate
   - **gpt-4-turbo** - Highest accuracy
   - **gpt-4.1-2025-04-14** - Extended context
3. Click "Save Changes"

### Customize Document Types

Edit `server/structure.json` to add/modify document schemas and fields.

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 8000 is in use
lsof -ti:8000 | xargs kill -9

# Restart the server
cd server && source venv/bin/activate
uvicorn ocr_api:app --reload --host 0.0.0.0 --port 8000
```

### Frontend won't start
```bash
# Clear cache and reinstall
cd web
rm -rf node_modules package-lock.json .next
npm install
npm run dev
```

### Database connection errors
```bash
# Check PostgreSQL is running
pg_isready

# Restart PostgreSQL
brew services restart postgresql  # macOS
sudo systemctl restart postgresql # Linux

# Verify connection
psql -U postgres -d bill_chatbot -c "SELECT 1;"
```

### "Failed to load prompts" error
- Make sure backend server is running on port 8000
- Check `BACKEND_URL` in `web/.env.local`
- Verify `server/prompts.json` exists

## 📊 API Documentation

Once the backend is running, visit:
- **API Docs**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`

## 🚀 Deployment

### Backend (FastAPI)
- Deploy to: Heroku, Railway, Render, or any Python hosting
- Required: Python 3.8+, OpenAI API key
- Port: 8000 (configurable)

### Frontend (Next.js)
- Deploy to: Vercel, Netlify, or any Node.js hosting
- Required: PostgreSQL database, Backend URL
- Environment: Update all `.env.local` variables

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- OpenAI for GPT-4 Vision API
- Next.js team for the amazing framework
- FastAPI for the backend framework

## 📧 Support

For issues and questions:
- Open an issue on GitHub
- Check the troubleshooting section above
- Review API documentation at `/docs`

---

Made with ❤️ for intelligent document processing
