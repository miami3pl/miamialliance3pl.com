"""
Firebase Admin Configuration

Setup:
1. Go to Firebase Console > Project Settings > Service Accounts
2. Generate new private key
3. Save as 'serviceAccountKey.json' in this directory
4. DO NOT commit serviceAccountKey.json to git!
"""

import firebase_admin
from firebase_admin import credentials, firestore
import os

# Path to your service account key
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')

def init_firebase():
    """Initialize Firebase Admin SDK"""
    if not firebase_admin._apps:
        if not os.path.exists(SERVICE_ACCOUNT_PATH):
            print("ERROR: serviceAccountKey.json not found!")
            print("Download it from Firebase Console > Project Settings > Service Accounts")
            return None

        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)

    return firestore.client()

def get_db():
    """Get Firestore database client"""
    return init_firebase()
