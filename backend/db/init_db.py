import json
from datetime import datetime

from sqlalchemy import text

from backend.db.base import Base
from backend.db.session import engine, SessionLocal
from backend.models.user import User
from backend.models.product import Product, ProductAttribute, ReviewItem, ProductVersion, ProductTruthConflict
from backend.reference_data import load_reference_data
from backend.status import canonical_status


# Columns added after the initial schema was created. SQLite cannot add
# columns via ALTER TABLE ... ADD COLUMN if NOT NULL without a default,
# so these are all nullable and applied lazily on startup.
_ADDED_COLUMNS = {
    "review_items": [
        ("reviewer", "VARCHAR(256)"),
        ("previous_value", "TEXT"),
        ("new_value", "TEXT"),
        ("reason", "TEXT"),
        ("reviewed_at", "DATETIME"),
    ],
    "product_truth_conflicts": [
        ("reviewer", "VARCHAR(256)"),
        ("resolution", "TEXT"),
        ("resolved_at", "DATETIME"),
    ],
}


def ensure_schema_columns() -> None:
    """Add any columns introduced after the initial schema to existing DBs."""
    with engine.connect() as conn:
        for table, columns in _ADDED_COLUMNS.items():
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            for col_name, col_type in columns:
                if col_name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"))
                    print(f"Added column {table}.{col_name}")
        conn.commit()


def normalize_legacy_statuses(db) -> None:
    """Map legacy lowercase status values to the canonical uppercase vocabulary."""
    for row in db.query(ProductAttribute).all():
        canonical = canonical_status(row.status)
        if canonical != row.status:
            row.status = canonical
    for row in db.query(ReviewItem).all():
        canonical = canonical_status(row.status)
        if canonical != row.status:
            row.status = canonical
    for row in db.query(ProductTruthConflict).all():
        canonical = canonical_status(row.status)
        if canonical != row.status:
            row.status = canonical
    db.commit()


