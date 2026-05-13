#!/usr/bin/env python3
"""
Manage users and roles

Usage:
    python3 manage_users.py                     # List all users
    python3 manage_users.py --role admin        # List admins only
    python3 manage_users.py --set-role USER_ID admin   # Set user role
    python3 manage_users.py --invite email@example.com employee "John Doe"
"""

import argparse
from datetime import datetime
from config import get_db

def list_users(role_filter=None):
    db = get_db()
    if not db:
        return

    query = db.collection('users')

    if role_filter:
        query = query.where('role', '==', role_filter)

    docs = query.stream()

    print("\n" + "=" * 80)
    print("USERS")
    print("=" * 80)

    count = 0
    for doc in docs:
        data = doc.to_dict()
        count += 1
        role = data.get('role', 'customer')
        role_badge = {'admin': '[ADMIN]', 'employee': '[STAFF]', 'customer': '[CUST]'}.get(role, '[?]')

        print(f"\n{role_badge} {data.get('name', 'N/A')}")
        print(f"  Email: {data.get('email', 'N/A')}")
        print(f"  Company: {data.get('company_name', 'N/A')}")
        print(f"  Phone: {data.get('phone', 'N/A')}")
        print(f"  UID: {doc.id}")
        print(f"  Created: {data.get('created_at', 'N/A')}")
        print("-" * 40)

    print(f"\nTotal: {count} users")

def set_role(user_id, new_role):
    db = get_db()
    if not db:
        return

    valid_roles = ['admin', 'employee', 'customer']
    if new_role not in valid_roles:
        print(f"ERROR: Invalid role. Must be one of: {', '.join(valid_roles)}")
        return

    user_ref = db.collection('users').document(user_id)
    user_doc = user_ref.get()

    if not user_doc.exists:
        print(f"ERROR: User {user_id} not found")
        return

    user_ref.update({'role': new_role})
    print(f"SUCCESS: User {user_id} role updated to {new_role}")

def create_invite(email, role, name):
    db = get_db()
    if not db:
        return

    valid_roles = ['admin', 'employee', 'customer']
    if role not in valid_roles:
        print(f"ERROR: Invalid role. Must be one of: {', '.join(valid_roles)}")
        return

    invite_ref = db.collection('pending_invites').document(email.lower())
    invite_ref.set({
        'email': email.lower(),
        'role': role,
        'name': name,
        'invited_at': datetime.now().isoformat(),
        'invited_by': 'CLI'
    })
    print(f"SUCCESS: Invite created for {email} as {role}")
    print(f"When {email} signs up, they will automatically be assigned the {role} role.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Manage users and roles')
    parser.add_argument('--role', help='Filter by role (admin, employee, customer)')
    parser.add_argument('--set-role', nargs=2, metavar=('USER_ID', 'ROLE'), help='Set user role')
    parser.add_argument('--invite', nargs=3, metavar=('EMAIL', 'ROLE', 'NAME'), help='Create pending invite')
    args = parser.parse_args()

    if args.set_role:
        set_role(args.set_role[0], args.set_role[1])
    elif args.invite:
        create_invite(args.invite[0], args.invite[1], args.invite[2])
    else:
        list_users(role_filter=args.role)
