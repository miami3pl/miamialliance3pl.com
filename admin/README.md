# Miami Alliance 3PL - Admin CLI Tools

Command-line tools for managing the Miami Alliance 3PL portal.

## Setup

### 1. Install Dependencies

```bash
cd admin
pip install -r requirements.txt
```

### 2. Download Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select **miamialliance3pl** project
3. Go to **Project Settings** (gear icon) > **Service Accounts**
4. Click **Generate new private key**
5. Save the file as `serviceAccountKey.json` in this `admin/` directory

**IMPORTANT:** Never commit `serviceAccountKey.json` to git!

## Available Commands

### View Shipments
```bash
python3 view_shipments.py                    # All shipments
python3 view_shipments.py --status pending   # Filter by status
python3 view_shipments.py --user USER_ID     # Filter by user
```

### Update Shipment Status
```bash
python3 update_shipment.py TRACKING_NUMBER in_transit
python3 update_shipment.py TRACKING_NUMBER delivered
```

### View Inventory
```bash
python3 view_inventory.py                    # All inventory
python3 view_inventory.py --user USER_ID     # Filter by user
```

### Update Inventory
```bash
python3 update_inventory.py SKU --quantity 100
python3 update_inventory.py SKU --location "Rack A-12"
```

### Manage Users
```bash
python3 manage_users.py                      # List all users
python3 manage_users.py --role admin         # List admins only
python3 manage_users.py --set-role USER_ID admin    # Promote to admin
python3 manage_users.py --set-role USER_ID employee # Set as employee
python3 manage_users.py --invite email@example.com employee "John Doe"
```

### Pricing Management
```bash
python3 update_pricing.py --show             # View current pricing
python3 update_pricing.py --pallet-daily 2.50
python3 update_pricing.py --pallet-monthly 45.00
python3 update_pricing.py --receiving 15.00
```

### Export Data
```bash
python3 export_data.py shipments             # Export to CSV
python3 export_data.py inventory
python3 export_data.py users
python3 export_data.py all                   # Export everything
```

## Status Values

- `pending` - Awaiting pickup
- `picked_up` - Picked up from origin
- `in_transit` - On the way
- `out_for_delivery` - Out for final delivery
- `delivered` - Delivered
- `cancelled` - Cancelled

## Role Values

- `admin` - Full access to all features
- `employee` - Staff access (view all customers/shipments)
- `customer` - Regular customer (own data only)
