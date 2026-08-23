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
  if (!auth) return null;
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
  return !!auth?.currentUser;
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

import { getUserProducts, getUserDashboardStats } from "@/lib/firestoreService";

export async function fetchProducts(query = "") {
  const uid = auth?.currentUser?.uid;
  try {
    const searchParams = new URLSearchParams();
    if (query) searchParams.set("q", query);
    const headers = await buildAuthHeaders();
    const response = await fetch(`/api/products/?${searchParams.toString()}`, { headers });
    const payload = await parseJsonOrText(response);
    if (response.ok && Array.isArray(payload) && payload.length > 0) {
      return payload as ProductRead[];
    }
  } catch {}

  if (uid) {
    const userProducts = await getUserProducts(uid);
    if (!query) return userProducts;
    const q = query.toLowerCase();
    return userProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q) ||
        (p.model_number || "").toLowerCase().includes(q)
    );
  }
  return [];
}

export async function fetchProduct(productId: number) {
  const uid = auth?.currentUser?.uid;
  try {
    const headers = await buildAuthHeaders();
    const response = await fetch(`/api/products/${productId}`, { headers });
    const payload = await parseJsonOrText(response);
    if (response.ok) return payload as ProductRead;
  } catch {}

  if (uid) {
    const userProducts = await getUserProducts(uid);
    const found = userProducts.find((p) => p.id === productId);
    if (found) return found;
  }

  throw new Error("Product not found");
}

