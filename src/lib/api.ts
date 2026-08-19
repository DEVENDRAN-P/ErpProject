import { auth } from "@/lib/firebase";

export type UserProfile = {
  id: number;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

// ---------------------------------------------------------------------------
// Firebase Auth helpers
// ---------------------------------------------------------------------------

/** Get the current Firebase user's ID token (or null if not signed in). */
export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

/** Build Authorization headers with the current Firebase ID token. */
export async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------------------
// Keep legacy helpers for backward compat (some components reference them)
// ---------------------------------------------------------------------------

export function saveAccessToken(_token: string) {
  // No-op: Firebase Auth manages its own session persistence.
}

export function removeAccessToken() {
  // No-op: use auth.signOut() instead.
}

export function isTokenValid(): boolean {
  return !!auth.currentUser;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function parseJsonOrText(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}

async function buildAuthHeaders(contentType?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = contentType;
  const authHeaders = await getAuthHeader();
  Object.assign(headers, authHeaders);
  return headers;
}

// ---------------------------------------------------------------------------
// Auth API (kept but the actual auth is now handled by Firebase directly)
// ---------------------------------------------------------------------------

export async function login(email: string, password: string) {
  // This is now handled by Firebase Auth directly via AuthContext.login().
  // Kept for backward compatibility; callers should use useAuth().login() instead.
  throw new Error("Use useAuth().login() instead of this function.");
}

export async function register(email: string, password: string, full_name: string) {
  // This is now handled by Firebase Auth directly via AuthContext.register().
  throw new Error("Use useAuth().register() instead of this function.");
}

export async function fetchUserProfile() {
  const headers = await buildAuthHeaders();
  const response = await fetch("/api/products/me", { method: "GET", headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Your session has expired. Please sign in again.");
    }
    throw new Error(typeof payload === "string" ? payload || "Unable to load user profile." : payload.detail || payload.message || "Unable to load user profile.");
  }
  return payload as UserProfile;
}

// ---------------------------------------------------------------------------
// Product types
// ---------------------------------------------------------------------------

export type ProductAttributeInput = {
  key: string;
  label: string;
  value?: string;
  confidence: number;
  source?: string;
  evidence?: string;
  status?: string;
};

export type ReviewItemInput = {
  title: string;
  item_type: string;
  description?: string;
  action?: string;
  status?: string;
};

export type ProductCreateInput = {
  name: string;
  model_number?: string;
  category?: string;
  description?: string;
  attributes: ProductAttributeInput[];
  review_items: ReviewItemInput[];
};

export type ProductRead = {
  id: number;
  name: string;
  model_number?: string;
  category?: string;
  description?: string;
  health_score: number;
  created_by?: string;
  attributes: {
    id: number;
    key: string;
    label: string;
    value?: string;
    confidence: number;
    source?: string;
    evidence?: string;
    status?: string;
  }[];
  review_items: {
    id: number;
    title: string;
    item_type: string;
    description?: string;
    action?: string;
    status?: string;
  }[];
};

// ---------------------------------------------------------------------------
// Product API calls
// ---------------------------------------------------------------------------

export async function ingestProduct(product: ProductCreateInput) {
  const headers = await buildAuthHeaders("application/json");
  const response = await fetch("/api/products/ingest", {
    method: "POST",
    headers,
    body: JSON.stringify(product),
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error(typeof payload === "string" ? payload || "Unable to ingest product." : payload.detail || payload.message || "Unable to ingest product.");
  }
  return payload;
}

export async function fetchProducts(query = "") {
  const searchParams = new URLSearchParams();
  if (query) searchParams.set("q", query);
  const headers = await buildAuthHeaders();
  const response = await fetch(`/api/products/?${searchParams.toString()}`, { headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error(typeof payload === "string" ? payload || "Unable to fetch products." : payload.detail || payload.message || "Unable to fetch products.");
  }
  return payload as ProductRead[];
}

export async function fetchProduct(productId: number) {
  const headers = await buildAuthHeaders();
  const response = await fetch(`/api/products/${productId}`, { headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error(typeof payload === "string" ? payload || "Unable to load product." : payload.detail || payload.message || "Unable to load product.");
  }
  return payload as ProductRead;
}

export async function fetchDashboardStats() {
  const headers = await buildAuthHeaders();
  const response = await fetch("/api/products/stats", { headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error(typeof payload === "string" ? payload || "Unable to load dashboard stats." : payload.detail || payload.message || "Unable to load dashboard stats.");
  }
  return payload;
}

export async function fetchProductHealth(productId: number) {
  const headers = await buildAuthHeaders();
  const response = await fetch(`/api/products/${productId}/health`, { headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error(typeof payload === "string" ? payload || "Unable to load health breakdown." : payload.detail || payload.message || "Unable to load health breakdown.");
  }
  return payload;
}

export async function validateProduct(productId: number) {
  const headers = await buildAuthHeaders();
  const response = await fetch(`/api/products/${productId}/validate`, { method: "POST", headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error(payload?.detail || "Validation failed.");
  }
  return payload;
}

export async function processWorkflow(formData: FormData) {
  const headers = await buildAuthHeaders();
  const response = await fetch("/api/workflow/process", {
    method: "POST",
    body: formData,
    headers,
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error(typeof payload === "string" ? payload || "Unable to process workflow." : payload.detail || payload.message || "Unable to process workflow.");
  }
  return payload;
}

export async function ingestUrl(url: string) {
  const headers = await buildAuthHeaders("application/json");
  const response = await fetch("/api/products/url-ingest", {
    method: "POST",
    headers,
    body: JSON.stringify({ url }),
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error(payload?.detail || payload?.message || "Failed to fetch URL.");
  }
  return payload;
}

export async function queryRag(question: string, documentContext?: string, productId?: number) {
  const headers = await buildAuthHeaders("application/json");
  const response = await fetch("/api/rag/query", {
    method: "POST",
    headers,
    body: JSON.stringify({ question, document_context: documentContext, product_id: productId }),
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error(payload?.detail || "RAG query failed.");
  }
  return payload;
}

export async function executeReviewAction(reviewId: number, action: string, editedValue?: string, comment?: string) {
  const headers = await buildAuthHeaders("application/json");
  const response = await fetch(`/api/review/${reviewId}/action`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, edited_value: editedValue, comment }),
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error(payload?.detail || "Review action failed.");
  }
  return payload;
}

export function getProductJsonExportUrl(productId: number): string {
  return `/api/products/${productId}/export/json`;
}

export function getProductCsvExportUrl(productId: number): string {
  return `/api/products/${productId}/export/csv`;
}
