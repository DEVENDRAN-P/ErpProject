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

