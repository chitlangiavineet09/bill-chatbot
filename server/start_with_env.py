#!/usr/bin/env python3
import os
import uvicorn
import sys

# Set environment variables
os.environ["OPENAI_API_KEY"] = "sk-your-openai-api-key-here"
os.environ["ALLOWED_ORIGINS"] = "http://localhost:3000"
os.environ["CLASSIFY_ASSISTANT_ID"] = ""
os.environ["EXTRACT_ASSISTANT_ID"] = ""

print("Environment variables set:")
print(f"OPENAI_API_KEY: {os.environ.get('OPENAI_API_KEY')[:20]}...")
print(f"ALLOWED_ORIGINS: {os.environ.get('ALLOWED_ORIGINS')}")
print()

if __name__ == "__main__":
    print("Starting Bill Chatbot Backend Server...")
    print("Server will be available at: http://localhost:8000")
    print("API docs will be available at: http://localhost:8000/docs")
    print("Press Ctrl+C to stop the server")
    print()
    
    try:
        uvicorn.run(
            "ocr_api:app",
            host="127.0.0.1",
            port=8000,
            reload=False,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Error starting server: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
