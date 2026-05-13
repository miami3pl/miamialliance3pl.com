#!/usr/bin/env python3
"""
Update pricing settings from CLI

Usage:
    python3 update_pricing.py --show                    # Show current pricing
    python3 update_pricing.py --pallet-daily 2.50       # Set pallet daily rate
    python3 update_pricing.py --pallet-monthly 45.00    # Set pallet monthly rate
    python3 update_pricing.py --receiving 15.00         # Set receiving rate per pallet
"""

import argparse
from datetime import datetime
from config import get_db

def show_pricing():
    db = get_db()
    if not db:
        return

    doc = db.collection('settings').document('pricing').get()

    if not doc.exists:
        print("No pricing configured yet.")
        return

    data = doc.to_dict()

    print("\n" + "=" * 60)
    print("CURRENT PRICING")
    print("=" * 60)

    # Storage
    storage = data.get('storage', {})
    print("\nSTORAGE RATES:")
    print(f"  Pallet Daily:    ${storage.get('palletDaily', 0):.2f}")
    print(f"  Pallet Weekly:   ${storage.get('palletWeekly', 0):.2f}")
    print(f"  Pallet Monthly:  ${storage.get('palletMonthly', 0):.2f}")
    print(f"  Container 20ft:  ${storage.get('container20ft', 0):.2f}/day")
    print(f"  Container 40ft:  ${storage.get('container40ft', 0):.2f}/day")
    print(f"  Container 40HC:  ${storage.get('container40hc', 0):.2f}/day")

    # Handling
    handling = data.get('handling', {})
    print("\nHANDLING SERVICES:")
    print(f"  Receiving:       ${handling.get('receiving', 0):.2f}/pallet")
    print(f"  Unloading:       ${handling.get('unloading', 0):.2f}/hour")
    print(f"  Pick & Pack:     ${handling.get('pickpack', 0):.2f}/order")
    print(f"  Labeling:        ${handling.get('labeling', 0):.2f}/item")
    print(f"  Palletizing:     ${handling.get('palletizing', 0):.2f}/pallet")
    print(f"  Loading:         ${handling.get('loading', 0):.2f}/hour")

    # Additional
    additional = data.get('additional', {})
    print("\nADDITIONAL SERVICES:")
    print(f"  Kitting:         ${additional.get('kitting', 0):.2f}/kit")
    print(f"  Returns:         ${additional.get('returns', 0):.2f}/item")
    print(f"  Rush Handling:   ${additional.get('rush', 0):.2f}/order")

    # Freight
    freight = data.get('freight', {})
    print("\nFREIGHT SURCHARGES:")
    print(f"  Fuel Surcharge:  {freight.get('fuelSurcharge', 0):.1f}%")
    print(f"  Residential:     ${freight.get('residentialSurcharge', 0):.2f}")
    print(f"  Liftgate Del:    ${freight.get('liftgateDelivery', 0):.2f}")

    print(f"\nLast updated: {data.get('updated_at', 'N/A')}")
    print(f"Updated by: {data.get('updated_by', 'N/A')}")

def update_pricing(**kwargs):
    db = get_db()
    if not db:
        return

    doc_ref = db.collection('settings').document('pricing')
    doc = doc_ref.get()

    if doc.exists:
        data = doc.to_dict()
    else:
        data = {'storage': {}, 'handling': {}, 'additional': {}, 'freight': {}}

    # Map CLI args to nested structure
    mapping = {
        'pallet_daily': ('storage', 'palletDaily'),
        'pallet_weekly': ('storage', 'palletWeekly'),
        'pallet_monthly': ('storage', 'palletMonthly'),
        'container_20ft': ('storage', 'container20ft'),
        'container_40ft': ('storage', 'container40ft'),
        'receiving': ('handling', 'receiving'),
        'unloading': ('handling', 'unloading'),
        'pickpack': ('handling', 'pickpack'),
        'labeling': ('handling', 'labeling'),
        'kitting': ('additional', 'kitting'),
        'rush': ('additional', 'rush'),
        'fuel_surcharge': ('freight', 'fuelSurcharge'),
    }

    updated = False
    for key, value in kwargs.items():
        if value is not None and key in mapping:
            section, field = mapping[key]
            if section not in data:
                data[section] = {}
            data[section][field] = float(value)
            print(f"Updated {section}.{field} = ${value}")
            updated = True

    if updated:
        data['updated_at'] = datetime.now().isoformat()
        data['updated_by'] = 'CLI'
        doc_ref.set(data)
        print("\nPricing updated successfully!")
    else:
        print("No changes made.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Update pricing settings')
    parser.add_argument('--show', action='store_true', help='Show current pricing')
    parser.add_argument('--pallet-daily', type=float, help='Pallet daily rate')
    parser.add_argument('--pallet-weekly', type=float, help='Pallet weekly rate')
    parser.add_argument('--pallet-monthly', type=float, help='Pallet monthly rate')
    parser.add_argument('--container-20ft', type=float, help='20ft container daily rate')
    parser.add_argument('--container-40ft', type=float, help='40ft container daily rate')
    parser.add_argument('--receiving', type=float, help='Receiving rate per pallet')
    parser.add_argument('--unloading', type=float, help='Unloading rate per hour')
    parser.add_argument('--pickpack', type=float, help='Pick & pack rate per order')
    parser.add_argument('--labeling', type=float, help='Labeling rate per item')
    parser.add_argument('--kitting', type=float, help='Kitting rate per kit')
    parser.add_argument('--rush', type=float, help='Rush handling rate per order')
    parser.add_argument('--fuel-surcharge', type=float, help='Fuel surcharge percentage')
    args = parser.parse_args()

    if args.show:
        show_pricing()
    else:
        update_pricing(
            pallet_daily=args.pallet_daily,
            pallet_weekly=args.pallet_weekly,
            pallet_monthly=args.pallet_monthly,
            container_20ft=args.container_20ft,
            container_40ft=args.container_40ft,
            receiving=args.receiving,
            unloading=args.unloading,
            pickpack=args.pickpack,
            labeling=args.labeling,
            kitting=args.kitting,
            rush=args.rush,
            fuel_surcharge=args.fuel_surcharge
        )
