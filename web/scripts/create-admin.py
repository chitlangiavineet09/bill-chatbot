#!/usr/bin/env python3
"""
Script to create an admin user for the bill-chatbot application.
This script directly modifies the SQLite database.
"""

import sqlite3
import bcrypt
import sys
from datetime import datetime

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
        # Connect to SQLite database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if user already exists
        cursor.execute("SELECT id, email, role FROM users WHERE email = ?", (email.lower(),))
        existing_user = cursor.fetchone()
        
        if existing_user:
            print(f"\n⚠️  User already exists:")
            print(f"   Email: {existing_user[1]}")
            print(f"   Role: {existing_user[2]}")
            
            response = input("\nUpdate to Admin role? (yes/no): ").strip().lower()
            
            if response in ['yes', 'y']:
                cursor.execute(
                    "UPDATE users SET role = 'Admin' WHERE email = ?",
                    (email.lower(),)
                )
                conn.commit()
                print("\n✅ User role updated to Admin successfully!")
            else:
                print("\n❌ Operation cancelled.")
            
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
        
    except sqlite3.Error as e:
        print(f"\n❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

def main():
    print("=== Create Admin User for Bill Chatbot ===\n")
    
    # Get database path
    db_path = "prisma/dev.db"
    
    # Get email
    email = input("Enter admin email: ").strip()
    
    if not email or '@' not in email:
        print("❌ Invalid email address")
        sys.exit(1)
    
    # Get password
    password = input("Enter admin password (min 6 characters): ").strip()
    
    if not password or len(password) < 6:
        print("❌ Password must be at least 6 characters long")
        sys.exit(1)
    
    # Create admin user
    create_admin_user(db_path, email, password)

if __name__ == "__main__":
    main()

