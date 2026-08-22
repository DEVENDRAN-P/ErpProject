import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Check if all required Firebase config values are present. */
function isFirebaseConfigured(): boolean {
  const isConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
  if (!isConfigured && typeof window !== "undefined") {
    console.warn("Firebase is not configured! Missing NEXT_PUBLIC_FIREBASE_* variables:", {
      apiKey: firebaseConfig.apiKey ? "OK" : "MISSING",
      projectId: firebaseConfig.projectId ? "OK" : "MISSING",
    });
  }
  return isConfigured;
}

// Only initialize Firebase if config is present (prevents build-time crashes on Vercel)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (err) {
    console.warn("Firebase initialization failed:", err);
  }
}

export { app, auth, db, storage };
