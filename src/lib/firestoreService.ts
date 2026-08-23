import { db, storage } from "@/lib/firebase";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { ProductRead, ProductAttribute, ReviewItem, ProductVersion, ProductTruthConflict } from "@/lib/types";

export interface UserProfileDoc {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  provider?: string;
  createdAt?: any;
  updatedAt?: any;
  lastLoginAt?: any;
}

// ---------------------------------------------------------------------------
// 1. User Profile Management
// ---------------------------------------------------------------------------

export async function ensureUserDocument(user: {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  providerId?: string;
}) {
  if (!user || !user.uid) return;

  const userRef = db ? doc(db, "users", user.uid) : null;
  const now = new Date().toISOString();

  const userData = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email.split("@")[0],
    photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=7C3AED&color=fff`,
    provider: user.providerId || "email",
    lastLoginAt: db ? serverTimestamp() : now,
    updatedAt: db ? serverTimestamp() : now,
  };

  if (userRef) {
    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, { ...userData, createdAt: serverTimestamp() });
      } else {
        await setDoc(userRef, userData, { merge: true });
      }
    } catch (err) {
      console.warn("Firestore user document update failed:", err);
    }
  }

  // Fallback local session storage per user
  if (typeof window !== "undefined") {
    localStorage.setItem(`nexgen_user_profile_${user.uid}`, JSON.stringify(userData));
  }
}

// ---------------------------------------------------------------------------
// 2. User-Scoped Product Management (users/{uid}/products/{productId})
// ---------------------------------------------------------------------------

export async function getUserProducts(uid: string): Promise<ProductRead[]> {
  if (!uid) return [];

  if (db) {
    try {
      const productsRef = collection(db, "users", uid, "products");
      const snap = await getDocs(productsRef);
      if (!snap.empty) {
        return snap.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: (() => { const n = Number(docSnap.id); if (Number.isFinite(n) && n > 0) return n; let h = 5381; for (let i = 0; i < docSnap.id.length; i++) h = ((h << 5) + h + docSnap.id.charCodeAt(i)) | 0; return Math.abs(h) || 1; })(),
            name: data.name || "Unnamed Product",
            model_number: data.model_number || data.model || "",
            category: data.category || "General",
            description: data.description || "",
            health_score: data.health_score ?? data.healthScore ?? 0,
            created_by: uid,
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.updated_at || new Date().toISOString(),
            attributes: data.attributes || [],
            review_items: data.review_items || [],
            conflicts: data.conflicts || [],
            versions: data.versions || [],
          } as ProductRead;
        });
      }
    } catch (err) {
      console.warn("Firestore products read failed, falling back to isolated user storage:", err);
    }
  }

  // Local storage per user fallback
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(`nexgen_user_products_${uid}`);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
  }

  return [];
}

export async function saveUserProduct(uid: string, product: ProductRead): Promise<ProductRead> {
  if (!uid) throw new Error("User UID is required to save product.");

  const pId = product.id ? String(product.id) : String(Date.now());
  const now = new Date().toISOString();

  const productData = {
    ...product,
    id: Number(pId) || Date.now(),
    created_by: uid,
    updated_at: now,
  };

  if (db) {
    try {
      const pRef = doc(db, "users", uid, "products", pId);
      await setDoc(pRef, {
        ...productData,
        updated_at: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.warn("Firestore product write failed:", err);
    }
  }

  // Update local storage per user fallback
  if (typeof window !== "undefined") {
    const existing = await getUserProducts(uid);
    const idx = existing.findIndex((p) => p.id === productData.id);
    if (idx >= 0) {
      existing[idx] = productData;
    } else {
      existing.unshift(productData);
    }
    localStorage.setItem(`nexgen_user_products_${uid}`, JSON.stringify(existing));
  }

  return productData;
}

// ---------------------------------------------------------------------------
// 3. User Document Storage (users/{uid}/products/{productId}/documents)
// ---------------------------------------------------------------------------

export async function uploadUserDocument(
  uid: string,
  productId: number | string,
  file: File
): Promise<{ downloadUrl: string; storagePath: string }> {
  const pId = String(productId);
  const path = `users/${uid}/products/${pId}/documents/${Date.now()}_${file.name}`;

  if (storage) {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      // Save document reference in Firestore
      if (db) {
        const docMetaRef = doc(db, "users", uid, "products", pId, "documents", String(Date.now()));
        await setDoc(docMetaRef, {
          fileName: file.name,
          storagePath: path,
          downloadUrl,
          size: file.size,
          contentType: file.type,
          uploadedAt: serverTimestamp(),
        });
      }

      return { downloadUrl, storagePath: path };
    } catch (err) {
      console.error("Firebase Storage upload failed:", err);
      throw new Error(
        "File upload to Firebase Storage failed. Please check your network connection and try again. " +
        "If the problem persists, contact your administrator."
      );
    }
  }

  // Firebase Storage is not configured
  throw new Error(
    "Firebase Storage is not configured. Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable."
  );
}

// ---------------------------------------------------------------------------
// 4. User Dashboard Stats Calculation
// ---------------------------------------------------------------------------

export async function getUserDashboardStats(uid: string) {
  const products = await getUserProducts(uid);

  if (products.length === 0) {
    return {
      total_products: 0,
      average_health_score: 0,
      products_requiring_review: 0,
      missing_attributes: 0,
      open_conflicts: 0,
      total_attributes: 0,
      pending_reviews: 0,
      recent_changes: [],
      quality_overview: { excellent: 0, attention: 0, needs_review: 0 },
    };
  }

  let totalAttrs = 0;
  let missingAttrs = 0;
  let openConflicts = 0;
  let pendingReviews = 0;
  const healthScores: number[] = [];

  for (const p of products) {
    healthScores.push(p.health_score || 0);
    totalAttrs += p.attributes?.length || 0;
    missingAttrs += (p.attributes || []).filter((a) => a.status === "NOT_FOUND" || a.status === "MISSING").length;
    openConflicts += (p.conflicts || []).filter((c) => c.status === "OPEN").length;
    pendingReviews += (p.review_items || []).filter((r) => r.status === "PENDING").length;
  }

  const avgHealth = Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length);

  return {
    total_products: products.length,
    average_health_score: avgHealth,
    products_requiring_review: products.filter((p) => (p.review_items || []).some((r) => r.status === "PENDING")).length,
    missing_attributes: missingAttrs,
    open_conflicts: openConflicts,
    total_attributes: totalAttrs,
    pending_reviews: pendingReviews,
    recent_changes: [],
    quality_overview: {
      excellent: healthScores.filter((s) => s >= 80).length,
      attention: healthScores.filter((s) => s >= 60 && s < 80).length,
      needs_review: healthScores.filter((s) => s < 60).length,
    },
  };
}
