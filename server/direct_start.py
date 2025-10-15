#!/usr/bin/env python3
import os
import sys
import uvicorn
from pathlib import Path

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set environment variables directly
os.environ["OPENAI_API_KEY"] = "sk-test-key-placeholder"
os.environ["ALLOWED_ORIGINS"] = "http://localhost:3000"

print("🚀 Starting Bill Chatbot Backend Server...")
print("📍 Server will be available at: http://localhost:8000")
print("📚 API docs will be available at: http://localhost:8000/docs")
print("🛑 Press Ctrl+C to stop the server")
print("-" * 60)

try:
    # Import and run the app
    import ocr_api
    print("✅ OCR API module loaded successfully")
    
    # Start the server
    uvicorn.run(
        ocr_api.app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
        access_log=True
    )
    
except KeyboardInterrupt:
    print("\n🛑 Server stopped by user")
except Exception as e:
    print(f"❌ Error starting server: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
