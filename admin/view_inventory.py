#!/usr/bin/env python3
"""
View inventory items

Usage:
    python3 view_inventory.py
    python3 view_inventory.py --user USER_ID
    python3 view_inventory.py --low-stock
"""

import argparse
from config import get_db

def view_inventory(user_id=None, low_stock_only=False):
    db = get_db()
    if not db:
        return

    query = db.collection('inventory')

    if user_id:
        query = query.where('user_id', '==', user_id)

    docs = list(query.stream())

    print("\n" + "=" * 80)
    print("INVENTORY")
    print("=" * 80)

    total_items = 0
    total_units = 0
    low_stock_count = 0

    for doc in docs:
        data = doc.to_dict()
        qty = data.get('quantity', 0)
        reorder = data.get('reorder_level', 10)
        is_low = qty <= reorder

        total_items += 1
        total_units += qty
        if is_low:
            low_stock_count += 1

        if low_stock_only and not is_low:
            continue

        print(f"\nSKU: {data.get('sku', 'N/A')}")
        print(f"Name: {data.get('name', 'N/A')}")
        print(f"Quantity: {qty} {'⚠️ LOW STOCK' if is_low else ''}")
        print(f"Location: {data.get('location', 'N/A')}")
        print(f"Reorder Level: {reorder}")
        print(f"Last Updated: {data.get('last_updated', 'N/A')}")
        print("-" * 40)

    print(f"\n{'='*40}")
    print(f"Total Items: {total_items}")
    print(f"Total Units: {total_units}")
    print(f"Low Stock Items: {low_stock_count}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='View inventory')
    parser.add_argument('--user', help='Filter by user ID')
    parser.add_argument('--low-stock', action='store_true', help='Show only low stock items')
    args = parser.parse_args()

    view_inventory(user_id=args.user, low_stock_only=args.low_stock)
