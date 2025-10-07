# Navigate to project root
cd "/Users/sahilmehta/bill-chatbot copy"

# Activate your virtual environment
source .venv/bin/activate

# Navigate to server directory
cd server

# Start the server
uvicorn ocr_api:app --reload --host 0.0.0.0 --port 8000
   cd "/Users/sahilmehta/bill-chatbot copy/server"
   source venv/bin/activate
   uvicorn ocr_api:app --reload --host 0.0.0.0 --port 8000