export async function fetchDashboardStats() {
  const uid = auth?.currentUser?.uid;
  try {
    const headers = await buildAuthHeaders();
    const response = await fetch("/api/products/stats", { headers });
    const payload = await parseJsonOrText(response);
    if (response.ok && payload && typeof payload === "object" && payload.total_products !== undefined) {
      return payload;
    }
  } catch {}

  if (uid) {
    return await getUserDashboardStats(uid);
  }

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

export async function fetchProductHealth(productId: number) {
  const headers = await buildAuthHeaders();
  const response = await fetch(`/api/products/${productId}/health`, { headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    throw new Error(typeof payload === "string" ? payload : payload?.detail || "Failed to load product health data.");
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
  }  return payload;
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
    if (response.status === 413) throw new Error("File too large. Maximum upload size is 10 MB.");
    if (response.status === 422) throw new Error(typeof payload === "string" ? payload : payload?.detail || "Validation failed. The document could not be processed.");
    if (response.status === 400) throw new Error(typeof payload === "string" ? payload : payload?.detail || "Invalid request. Please check the file type and try again.");
    if (response.status === 504) throw new Error(typeof payload === "string" ? payload : payload?.error || "Analysis timed out. The document may be too large — try a smaller file or wait and retry.");
    if (response.status === 502) throw new Error(typeof payload === "string" ? payload : payload?.error || "Backend temporarily unavailable. Please try again in a moment.");
    throw new Error(typeof payload === "string" ? payload : payload?.detail || payload?.message || `Document analysis failed (HTTP ${response.status}).`);
  }
  return payload;
}

export async function processCsvWorkflow(formData: FormData) {
  const headers = await buildAuthHeaders();
  const response = await fetch("/api/workflow/process-csv", {
    method: "POST",
    body: formData,
    headers,
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    if (response.status === 413) throw new Error("File too large. Maximum upload size is 10 MB.");
    if (response.status === 422) throw new Error(typeof payload === "string" ? payload : payload?.detail || "CSV processing failed.");
    if (response.status === 400) throw new Error(typeof payload === "string" ? payload : payload?.detail || "Invalid CSV file.");
    if (response.status === 504) throw new Error(typeof payload === "string" ? payload : payload?.error || "CSV processing timed out. Try a smaller file or split into batches.");
    if (response.status === 502) throw new Error(typeof payload === "string" ? payload : payload?.error || "Backend temporarily unavailable. Please try again in a moment.");
    throw new Error(typeof payload === "string" ? payload : payload?.detail || payload?.message || `CSV processing failed (HTTP ${response.status}).`);
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
    if (response.status === 422) throw new Error(typeof payload === "string" ? payload : payload?.detail || "Unable to ingest URL. The website may be unreachable or contain no extractable content.");
    throw new Error(typeof payload === "string" ? payload : payload?.detail || payload?.message || "Failed to fetch URL.");
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
    throw new Error(typeof payload === "string" ? payload : payload?.detail || "RAG query failed.");
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

// ─── Team 1: Knowledge Graph API ────────────────────────────────────────

export async function fetchKnowledgeGraph(productId: number) {
  const headers = await buildAuthHeaders();
  const response = await fetch(`/api/products/${productId}/knowledge-graph`, { headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok) throw new Error(payload?.detail || "Failed to load knowledge graph.");
  return payload;
}

export async function fetchFullKnowledgeGraph() {
  const headers = await buildAuthHeaders();
  const response = await fetch("/api/products/knowledge-graph/full", { headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok) throw new Error(payload?.detail || "Failed to load knowledge graph.");
  return payload;
}

export async function queryKnowledgeGraph(queryType: string, entityId?: string, entityType?: string) {
  const headers = await buildAuthHeaders("application/json");
  const response = await fetch("/api/products/knowledge-graph/query", {
    method: "POST",
    headers,
    body: JSON.stringify({ query_type: queryType, entity_id: entityId, entity_type: entityType }),
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) throw new Error(payload?.detail || "Knowledge graph query failed.");
  return payload;
}

// ─── Team 2: Explainability API ─────────────────────────────────────────

export async function fetchExplainability(productId: number) {
  const headers = await buildAuthHeaders();
  const response = await fetch(`/api/products/${productId}/explainability`, { headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok) throw new Error(payload?.detail || "Failed to load explainability data.");
  return payload;
}

export async function fetchAttributeExplanation(productId: number, attrKey: string) {
  const headers = await buildAuthHeaders();
  const response = await fetch(`/api/products/${productId}/explainability/${attrKey}`, { headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok) throw new Error(payload?.detail || "Failed to load attribute explanation.");
  return payload;
}

export async function fetchExplainabilityAuditTrail(productId: number) {
  const headers = await buildAuthHeaders();
  const response = await fetch(`/api/products/${productId}/explainability/audit-trail`, { headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok) throw new Error(payload?.detail || "Failed to load audit trail.");
  return payload;
}

// ─── Team 3: Batch & Reports API ────────────────────────────────────────

export async function batchImportProducts(products: any[]) {
  const headers = await buildAuthHeaders("application/json");
  const response = await fetch("/api/products/batch/import", {
    method: "POST",
    headers,
    body: JSON.stringify({ products }),
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) throw new Error(payload?.detail || "Batch import failed.");
  return payload;
}

export async function batchImportCsv(file: File) {
  const headers = await getAuthHeader();
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/products/batch/import/csv", {
    method: "POST",
    headers,
    body: formData,
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) throw new Error(payload?.detail || "CSV import failed.");
  return payload;
}

export function getBatchExportUrl(format: string = "json", category?: string): string {
  const params = new URLSearchParams({ format });
  if (category) params.set("category", category);
  return `/api/products/batch/export?${params.toString()}`;
}

export async function downloadBatchExport(format: string = "json", category?: string): Promise<void> {
  const params = new URLSearchParams({ format });
  if (category) params.set("category", category);
  const headers = await buildAuthHeaders();
  const response = await fetch(`/api/products/batch/export?${params.toString()}`, { headers });
  if (!response.ok) {
    const payload = await parseJsonOrText(response);
    throw new Error(typeof payload === "string" ? payload : payload?.detail || "Export failed.");
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `products_export_${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function fetchDataQualityReport() {
  const headers = await buildAuthHeaders();
  const response = await fetch("/api/products/reports/data-quality", { headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok || !payload || typeof payload !== "object") {
    throw new Error(typeof payload === "string" ? payload : payload?.detail || "Failed to load data quality report.");
  }
  return payload;
}

export async function fetchComplianceReport() {
  const headers = await buildAuthHeaders();
  const response = await fetch("/api/products/reports/compliance", { headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok || !payload || typeof payload !== "object") {
    throw new Error(typeof payload === "string" ? payload : payload?.detail || "Failed to load compliance report.");
  }
  return payload;
}

export async function fetchAuditTrail() {
  const headers = await buildAuthHeaders();
  const response = await fetch("/api/products/reports/audit-trail", { headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok) return [];
  return Array.isArray(payload) ? payload : [];
}

// ─── Team 4: Notifications API ──────────────────────────────────────────

export async function fetchNotifications(typeFilter?: string, unreadOnly?: boolean) {
  try {
    const params = new URLSearchParams();
    if (typeFilter) params.set("type_filter", typeFilter);
    if (unreadOnly) params.set("unread_only", "true");
    const headers = await buildAuthHeaders();
    const response = await fetch(`/api/notifications?${params.toString()}`, { headers });
    const payload = await parseJsonOrText(response);
    if (!response.ok) return [];
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

export async function fetchUnreadCount() {
  try {
    const headers = await buildAuthHeaders();
    const response = await fetch("/api/notifications/unread-count", { headers });
    const payload = await parseJsonOrText(response);
    if (!response.ok) return { unread_count: 0 };
    return payload || { unread_count: 0 };
  } catch {
    return { unread_count: 0 };
  }
}

export async function markNotificationRead(notificationId: number) {
  const headers = await buildAuthHeaders();
  const response = await fetch(`/api/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers,
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) throw new Error(payload?.detail || "Failed to mark notification as read.");
  return payload;
}

export async function markAllNotificationsRead() {
  const headers = await buildAuthHeaders();
  const response = await fetch("/api/notifications/mark-all-read", {
    method: "POST",
    headers,
  });
  const payload = await parseJsonOrText(response);
  if (!response.ok) throw new Error(payload?.detail || "Failed to mark all as read.");
  return payload;
}

export async function fetchActivityFeed(limit = 20) {
  const headers = await buildAuthHeaders();
  const response = await fetch(`/api/activity-feed?limit=${limit}`, { headers });
  const payload = await parseJsonOrText(response);
  if (!response.ok) throw new Error(payload?.detail || "Failed to load activity feed.");
  return payload;
}
