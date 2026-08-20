from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Float, Boolean
from sqlalchemy.orm import relationship

from backend.db.base import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False)
    model_number = Column(String(128), nullable=True)
    category = Column(String(128), nullable=True)
    description = Column(Text, nullable=True)
    health_score = Column(Integer, default=0)
    created_by = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    attributes = relationship("ProductAttribute", back_populates="product", cascade="all, delete-orphan")
    review_items = relationship("ReviewItem", back_populates="product", cascade="all, delete-orphan")
    versions = relationship("ProductVersion", back_populates="product", cascade="all, delete-orphan")
    conflicts = relationship("ProductTruthConflict", back_populates="product", cascade="all, delete-orphan")


class ProductAttribute(Base):
    __tablename__ = "product_attributes"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    key = Column(String(128), nullable=False)
    label = Column(String(128), nullable=False)
    raw_value = Column(Text, nullable=True)
    normalized_value = Column(Text, nullable=True)
    value = Column(Text, nullable=True)
    unit = Column(String(32), nullable=True)
    confidence = Column(Float, default=0.0)
    source = Column(String(256), nullable=True)
    page = Column(Integer, nullable=True, default=1)
    evidence = Column(Text, nullable=True)
    evidence_quote = Column(Text, nullable=True)
    status = Column(String(64), nullable=True, default="verified")
    lov_valid = Column(Boolean, default=False)
    uom_valid = Column(Boolean, default=False)
    needs_human_review = Column(Boolean, default=False)

    product = relationship("Product", back_populates="attributes")


class ReviewItem(Base):
    __tablename__ = "review_items"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(256), nullable=False)
    item_type = Column(String(64), nullable=False)
    description = Column(Text, nullable=True)
    action = Column(String(128), nullable=True)
    status = Column(String(64), nullable=True, default="pending")
    reviewer = Column(String(256), nullable=True)
    previous_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    product = relationship("Product", back_populates="review_items")


class ProductVersion(Base):
    __tablename__ = "product_versions"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False, default=1)
    changes_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="versions")


class ProductTruthConflict(Base):
    __tablename__ = "product_truth_conflicts"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    attribute_key = Column(String(128), nullable=False)
    label = Column(String(128), nullable=False)
    sources_json = Column(Text, nullable=False)
    recommended_value = Column(String(256), nullable=True)
    reasoning = Column(Text, nullable=True)
    status = Column(String(64), default="open")
    reviewer = Column(String(256), nullable=True)
    resolution = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    product = relationship("Product", back_populates="conflicts")


# ─── Team 1: Knowledge Graph ────────────────────────────────────────────

class ProductRelationship(Base):
    __tablename__ = "product_relationships"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, nullable=False)
    source_type = Column(String(64), nullable=False)  # product, manufacturer, standard, attribute
    target_id = Column(Integer, nullable=False)
    target_type = Column(String(64), nullable=False)  # product, manufacturer, standard, attribute
    relationship_type = Column(String(128), nullable=False)  # relates_to, compliant_with, manufactured_by
    label = Column(String(256), nullable=True)
    weight = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─── Team 2: Explainability ─────────────────────────────────────────────

class ExplanationLog(Base):
    __tablename__ = "explanation_logs"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    attribute_key = Column(String(128), nullable=False)
    attribute_label = Column(String(128), nullable=True)
    source_document = Column(String(256), nullable=True)
    source_page = Column(Integer, nullable=True)
    extraction_method = Column(String(64), nullable=True)  # rule_based, llm, hybrid
    confidence_score = Column(Float, default=0.0)
    confidence_breakdown = Column(Text, nullable=True)  # JSON: unit_match, context_match, plausibility
    chosen_value = Column(Text, nullable=True)
    alternative_values = Column(Text, nullable=True)  # JSON array of {value, confidence, reason_rejected}
    evidence_quote = Column(Text, nullable=True)
    reasoning_chain = Column(Text, nullable=True)  # JSON array of reasoning steps
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product")


# ─── Team 4: Notifications ──────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(256), nullable=False, index=True)
    type = Column(String(64), nullable=False)  # conflict, review, system, batch, quality
    title = Column(String(256), nullable=False)
    message = Column(Text, nullable=True)
    product_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
