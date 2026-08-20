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

const googleProvider = new GoogleAuthProvider();

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to Firebase Auth state on mount
  useEffect(() => {
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

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      throw new Error(friendlyAuthError(err));
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
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
    try {
      await signOut(auth);
    } catch (err: any) {
      throw new Error("Failed to sign out. Please try again.");
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      throw new Error(friendlyAuthError(err));
    }
  }, []);

  const updateProfilePhoto = useCallback(async (file: File): Promise<string> => {
    if (!auth.currentUser) throw new Error("Not authenticated.");
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
    try {
      const userRef = doc(db, "users", uid);
      await setDoc(userRef, { photoURL: downloadURL, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err: any) {
      if (err?.code !== "permission-denied") throw err;
      // Firestore rules not deployed — continue without Firestore write
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
