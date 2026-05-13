# Miami Alliance 3PL Website

## Project Overview
Static website for Miami Alliance 3PL logistics company with customer portal.
- **Hosting:** GitHub Pages (https://megalopolisms.github.io/miamialliance3pl/)
- **Backend:** Firebase (Auth + Firestore)
- **Stack:** HTML, CSS, JavaScript (vanilla)

## Company Info
- **Address:** 8780 NW 100th ST, Medley, FL 33178
- **Customer:** Pablo Nicotine Pouches (featured on homepage)

## File Structure
```
/
├── index.html          # Landing page
├── services.html       # Services detail
├── about.html          # About company
├── contact.html        # Contact form
├── login.html          # Customer login
├── portal/
│   ├── dashboard.html  # Customer dashboard
│   ├── shipments.html  # Create & manage shipments
│   ├── tracking.html   # Track shipment status
│   └── inventory.html  # Inventory management
├── css/style.css       # Main stylesheet
├── js/main.js          # Navigation & utilities
├── admin/              # Python admin scripts (local)
├── sitemap.xml         # SEO sitemap
└── robots.txt          # Crawler instructions
```

## Firebase Setup Required
Before the customer portal works, you need to:
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication (Email/Password)
3. Create Firestore database
4. Get your Firebase config and update these files:
   - `login.html`
   - `portal/dashboard.html`
   - `portal/shipments.html`
   - `portal/tracking.html`
   - `portal/inventory.html`

Replace the placeholder config:
```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

## Firestore Collections
- `users/` - Customer profiles
- `shipments/` - Shipment records
- `inventory/` - Inventory items

## Python Admin Scripts
Located in `/admin/` - run locally to manage data:
```bash
cd admin
pip install firebase-admin
python3 view_shipments.py
python3 update_shipment.py --id ABC123 --status delivered
```

## Development
No build step required - just edit HTML/CSS/JS files directly.

After changes:
```bash
git add . && git commit -m "Update description" && git push
```

## Colors
- Primary: #1e3a5f (Navy blue)
- Accent: #f59e0b (Orange)
- Background: #ffffff (White)

## Responsive Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px
