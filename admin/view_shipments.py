#!/usr/bin/env python3
"""
View all shipments in the system

Usage:
    python3 view_shipments.py
    python3 view_shipments.py --status pending
    python3 view_shipments.py --user USER_ID
"""

import argparse
from datetime import datetime
from config import get_db

def view_shipments(status=None, user_id=None):
    db = get_db()
    if not db:
        return

    query = db.collection('shipments')

    if status:
        query = query.where('status', '==', status)

    if user_id:
        query = query.where('user_id', '==', user_id)

    query = query.order_by('created_at', direction='DESCENDING')
    docs = query.stream()

    print("\n" + "=" * 80)
    print("SHIPMENTS")
    print("=" * 80)

    count = 0
    for doc in docs:
        data = doc.to_dict()
        count += 1

        print(f"\nTracking #: {data.get('tracking_number', 'N/A')}")
        print(f"Status: {data.get('status', 'N/A').upper()}")
        print(f"Service: {data.get('service_type', 'N/A')}")
        print(f"Destination: {data.get('destination', {}).get('name', 'N/A')}")
        print(f"  {data.get('destination', {}).get('city', '')}, {data.get('destination', {}).get('state', '')} {data.get('destination', {}).get('zip', '')}")
        print(f"Package: {data.get('package', {}).get('weight', 0)} lbs, Qty: {data.get('package', {}).get('quantity', 1)}")
        print(f"Created: {data.get('created_at', 'N/A')}")
        print("-" * 40)

    print(f"\nTotal: {count} shipments")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='View shipments')
    parser.add_argument('--status', help='Filter by status (pending, picked_up, in_transit, delivered)')
    parser.add_argument('--user', help='Filter by user ID')
    args = parser.parse_args()

    view_shipments(status=args.status, user_id=args.user)
