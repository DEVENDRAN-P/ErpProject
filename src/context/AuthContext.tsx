"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  User,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const googleProvider = typeof GoogleAuthProvider !== "undefined" ? new GoogleAuthProvider() : null;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  registerWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfilePhoto: (file: File) => Promise<string>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  login: async () => {},
  loginWithGoogle: async () => {},
  register: async () => {},
  registerWithGoogle: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
  updateProfilePhoto: async () => "",
});

export function useAuth() {
  return useContext(AuthContext);
}

/** Friendly error messages for common Firebase Auth errors. */
function friendlyAuthError(error: any): string {
  const code = error?.code || "";
  if (code === "auth/user-not-found") return "No account found with this email address.";
  if (code === "auth/wrong-password") return "Incorrect password. Please try again.";
  if (code === "auth/invalid-email") return "Please enter a valid email address.";
  if (code === "auth/email-already-in-use") return "An account with this email already exists.";
  if (code === "auth/weak-password") return "Password must be at least 6 characters.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please try again later.";
  if (code === "auth/user-disabled") return "This account has been disabled.";
  if (code === "auth/invalid-credential") return "Invalid email or password. Please try again.";
  if (code === "auth/network-request-failed") return "Network error. Please check your connection.";
  if (code === "auth/operation-not-allowed") return "This sign-in method is not enabled.";
  if (code === "auth/popup-closed-by-user") return "Sign-in popup was closed. Please try again.";
  if (code === "auth/popup-blocked") return "Popup was blocked by your browser. Please allow popups and try again.";
  if (code === "auth/cancelled-popup-request") return "Sign-in was cancelled. Please try again.";
  return error?.message || "An unexpected error occurred. Please try again.";
}

/** Save or update user profile in Firestore.
 *  Gracefully handles permission errors when Firestore rules are not deployed. */
async function saveUserProfile(user: User, extra?: Record<string, any>) {
  if (!db) return; // Firebase not configured
  try {
    const userRef = doc(db, "users", user.uid);
    const existing = await getDoc(userRef);
    const data: Record<string, any> = {
      uid: user.uid,
      email: user.email?.toLowerCase() || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || null,
      role: "user",
      updatedAt: serverTimestamp(),
      ...extra,
    };
    if (!existing.exists()) {
      data.createdAt = serverTimestamp();
    }
    await setDoc(userRef, data, { merge: true });
  } catch (err: any) {
    // Firestore rules may not be deployed yet — silently continue
    if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
      console.warn("Firestore: permission denied — rules may not be deployed.", err.message);
      return;
    }
    throw err;
  }
}

