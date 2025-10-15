#!/usr/bin/env python3
"""
Simple script to create an admin user for the bill-chatbot application.
Edit the EMAIL and PASSWORD variables below, then run this script.
"""

import sqlite3
import bcrypt
import sys
from datetime import datetime

# ============================================
# EDIT THESE VARIABLES WITH YOUR DESIRED CREDENTIALS
# ============================================
EMAIL = "admin@example.com"  # Change this to your desired admin email
PASSWORD = "admin123"         # Change this to your desired admin password
# ============================================

def generate_cuid():
    """Generate a simple unique ID"""
    import random
    import string
    import time
    chars = string.ascii_lowercase + string.digits
    timestamp = str(int(time.time() * 1000))[-10:]
    random_part = ''.join(random.choices(chars, k=15))
    return f"c{timestamp}{random_part}"

def create_admin_user(db_path, email, password):
    """Create an admin user in the database"""
    try:
        # Validate input
        if not email or '@' not in email:
            print("❌ Invalid email address")
            sys.exit(1)
        
        if not password or len(password) < 6:
            print("❌ Password must be at least 6 characters long")
            sys.exit(1)
        
        # Connect to SQLite database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if user already exists
        cursor.execute("SELECT id, email, role FROM users WHERE email = ?", (email.lower(),))
        existing_user = cursor.fetchone()
        
        if existing_user:
            print(f"\n⚠️  User already exists:")
            print(f"   Email: {existing_user[1]}")
            print(f"   Current Role: {existing_user[2]}")
            
            if existing_user[2] != 'Admin':
                print("\nUpdating user role to Admin...")
                cursor.execute(
                    "UPDATE users SET role = 'Admin' WHERE email = ?",
                    (email.lower(),)
                )
                conn.commit()
                print("✅ User role updated to Admin successfully!")
            else:
                print("✅ User is already an Admin!")
            
            conn.close()
            return
        
        # Hash the password
        salt = bcrypt.gensalt(rounds=12)
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        
        # Generate ID and timestamps
        user_id = generate_cuid()
        now = datetime.utcnow().isoformat() + 'Z'
        
        # Insert new admin user
        cursor.execute("""
            INSERT INTO users (id, email, password, role, createdAt, updatedAt)
            VALUES (?, ?, ?, 'Admin', ?, ?)
        """, (user_id, email.lower(), hashed_password, now, now))
        
        conn.commit()
        conn.close()
        
        print("\n✅ Admin user created successfully!")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        print(f"   Role: Admin")
        print(f"   ID: {user_id}")
        print("\n⚠️  Please save your credentials securely!")
        print("⚠️  Remember to change the EMAIL and PASSWORD in this script before committing to git!")
        
    except sqlite3.Error as e:
        print(f"\n❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

def main():
    print("=== Create Admin User for Bill Chatbot ===\n")
    print(f"Email: {EMAIL}")
    print(f"Password: {'*' * len(PASSWORD)}\n")
    
    # Get database path
    db_path = "prisma/dev.db"
    
    # Create admin user
    create_admin_user(db_path, EMAIL, PASSWORD)

if __name__ == "__main__":
    main()

