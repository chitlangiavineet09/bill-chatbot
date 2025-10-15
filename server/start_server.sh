#!/bin/bash
cd /Users/vineet/Desktop/bill-chatbot/server
source venv/bin/activate
uvicorn ocr_api:app --host 127.0.0.1 --port 8000
