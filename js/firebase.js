/**
 * Miami Alliance 3PL - Firebase Module
 * @module firebase
 * @version 2.0.0
 * @description Shared Firebase configuration and utilities
 *
 * SECTION IDs:
 * - FB-001: Firebase Configuration
 * - FB-002: Firebase Initialization
 * - FB-003: Auth Utilities
 * - FB-004: Firestore Utilities
 * - FB-005: Role Management
 * - FB-006: Error Handling
 */

// ============================================================
// FB-001: FIREBASE CONFIGURATION
// ============================================================

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA4wMm8-QmZGt3lJcZgTpbBa1W_TklrmRg",
    authDomain: "miamialliance3pl.firebaseapp.com",
    projectId: "miamialliance3pl",
    storageBucket: "miamialliance3pl.firebasestorage.app",
    messagingSenderId: "657614666588",
    appId: "1:657614666588:web:20e50484fe5d90b5aa5f99",
    measurementId: "G-KTW0F25ZM1"
};

// Fallback admin emails (used before Firestore roles exist)
const FALLBACK_ADMIN_EMAILS = [
    'ceo@usglatam.com',
    'yuri@megalopolisms.com'
];

// ============================================================
// FB-002: FIREBASE INITIALIZATION
// ============================================================

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let firebaseFunctions = null;

/**
 * Initialize Firebase services
 * @returns {Promise<{app: object, auth: object, db: object, functions: object}>}
 */
async function initFirebase() {
    if (firebaseApp) {
        return { app: firebaseApp, auth: firebaseAuth, db: firebaseDb, functions: firebaseFunctions };
    }

    try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const { getFunctions } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');

        firebaseApp = initializeApp(FIREBASE_CONFIG);
        firebaseAuth = getAuth(firebaseApp);
        firebaseDb = getFirestore(firebaseApp);
        firebaseFunctions = getFunctions(firebaseApp);

        console.log('[FB-002] Firebase initialized successfully');
        return { app: firebaseApp, auth: firebaseAuth, db: firebaseDb, functions: firebaseFunctions };
    } catch (error) {
        console.error('[FB-002] Firebase initialization failed:', error);
        throw new FirebaseError('FB-002', 'Failed to initialize Firebase', error);
    }
}

// ============================================================
// FB-003: AUTH UTILITIES
// ============================================================

/**
 * Get current authenticated user with retry logic
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} retryDelay - Delay between retries in ms
 * @returns {Promise<object|null>}
 */
