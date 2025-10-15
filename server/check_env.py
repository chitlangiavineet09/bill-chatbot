#!/usr/bin/env python3
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

print("Environment Variables:")
print("=" * 50)
print(f"OPENAI_API_KEY: {os.getenv('OPENAI_API_KEY', 'NOT SET')}")
print(f"ALLOWED_ORIGINS: {os.getenv('ALLOWED_ORIGINS', 'NOT SET')}")
print(f"CLASSIFY_ASSISTANT_ID: {os.getenv('CLASSIFY_ASSISTANT_ID', 'NOT SET')}")
print(f"EXTRACT_ASSISTANT_ID: {os.getenv('EXTRACT_ASSISTANT_ID', 'NOT SET')}")
print("=" * 50)

# Check if the .env file exists
env_file = os.path.join(os.path.dirname(__file__), '.env')
print(f".env file exists: {os.path.exists(env_file)}")
print(f".env file path: {env_file}")

# Try to read the .env file content
try:
    with open(env_file, 'r') as f:
        content = f.read()
    print("\n.env file content:")
    print("-" * 30)
    print(content)
    print("-" * 30)
except Exception as e:
    print(f"Error reading .env file: {e}")
