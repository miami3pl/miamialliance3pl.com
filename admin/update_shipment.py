#!/usr/bin/env python3
"""
Update shipment status

Usage:
    python3 update_shipment.py --tracking MA3PL12345678 --status in_transit
    python3 update_shipment.py --tracking MA3PL12345678 --status delivered
"""

import argparse
from datetime import datetime
from config import get_db

VALID_STATUSES = ['pending', 'picked_up', 'in_transit', 'delivered']

def update_shipment(tracking_number, status):
    if status not in VALID_STATUSES:
        print(f"ERROR: Invalid status '{status}'")
        print(f"Valid statuses: {', '.join(VALID_STATUSES)}")
        return

    db = get_db()
    if not db:
        return

    # Find shipment by tracking number
    query = db.collection('shipments').where('tracking_number', '==', tracking_number).limit(1)
    docs = list(query.stream())

    if not docs:
        print(f"ERROR: Shipment '{tracking_number}' not found")
        return

    doc = docs[0]
    doc_ref = db.collection('shipments').document(doc.id)

    # Update status
    doc_ref.update({
        'status': status,
        'updated_at': datetime.now().isoformat()
    })

    print(f"SUCCESS: Shipment {tracking_number} updated to '{status}'")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Update shipment status')
    parser.add_argument('--tracking', required=True, help='Tracking number')
    parser.add_argument('--status', required=True, help=f'New status ({", ".join(VALID_STATUSES)})')
    args = parser.parse_args()

    update_shipment(args.tracking, args.status)
