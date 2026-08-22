from sqlalchemy import text

from backend.db.base import Base
from backend.db.session import engine, SessionLocal
from backend.models.user import User
from backend.models.product import (
    Product, ProductAttribute, ReviewItem, ProductVersion, ProductTruthConflict,
    ProductRelationship, ExplanationLog, Notification,
)
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


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema_columns()

    # Load validation reference data (LOV / UOM / manufacturer canonical)
    load_reference_data()

    db = SessionLocal()
    try:
        normalize_legacy_statuses(db)
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    print("Database initialization complete.")