function createDemoUser(email: string, displayName?: string): User {
  const name = displayName || email.split("@")[0] || "NexGen User";
  const hash = Math.abs(email.split("").reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0));
  return {
    uid: "demo-user-" + hash,
    email: email.toLowerCase(),
    displayName: name,
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: "demo-token",
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => "demo-token-12345",
    getIdTokenResult: async () => ({ token: "demo-token-12345" } as any),
    reload: async () => {},
    toJSON: () => ({}),
    phoneNumber: null,
    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7C3AED&color=fff`,
    providerId: "demo",
  };
}

import { ensureUserDocument } from "@/lib/firestoreService";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to Firebase Auth state on mount (or restore local demo session)
  useEffect(() => {
    if (!auth) {
      const saved = typeof window !== "undefined" ? localStorage.getItem("nexgen_demo_user") : null;
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const demoUser = createDemoUser(parsed.email, parsed.displayName);
          setUser(demoUser);
          ensureUserDocument({
            uid: demoUser.uid,
            email: demoUser.email || "",
            displayName: demoUser.displayName,
            photoURL: demoUser.photoURL,
            providerId: "demo",
          }).catch(() => {});
        } catch {
          localStorage.removeItem("nexgen_demo_user");
        }
      }
      setLoading(false);
      return;
    }

    // Handle redirect result (from signInWithRedirect fallback)
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          await saveUserProfile(result.user, { authProvider: "google" }).catch(() => {});
        }
      })
      .catch(() => {
        // Silently handle redirect errors — user will see auth state change
      });

    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        if (firebaseUser) {
          ensureUserDocument({
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            providerId: firebaseUser.providerData[0]?.providerId || "firebase",
          }).catch(() => {});
        }
        setLoading(false);
      }, (error) => {
        // Gracefully handle IndexedDB "Database is closing/hidden" errors
        console.warn("Firebase Auth state listener error:", error?.message);
        setLoading(false);
      });
    } catch (err: any) {
      console.warn("Firebase Auth subscription failed:", err?.message);
      setLoading(false);
    }
    return () => unsubscribe?.();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!auth) {
      const demo = createDemoUser(email);
      localStorage.setItem("nexgen_demo_user", JSON.stringify({ email, displayName: demo.displayName }));
      setUser(demo);
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      throw new Error(friendlyAuthError(err));
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!auth || !googleProvider) {
      const demo = createDemoUser("google.user@nexgen.ai", "Google User");
      localStorage.setItem("nexgen_demo_user", JSON.stringify({ email: "google.user@nexgen.ai", displayName: "Google User" }));
      setUser(demo);
      return;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Save/update user profile in Firestore
      await saveUserProfile(result.user, { authProvider: "google" }).catch(() => {});
    } catch (err: any) {
      // If popup is blocked (COOP policy) or fails, fall back to redirect
      if (
        err.code === "auth/popup-blocked" ||
        err.code === "auth/cancelled-popup-request" ||
        err.code === "auth/popup-closed-by-user"
      ) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      throw new Error(friendlyAuthError(err));
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      if (!auth) {
        const demo = createDemoUser(email, displayName);
        localStorage.setItem("nexgen_demo_user", JSON.stringify({ email, displayName }));
        setUser(demo);
        return;
      }
      try {
        // 1. Create Firebase Auth account
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        // 2. Update display name on the auth profile
        if (displayName) {
          await updateProfile(cred.user, { displayName });
        }

        // 3. Create Firestore user profile document
        await saveUserProfile(cred.user, { authProvider: "email" });
      } catch (err: any) {
        throw new Error(friendlyAuthError(err));
      }
    },
    [],
  );

  const registerWithGoogle = useCallback(async () => {
    if (!auth || !googleProvider) {
      const demo = createDemoUser("google.user@nexgen.ai", "Google User");
      localStorage.setItem("nexgen_demo_user", JSON.stringify({ email: "google.user@nexgen.ai", displayName: "Google User" }));
      setUser(demo);
      return;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await saveUserProfile(result.user, { authProvider: "google" }).catch(() => {});
    } catch (err: any) {
      if (
        err.code === "auth/popup-blocked" ||
        err.code === "auth/cancelled-popup-request" ||
        err.code === "auth/popup-closed-by-user"
      ) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      throw new Error(friendlyAuthError(err));
    }
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem("nexgen_demo_user");
    if (!auth) {
      setUser(null);
      return;
    }
    try {
      await signOut(auth);
    } catch (err: any) {
      throw new Error("Failed to sign out. Please try again.");
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!auth) {
      return; // Demo reset succeeded
    }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      throw new Error(friendlyAuthError(err));
    }
  }, []);

  const updateProfilePhoto = useCallback(async (file: File): Promise<string> => {
    if (!auth?.currentUser) throw new Error("Not authenticated.");
    const uid = auth.currentUser.uid;

    // Convert file to Base64 Data URL instead of using paid Firebase Storage
    const downloadURL = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });

    // Update Firebase Auth profile
    await updateProfile(auth.currentUser, { photoURL: downloadURL });

    // Update Firestore document (gracefully handle permission errors)
    if (db) {
      try {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, { photoURL: downloadURL, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err: any) {
        if (err?.code !== "permission-denied") throw err;
        // Firestore rules not deployed — continue without Firestore write
      }
    }

    // Force re-render with updated photo
    setUser({ ...auth.currentUser! });

    return downloadURL;
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    loginWithGoogle,
    register,
    registerWithGoogle,
    logout,
    resetPassword,
    updateProfilePhoto,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