async function getCurrentUser(maxRetries = 3, retryDelay = 500) {
    const { auth } = await initFirebase();

    for (let i = 0; i < maxRetries; i++) {
        if (auth.currentUser) {
            return auth.currentUser;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    return null;
}

/**
 * Sign out the current user
 * @returns {Promise<void>}
 */
async function signOutUser() {
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const { auth } = await initFirebase();

    try {
        await signOut(auth);
        console.log('[FB-003] User signed out successfully');
    } catch (error) {
        console.error('[FB-003] Sign out failed:', error);
        throw new FirebaseError('FB-003', 'Failed to sign out', error);
    }
}

/**
 * Set up authentication state listener
 * @param {Function} callback - Called with (user, userData, userRole)
 * @returns {Function} Unsubscribe function
 */
async function onAuthChange(callback) {
    const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const { auth } = await initFirebase();

    return onAuthStateChanged(auth, async (user) => {
        if (!user) {
            callback(null, null, null);
            return;
        }

        try {
            const userData = await getUserData(user.uid);
            const userRole = getUserRole(user.email, userData);
            callback(user, userData, userRole);
        } catch (error) {
            console.error('[FB-003] Error in auth change handler:', error);
            callback(user, null, 'customer');
        }
    });
}

// ============================================================
// FB-004: FIRESTORE UTILITIES
// ============================================================

/**
 * Get user data from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<object|null>}
 */
async function getUserData(userId) {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { db } = await initFirebase();

    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
        console.error('[FB-004] Error fetching user data:', error);
        return null;
    }
}

/**
 * Get settings from Firestore
 * @param {string} settingsKey - Settings document ID
 * @returns {Promise<object|null>}
 */
async function getSettings(settingsKey) {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { db } = await initFirebase();

    try {
        const settingsDoc = await getDoc(doc(db, 'settings', settingsKey));
        return settingsDoc.exists() ? settingsDoc.data() : null;
    } catch (error) {
        console.error(`[FB-004] Error fetching settings '${settingsKey}':`, error);
        return null;
    }
}

/**
 * Save settings to Firestore
 * @param {string} settingsKey - Settings document ID
 * @param {object} data - Settings data
 * @returns {Promise<boolean>}
 */
async function saveSettings(settingsKey, data) {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { db } = await initFirebase();

    try {
        await setDoc(doc(db, 'settings', settingsKey), {
            ...data,
            updatedAt: new Date().toISOString()
        });
        console.log(`[FB-004] Settings '${settingsKey}' saved successfully`);
        return true;
    } catch (error) {
        console.error(`[FB-004] Error saving settings '${settingsKey}':`, error);
        return false;
    }
}

/**
 * Query collection with error handling
 * @param {string} collectionName - Collection name
 * @param {Array} constraints - Query constraints
 * @returns {Promise<Array>}
 */
async function queryCollection(collectionName, constraints = []) {
    const { collection, query, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { db } = await initFirebase();

    try {
        const q = constraints.length > 0
            ? query(collection(db, collectionName), ...constraints)
            : collection(db, collectionName);

        const snapshot = await getDocs(q);
        const results = [];
        snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
        return results;
    } catch (error) {
        console.error(`[FB-004] Error querying '${collectionName}':`, error);
        throw new FirebaseError('FB-004', `Failed to query ${collectionName}`, error);
    }
}

// ============================================================
// FB-005: ROLE MANAGEMENT
// ============================================================

/**
 * Determine user role
 * @param {string} email - User email
 * @param {object} userData - User data from Firestore
 * @returns {string} - 'admin', 'employee', or 'customer'
 */
function getUserRole(email, userData) {
    // Check Firestore role first
    if (userData?.role) {
        return userData.role;
    }

    // Fallback to hardcoded admin emails
    if (FALLBACK_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email?.toLowerCase())) {
        return 'admin';
    }

    return 'customer';
}

/**
 * Check if user is staff (admin or employee)
 * @param {string} role - User role
 * @returns {boolean}
 */
function isStaff(role) {
    return role === 'admin' || role === 'employee';
}

/**
 * Check if user is admin
 * @param {string} role - User role
 * @returns {boolean}
 */
function isAdmin(role) {
    return role === 'admin';
}

// ============================================================
// FB-006: ERROR HANDLING
// ============================================================

/**
 * Custom Firebase Error class
 */
class FirebaseError extends Error {
    constructor(code, message, originalError = null) {
        super(message);
        this.name = 'FirebaseError';
        this.code = code;
        this.originalError = originalError;
    }
}

/**
 * Handle Firebase errors with user-friendly messages
 * @param {Error} error - Original error
 * @returns {string} - User-friendly error message
 */
function getErrorMessage(error) {
    const errorMessages = {
        'auth/invalid-email': 'Invalid email address.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Check your connection.',
        'permission-denied': 'You do not have permission to perform this action.',
        'unavailable': 'Service temporarily unavailable. Please try again.',
    };

    const code = error.code || error.message;
    return errorMessages[code] || error.message || 'An unexpected error occurred.';
}

// ============================================================
// EXPORTS
// ============================================================

export {
    FIREBASE_CONFIG,
    FALLBACK_ADMIN_EMAILS,
    initFirebase,
    getCurrentUser,
    signOutUser,
    onAuthChange,
    getUserData,
    getSettings,
    saveSettings,
    queryCollection,
    getUserRole,
    isStaff,
    isAdmin,
    FirebaseError,
    getErrorMessage
};