def seed_demo_data(db) -> None:
    """Seed the demo Siemens industrial motor with clean/incomplete/conflicting sources."""
    existing = db.query(Product).filter(Product.model_number == "1LE1001-1DB43-4AA4").first()
    if existing:
        return

    demo_product = Product(
        name="Siemens 1LE1001 15kW 3-Phase Industrial Motor",
        model_number="1LE1001-1DB43-4AA4",
        category="Electric Motors & Drives",
        description="Heavy-duty 3-phase induction motor for industrial pumping, fan, and compressor applications. Operates on 415V/50Hz supply with IP55 protection.",
        health_score=85,
        created_by="system@productpilot.ai",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(demo_product)
    db.flush()

    demo_attributes = [
        ProductAttribute(
            product_id=demo_product.id,
            key="rated_power",
            label="Rated Power",
            raw_value="15 kW",
            normalized_value="15",
            value="15",
            unit="kW",
            confidence=0.98,
            source="Siemens_1LE1001_Datasheet.pdf",
            page=1,
            evidence="Datasheet Page 1: Rated Output Power: 15 kW (20 HP)",
            evidence_quote="Output: 15 kW at 1475 RPM",
            status="VERIFIED",
            lov_valid=True,
            uom_valid=True,
        ),
        ProductAttribute(
            product_id=demo_product.id,
            key="supply_voltage",
            label="Supply Voltage",
            raw_value="415 V",
            normalized_value="415",
            value="415",
            unit="V",
            confidence=0.96,
            source="Siemens_1LE1001_Datasheet.pdf",
            page=1,
            evidence="Datasheet Page 1: Rated Voltage 415 V Delta / 690 V Star",
            evidence_quote="Voltage supply 415V 50Hz",
            status="VERIFIED",
            lov_valid=True,
            uom_valid=True,
        ),
        ProductAttribute(
            product_id=demo_product.id,
            key="rated_current",
            label="Rated Current",
            raw_value="28.5 A",
            normalized_value="28.5",
            value="28.5",
            unit="A",
            confidence=0.94,
            source="Siemens_1LE1001_Datasheet.pdf",
            page=2,
            evidence="Datasheet Page 2: Full Load Current 28.5 A",
            evidence_quote="Current at 100% load: 28.5 A",
            status="VERIFIED",
            lov_valid=True,
            uom_valid=True,
        ),
        ProductAttribute(
            product_id=demo_product.id,
            key="efficiency_class",
            label="Efficiency Class",
            raw_value="IE3 Premium",
            normalized_value="IE3 Premium",
            value="IE3 Premium",
            unit="",
            confidence=0.99,
            source="Siemens_1LE1001_Datasheet.pdf",
            page=2,
            evidence="Datasheet Page 2: Efficiency Class IE3 (92.6% efficiency)",
            evidence_quote="IE3 efficiency level compliant with IEC 60034-30-1",
            status="VERIFIED",
            lov_valid=True,
            uom_valid=True,
        ),
        ProductAttribute(
            product_id=demo_product.id,
            key="rated_speed",
            label="Rated Speed",
            raw_value="1475 rpm",
            normalized_value="1475",
            value="1475",
            unit="rpm",
            confidence=0.95,
            source="Siemens_1LE1001_Datasheet.pdf",
            page=1,
            evidence="Datasheet Page 1: Full Load Speed 1475 rpm",
            evidence_quote="Rated speed: 1475 rpm",
            status="VERIFIED",
            lov_valid=True,
            uom_valid=True,
        ),
        ProductAttribute(
            product_id=demo_product.id,
            key="max_temperature",
            label="Max Operating Temperature",
            raw_value="155 °C",
            normalized_value="155",
            value="155",
            unit="°C",
            confidence=0.82,
            source="Siemens_1LE1001_Datasheet.pdf",
            page=1,
            evidence="Conflict detected between Datasheet (155°C Class F) and Web Catalog (130°C Class B)",
            evidence_quote="Insulation Class F (155°C)",
            status="CONFLICT",
            lov_valid=True,
            uom_valid=True,
        ),
        ProductAttribute(
            product_id=demo_product.id,
            key="frame_size",
            label="Frame Size",
            raw_value="160M",
            normalized_value="160M",
            value="160M",
            unit="",
            confidence=0.97,
            source="Siemens_1LE1001_Datasheet.pdf",
            page=1,
            evidence="Datasheet Page 1: IEC Frame Size 160M cast iron",
            evidence_quote="Frame 160M cast iron structure",
            status="VERIFIED",
            lov_valid=True,
            uom_valid=True,
        ),
        ProductAttribute(
            product_id=demo_product.id,
            key="total_weight",
            label="Total Weight",
            raw_value=None,
            normalized_value=None,
            value=None,
            unit="kg",
            confidence=0.0,
            source="None",
            page=0,
            evidence="Attribute missing from all ingested sources.",
            evidence_quote="Weight not specified in sheet",
            status="NOT_FOUND",
            lov_valid=False,
            uom_valid=True,
            needs_human_review=True,
        ),
    ]
    db.add_all(demo_attributes)

    demo_conflicts = [
        ProductTruthConflict(
            product_id=demo_product.id,
            attribute_key="max_temperature",
            label="Max Operating Temperature",
            sources_json=json.dumps([
                {
                    "source": "Siemens_1LE1001_Datasheet.pdf",
                    "value": "155 °C",
                    "confidence": 0.95,
                    "evidence": "Class F thermal insulation rating (155°C max rise)",
                    "page": 1,
                },
                {
                    "source": "siemens-catalog-web.com/1le1001",
                    "value": "130 °C",
                    "confidence": 0.70,
                    "evidence": "Operating temperature Class B (130°C limit)",
                    "page": 1,
                },
            ]),
            recommended_value="155 °C (Class F)",
            reasoning="Manufacturer PDF specification sheet takes precedence over legacy distributor website listing.",
            status="OPEN",
        )
    ]
    db.add_all(demo_conflicts)

    demo_reviews = [
        ReviewItem(
            product_id=demo_product.id,
            title="Missing Attribute: Total Weight (kg)",
            item_type="missing",
            description="Motor total net weight is required for shipping compliance and catalog export.",
            action="Add weight value",
            status="PENDING",
        ),
        ReviewItem(
            product_id=demo_product.id,
            title="Conflict: Max Operating Temp (155 °C vs 130 °C)",
            item_type="conflict",
            description="Datasheet PDF specifies 155 °C while Web Catalog lists 130 °C. Recommended: 155 °C.",
            action="Resolve conflict",
            status="PENDING",
        ),
    ]
    db.add_all(demo_reviews)

    demo_versions = [
        ProductVersion(
            product_id=demo_product.id,
            version_number=1,
            changes_json=json.dumps([
                {
                    "field": "Initial Ingestion",
                    "old": "N/A",
                    "new": "1LE1001-1DB43-4AA4",
                    "source": "Siemens_1LE1001_Datasheet.pdf",
                    "evidence": "Initial PDF datasheet upload and extraction",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            ]),
            created_at=datetime.utcnow(),
        )
    ]
    db.add_all(demo_versions)

    db.commit()
    print("Demo industrial motor dataset seeded.")


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema_columns()

    # Load validation reference data (LOV / UOM / manufacturer canonical)
    load_reference_data()

    db = SessionLocal()
    try:
        normalize_legacy_statuses(db)
        seed_demo_data(db)
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    print("Database initialization complete.")
