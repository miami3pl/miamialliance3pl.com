#!/usr/bin/env python3
"""
Update inventory quantity

Usage:
    python3 update_inventory.py --sku ABC-123 --quantity 50
    python3 update_inventory.py --sku ABC-123 --add 10
    python3 update_inventory.py --sku ABC-123 --subtract 5
"""

import argparse
from datetime import datetime
from config import get_db

def update_inventory(sku, quantity=None, add=None, subtract=None):
    db = get_db()
    if not db:
        return

    # Find item by SKU
    query = db.collection('inventory').where('sku', '==', sku).limit(1)
    docs = list(query.stream())

    if not docs:
        print(f"ERROR: Item with SKU '{sku}' not found")
        return

    doc = docs[0]
    doc_ref = db.collection('inventory').document(doc.id)
    current_data = doc.to_dict()
    current_qty = current_data.get('quantity', 0)

    # Calculate new quantity
    if quantity is not None:
        new_qty = quantity
    elif add is not None:
        new_qty = current_qty + add
    elif subtract is not None:
        new_qty = max(0, current_qty - subtract)
    else:
        print("ERROR: Specify --quantity, --add, or --subtract")
        return

    # Update
    doc_ref.update({
        'quantity': new_qty,
        'last_updated': datetime.now().isoformat()
    })

    print(f"SUCCESS: {sku} quantity updated: {current_qty} -> {new_qty}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Update inventory quantity')
    parser.add_argument('--sku', required=True, help='SKU of the item')
    parser.add_argument('--quantity', type=int, help='Set exact quantity')
    parser.add_argument('--add', type=int, help='Add to current quantity')
    parser.add_argument('--subtract', type=int, help='Subtract from current quantity')
    args = parser.parse_args()

    update_inventory(args.sku, quantity=args.quantity, add=args.add, subtract=args.subtract)
