#!/bin/bash

# Bill Chatbot - Local Setup Script
# This script helps set up the application on a new machine

set -e  # Exit on any error

echo "=================================="
echo "Bill Chatbot - Setup Script"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required tools are installed
check_requirements() {
    echo "📋 Checking requirements..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}❌ Python 3 is not installed. Please install Python 3.8 or higher.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Python found: $(python3 --version)${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18 or higher.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        echo -e "${YELLOW}⚠️  PostgreSQL client not found. You'll need PostgreSQL installed.${NC}"
        echo "Install with: brew install postgresql (macOS) or apt-get install postgresql (Linux)"
    else
        echo -e "${GREEN}✓ PostgreSQL found: $(psql --version)${NC}"
    fi
    
    echo ""
}

# Setup Python backend
setup_backend() {
    echo "🐍 Setting up Python backend..."
    
    cd server
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    echo "Installing Python dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt 2>/dev/null || {
        echo "Creating requirements.txt..."
        pip install fastapi uvicorn python-dotenv openai pymupdf aiohttp python-multipart pydantic
        pip freeze > requirements.txt
    }
    
    # Check for .env file
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}⚠️  No .env file found in server/${NC}"
        echo "Please create server/.env with your OpenAI API key:"
        echo "OPENAI_API_KEY=your_key_here"
        echo "ALLOWED_ORIGINS=http://localhost:3000"
    fi
    
    cd ..
    echo -e "${GREEN}✓ Backend setup complete${NC}"
    echo ""
}

# Setup Node.js frontend
setup_frontend() {
    echo "⚛️  Setting up Next.js frontend..."
    
    cd web
    
    # Install dependencies
    echo "Installing Node.js dependencies..."
    npm install
    
    # Check for .env.local file
    if [ ! -f ".env.local" ]; then
        echo -e "${YELLOW}⚠️  No .env.local file found in web/${NC}"
        if [ -f "env.example" ]; then
            echo "Copying env.example to .env.local..."
            cp env.example .env.local
            echo -e "${YELLOW}⚠️  Please update web/.env.local with your actual values${NC}"
        else
            echo "Please create web/.env.local with required environment variables"
        fi
    fi
    
    cd ..
    echo -e "${GREEN}✓ Frontend setup complete${NC}"
    echo ""
}

# Setup PostgreSQL database
setup_database() {
    echo "🗄️  Setting up PostgreSQL database..."
    
    # Check if PostgreSQL is running
    if ! pg_isready &> /dev/null; then
        echo -e "${YELLOW}⚠️  PostgreSQL is not running. Please start PostgreSQL first.${NC}"
        echo "Start with: brew services start postgresql (macOS)"
        echo "           or: sudo systemctl start postgresql (Linux)"
        echo ""
        read -p "Press Enter after starting PostgreSQL to continue..."
    fi
    
    # Check if database exists
    DB_NAME="bill_chatbot"
    if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw $DB_NAME; then
        echo -e "${GREEN}✓ Database '$DB_NAME' already exists${NC}"
    else
        echo "Creating database '$DB_NAME'..."
        createdb $DB_NAME 2>/dev/null || {
            echo -e "${YELLOW}⚠️  Could not create database automatically.${NC}"
            echo "Please create it manually:"
            echo "  psql -U postgres -c 'CREATE DATABASE bill_chatbot;'"
        }
    fi
    
    # Run Prisma migrations
    echo "Running Prisma migrations..."
    cd web
    npx prisma generate
    npx prisma migrate deploy 2>/dev/null || npx prisma db push
    cd ..
    
    echo -e "${GREEN}✓ Database setup complete${NC}"
    echo ""
}

# Create admin user
create_admin() {
    echo "👤 Creating admin user..."
    
    cd web
    
    if [ -f "scripts/create-admin.js" ]; then
        echo "Running admin creation script..."
        node scripts/create-admin.js
    else
        echo -e "${YELLOW}⚠️  Admin creation script not found${NC}"
        echo "You'll need to create an admin user manually"
    fi
    
    cd ..
    echo ""
}

# Main setup flow
main() {
    check_requirements
    setup_backend
    setup_frontend
    
    # Ask if user wants to setup database
    echo -e "${YELLOW}Do you want to set up the PostgreSQL database now? (y/n)${NC}"
    read -p "> " setup_db
    if [[ $setup_db == "y" || $setup_db == "Y" ]]; then
        setup_database
        
        echo -e "${YELLOW}Do you want to create an admin user? (y/n)${NC}"
        read -p "> " create_user
        if [[ $create_user == "y" || $create_user == "Y" ]]; then
            create_admin
        fi
    else
        echo -e "${YELLOW}⚠️  Skipping database setup. You'll need to set it up manually.${NC}"
        echo ""
    fi
    
    echo "=================================="
    echo -e "${GREEN}✅ Setup Complete!${NC}"
    echo "=================================="
    echo ""
    echo "Next steps:"
    echo "1. Update environment variables:"
    echo "   - server/.env (OpenAI API key)"
    echo "   - web/.env.local (Database URL, Auth secrets)"
    echo ""
    echo "2. Start the backend server:"
    echo "   cd server"
    echo "   source venv/bin/activate"
    echo "   uvicorn ocr_api:app --reload --host 0.0.0.0 --port 8000"
    echo ""
    echo "3. Start the frontend (in a new terminal):"
    echo "   cd web"
    echo "   npm run dev"
    echo ""
    echo "4. Open http://localhost:3000 in your browser"
    echo ""
}

# Run main setup
main

