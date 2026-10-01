// Firebase project used for cloud sync. These keys are public identifiers (not secrets);
// data is protected by Google sign-in + the Firestore rules in firestore.rules.
// Set FIREBASE_CONFIG = null to run fully offline (data stays in this browser only).
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA8XGvUoCBWs8WUlwC2hUEHPF6RQl6eSM0',
  authDomain: 'dailyworkplan-de669.firebaseapp.com',
  projectId: 'dailyworkplan-de669',
  storageBucket: 'dailyworkplan-de669.firebasestorage.app',
};

// Only these Google accounts may open cloud data (must match firestore.rules).
export const ALLOWED_EMAILS = []; // e.g. ['ten@gmail.com'] — optional UI check; firestore.rules is the real guard

// Firestore collection holding one document per costing period (YYYY-MM).
export const CLOUD_COLLECTION = 'svl_costing_periods';

export const APP_VERSION = 'web 1.0 · engine = Costing Master v30.9 (Step 1–3A)';
