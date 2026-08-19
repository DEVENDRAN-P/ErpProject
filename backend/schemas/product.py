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

