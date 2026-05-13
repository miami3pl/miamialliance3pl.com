#!/usr/bin/env python3
"""
Export data to CSV

Usage:
    python3 export_data.py shipments           # Export shipments
    python3 export_data.py inventory           # Export inventory
    python3 export_data.py users               # Export users
    python3 export_data.py all                 # Export everything
"""

import argparse
import csv
from datetime import datetime
from config import get_db

def export_shipments(db):
    docs = db.collection('shipments').stream()

    filename = f"shipments_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Tracking #', 'Status', 'Service', 'Recipient', 'City', 'State', 'ZIP', 'Weight', 'Quantity', 'Created', 'User ID'])

        count = 0
        for doc in docs:
            data = doc.to_dict()
            dest = data.get('destination', {})
            pkg = data.get('package', {})
            writer.writerow([
                data.get('tracking_number', ''),
                data.get('status', ''),
                data.get('service_type', ''),
                dest.get('name', ''),
                dest.get('city', ''),
                dest.get('state', ''),
                dest.get('zip', ''),
                pkg.get('weight', ''),
                pkg.get('quantity', ''),
                data.get('created_at', ''),
                data.get('user_id', '')
            ])
            count += 1

    print(f"Exported {count} shipments to {filename}")
    return filename

def export_inventory(db):
    docs = db.collection('inventory').stream()

    filename = f"inventory_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['SKU', 'Name', 'Category', 'Quantity', 'Location', 'User ID', 'Created'])

        count = 0
        for doc in docs:
            data = doc.to_dict()
            writer.writerow([
                data.get('sku', ''),
                data.get('name', ''),
                data.get('category', ''),
                data.get('quantity', ''),
                data.get('location', ''),
                data.get('user_id', ''),
                data.get('created_at', '')
            ])
            count += 1

    print(f"Exported {count} inventory items to {filename}")
    return filename

def export_users(db):
    docs = db.collection('users').stream()

    filename = f"users_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['UID', 'Name', 'Email', 'Company', 'Phone', 'Role', 'Created'])

        count = 0
        for doc in docs:
            data = doc.to_dict()
            writer.writerow([
                doc.id,
                data.get('name', ''),
                data.get('email', ''),
                data.get('company_name', ''),
                data.get('phone', ''),
                data.get('role', 'customer'),
                data.get('created_at', '')
            ])
            count += 1

    print(f"Exported {count} users to {filename}")
    return filename

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Export data to CSV')
    parser.add_argument('collection', choices=['shipments', 'inventory', 'users', 'all'], help='Collection to export')
    args = parser.parse_args()

    db = get_db()
    if not db:
        exit(1)

    if args.collection == 'shipments':
        export_shipments(db)
    elif args.collection == 'inventory':
        export_inventory(db)
    elif args.collection == 'users':
        export_users(db)
    elif args.collection == 'all':
        export_shipments(db)
        export_inventory(db)
        export_users(db)
        print("\nAll exports complete!")
