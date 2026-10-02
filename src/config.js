// Firebase project used for cloud sync. These keys are public identifiers (not secrets);
// data is protected by Google sign-in + the Firestore rules in firestore.rules.
// Set FIREBASE_CONFIG = null to run fully offline (data stays in this browser only).
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDvlXlxD5WfYGoSvkuo1Lm6B9WjeXxdHGM',
  authDomain: 'svl-costing.firebaseapp.com',
  projectId: 'svl-costing',
  storageBucket: 'svl-costing.firebasestorage.app',
  messagingSenderId: '369004239067',
  appId: '1:369004239067:web:4d58f572f7fcc834b414fe',
};

// Only these Google accounts may open cloud data (must match firestore.rules).
export const ALLOWED_EMAILS = []; // e.g. ['ten@gmail.com'] — optional UI check; firestore.rules is the real guard

// Firestore collection holding one document per costing period (YYYY-MM).
export const CLOUD_COLLECTION = 'svl_costing_periods';

export const APP_VERSION = 'web 1.8 · iPhone / iPad / Android · engine Costing Master v30.9 (Step 1–5)';
