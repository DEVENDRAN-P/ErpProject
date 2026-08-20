export type ProductAttribute = {
  id: number;
  key: string;
  label: string;
  value?: string;
  unit?: string;
  confidence: number;
  source?: string;
  page?: number;
  evidence?: string;
  evidence_quote?: string;
  status?: string;
};

export type ReviewItem = {
  id: number;
  title: string;
  item_type: string;
  description?: string;
  action?: string;
  status?: string;
  reviewer?: string;
  previous_value?: string;
  new_value?: string;
  reason?: string;
  created_at?: string;
  reviewed_at?: string;
};

export type ProductVersion = {
  id: number;
  version_number: number;
  changes_json?: string;
  created_at: string;
};

export type ProductTruthConflict = {
  id: number;
  attribute_key: string;
  label: string;
  sources_json: string;
  recommended_value?: string;
  reasoning?: string;
  status: string;
  reviewer?: string;
  resolution?: string;
  created_at: string;
  resolved_at?: string;
};

export type DashboardStats = {
  total_products: number;
  average_health_score: number;
  products_requiring_review: number;
  missing_attributes: number;
  open_conflicts: number;
  total_attributes: number;
  pending_reviews: number;
  recent_changes: {
    product_id: number;
    product_name: string;
    field: string;
    old?: string;
    new?: string;
    source?: string;
    timestamp?: string;
  }[];
  quality_overview: {
    excellent: number;
    attention: number;
    needs_review: number;
  };
};

export type HealthBreakdown = {
  score: number;
  completeness: number;
  consistency: number;
  confidence: number;
  source_reliability: number;
  weights: {
    completeness: number;
    consistency: number;
    confidence: number;
    source_reliability: number;
  };
  explanation: string;
};

export type ProductRead = {
  id: number;
  name: string;
  model_number?: string;
  category?: string;
  description?: string;
  health_score: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  attributes: ProductAttribute[];
  review_items: ReviewItem[];
  versions?: ProductVersion[];
  conflicts?: ProductTruthConflict[];
};

export type RagQueryResponse = {
  question: string;
  answer: string;
  has_evidence: boolean;
  confidence: number;
  sources: string[];
  evidence_snippets: string[];
};

// ─── Team 1: Knowledge Graph Types ──────────────────────────────────────

export type KnowledgeGraphNode = {
  id: string;
  type: string; // product, manufacturer, standard, attribute
  label: string;
  model?: string;
  category?: string;
  health_score?: number;
};

export type KnowledgeGraphEdge = {
  source: string;
  target: string;
  type: string; // relates_to, compliant_with, manufactured_by
  label: string;
};

export type KnowledgeGraphResponse = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  summary: {
    total_nodes: number;
    total_edges: number;
    node_types: string[];
    edge_types: string[];
  };
};

// ─── Team 2: Explainability Types ───────────────────────────────────────

export type ConfidenceBreakdown = {
  unit_match: number;
  context_match: number;
  plausibility: number;
  weighted_average: number;
};

export type AlternativeValue = {
  value?: string;
  confidence: number;
  reason_rejected?: string;
};

export type ReasoningStep = {
  step: string;
  action: string;
  detail: string;
};

export type AttributeExplanation = {
  attribute_key: string;
  attribute_label?: string;
  source_document?: string;
  source_page?: number;
  extraction_method: string;
  confidence_score: number;
  confidence_breakdown: ConfidenceBreakdown;
  chosen_value?: string;
  alternative_values: AlternativeValue[];
  evidence_quote?: string;
  reasoning_chain: ReasoningStep[];
};

export type ExplainabilityResponse = {
  product_id?: number;
  product_name?: string;
  total_attributes: number;
  summary: {
    high_confidence_count: number;
    medium_confidence_count: number;
    low_confidence_count: number;
    rule_based_extractions: number;
    llm_extractions: number;
  };
  explanations: AttributeExplanation[];
};

// ─── Team 3: Batch & Reports Types ──────────────────────────────────────

export type DataQualityResponse = {
  total_products: number;
  overall_quality_score: number;
  total_attributes: number;
  filled_attributes: number;
  completeness_rate: number;
  total_conflicts: number;
  resolved_conflicts: number;
  conflict_rate: number;
  resolution_rate: number;
  completeness_by_category: Record<string, { total: number; filled: number; completeness_pct: number }>;
  missing_by_attribute: Record<string, number>;
  health_distribution: { excellent: number; attention: number; needs_review: number };
};

export type ComplianceReportResponse = {
  total_products: number;
  overall_compliance_rate: number;
  by_category: Record<string, { total_products: number; compliant: number; non_compliant: number; pending: number }>;
};

export type AuditTrailEntry = {
  product_id?: number;
  product_name?: string;
  action: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  source?: string;
  reviewer?: string;
  timestamp?: string;
};

// ─── Team 4: Notification Types ─────────────────────────────────────────

export type Notification = {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message?: string;
  product_id?: number;
  is_read: boolean;
  created_at?: string;
};

export type ActivityFeedEntry = {
  type: string;
  subtype: string;
  title: string;
  message: string;
  product_id?: number;
  timestamp?: string;
};
