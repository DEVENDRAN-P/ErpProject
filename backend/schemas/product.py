from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict


class ValidationResult(BaseModel):
    attribute_match: bool = True
    unit_valid: bool = True
    context_valid: bool = True
    plausibility_valid: bool = True
    cross_attribute_valid: str = "insufficient_data"
    details: str = ""


class ProductAttributeBase(BaseModel):
    key: str
    label: str
    raw_value: Optional[str] = None
    normalized_value: Optional[str] = None
    value: Optional[str] = None
    unit: Optional[str] = None
    confidence: float = 0.0
    source: Optional[str] = None
    page: Optional[int] = 1
    evidence: Optional[str] = None
    evidence_quote: Optional[str] = None
    status: Optional[str] = "verified"
    validation: ValidationResult = ValidationResult()
    reason: str = ""
    lov_valid: bool = False
    uom_valid: bool = False
    needs_human_review: bool = False


class ProductAttributeCreate(ProductAttributeBase):
    pass


class ProductAttributeRead(ProductAttributeBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ProductTwinAttribute(BaseModel):
    attribute: str
    raw_value: Optional[str] = None
    normalized_value: Optional[str] = None
    unit: Optional[str] = None
    confidence: float = 0.0
    status: str = "VERIFIED"
    source: Optional[str] = None
    source_page: Optional[int] = None
    evidence: Optional[str] = None
    lov_valid: bool = False
    uom_valid: bool = False
    needs_human_review: bool = False

    model_config = ConfigDict(from_attributes=True)


class ReviewItemBase(BaseModel):
    title: str
    item_type: str
    description: Optional[str] = None
    action: Optional[str] = None
    status: Optional[str] = "pending"


class ReviewItemCreate(ReviewItemBase):
    pass


class ReviewItemRead(ReviewItemBase):
    id: int
    reviewer: Optional[str] = None
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    reason: Optional[str] = None
    created_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProductVersionRead(BaseModel):
    id: int
    version_number: int
    changes_json: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductTruthConflictRead(BaseModel):
    id: int
    attribute_key: str
    label: str
    sources_json: str
    recommended_value: Optional[str] = None
    reasoning: Optional[str] = None
    status: str
    reviewer: Optional[str] = None
    resolution: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProductBase(BaseModel):
    name: str
    model_number: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None


class ProductCreate(ProductBase):
    attributes: List[ProductAttributeCreate] = []
    review_items: List[ReviewItemCreate] = []


class ProductRead(ProductBase):
    id: int
    health_score: int
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    attributes: List[ProductAttributeRead] = []
    review_items: List[ReviewItemRead] = []
    versions: List[ProductVersionRead] = []
    conflicts: List[ProductTruthConflictRead] = []

    model_config = ConfigDict(from_attributes=True)


class ReviewActionInput(BaseModel):
    action: str  # "approve", "reject", "edit"
    edited_value: Optional[str] = None
    comment: Optional[str] = None
    reviewer: Optional[str] = None


class RagQueryInput(BaseModel):
    question: str
    document_context: Optional[str] = None
    product_id: Optional[int] = None


class RagQueryResponse(BaseModel):
    question: str
    answer: str
    has_evidence: bool
    confidence: float
    sources: List[str] = []
    evidence_snippets: List[str] = []


# ─── Team 1: Knowledge Graph Schemas ────────────────────────────────────

class KnowledgeGraphResponse(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    summary: Dict[str, Any]


class KnowledgeGraphQueryInput(BaseModel):
    query_type: str = "related"  # related, by_type, shortest_path
    entity_id: Optional[str] = None
    entity_type: Optional[str] = None


class ProductRelationshipRead(BaseModel):
    id: int
    source_id: int
    source_type: str
    target_id: int
    target_type: str
    relationship_type: str
    label: Optional[str] = None
    weight: float = 1.0
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Team 2: Explainability Schemas ─────────────────────────────────────

class ConfidenceBreakdown(BaseModel):
    unit_match: float = 0.0
    context_match: float = 0.0
    plausibility: float = 0.0
    weighted_average: float = 0.0


class AlternativeValue(BaseModel):
    value: Optional[str] = None
    confidence: float = 0.0
    reason_rejected: Optional[str] = None


class ReasoningStep(BaseModel):
    step: str
    action: str
    detail: str


class AttributeExplanation(BaseModel):
    attribute_key: str
    attribute_label: Optional[str] = None
    source_document: Optional[str] = None
    source_page: Optional[int] = None
    extraction_method: str  # rule_based, llm, hybrid
    confidence_score: float = 0.0
    confidence_breakdown: Dict[str, float] = {}
    chosen_value: Optional[str] = None
    alternative_values: List[Dict[str, Any]] = []
    evidence_quote: Optional[str] = None
    reasoning_chain: List[Dict[str, str]] = []


class ExplainabilityResponse(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    total_attributes: int = 0
    summary: Dict[str, Any] = {}
    explanations: List[AttributeExplanation] = []


class ExplanationLogRead(BaseModel):
    id: int
    product_id: int
    attribute_key: str
    attribute_label: Optional[str] = None
    source_document: Optional[str] = None
    source_page: Optional[int] = None
    extraction_method: Optional[str] = None
    confidence_score: float = 0.0
    confidence_breakdown: Optional[str] = None
    chosen_value: Optional[str] = None
    alternative_values: Optional[str] = None
    evidence_quote: Optional[str] = None
    reasoning_chain: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Team 3: Batch & Reports Schemas ────────────────────────────────────

class BatchImportItem(BaseModel):
    name: str
    model_number: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    attributes: List[Dict[str, Any]] = []


class BatchImportInput(BaseModel):
    products: List[BatchImportItem]
    overwrite_existing: bool = False


class BatchImportResponse(BaseModel):
    total: int
    succeeded: int
    failed: int
    errors: List[Dict[str, Any]] = []
    product_ids: List[int] = []


class DataQualityResponse(BaseModel):
    total_products: int
    overall_quality_score: float
    total_attributes: int
    filled_attributes: int
    completeness_rate: float
    total_conflicts: int
    resolved_conflicts: int
    conflict_rate: float
    resolution_rate: float
    completeness_by_category: Dict[str, Any] = {}
    missing_by_attribute: Dict[str, int] = {}
    health_distribution: Dict[str, int] = {}


class ComplianceReportResponse(BaseModel):
    total_products: int
    overall_compliance_rate: float
    by_category: Dict[str, Any] = {}


class AuditTrailEntry(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    action: str
    field: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    source: Optional[str] = None
    reviewer: Optional[str] = None
    timestamp: Optional[str] = None


# ─── Team 4: Notifications Schemas ──────────────────────────────────────

class NotificationRead(BaseModel):
    id: int
    user_id: str
    type: str
    title: str
    message: Optional[str] = None
    product_id: Optional[int] = None
    is_read: bool = False
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class NotificationCreate(BaseModel):
    user_id: str
    type: str
    title: str
    message: Optional[str] = None
    product_id: Optional[int] = None


class WebSocketMessage(BaseModel):
    type: str  # notification, update, presence
    data: Dict[str, Any]
