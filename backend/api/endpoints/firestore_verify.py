"""Firestore persistence verification endpoint.

Reads from Firestore via Firebase Admin SDK to confirm that data written
by the frontend (via client SDK) actually survives browser refresh and
logout/login cycles.

This endpoint answers the question: "Did the frontend's Firestore writes
actually persist, or were they silently lost?"

Storage path convention (written by frontend firestoreService.ts):
    users/{uid}/products/{productId}           — product document
    users/{uid}/products/{productId}/documents/{docId}  — uploaded file metadata

This endpoint reads using Firebase Admin SDK (server-side) to bypass
client SDK limitations and provide an independent verification.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from backend.api.dependencies import get_current_user, AuthenticatedUser
from backend.core.firebase import get_firebase_app

router = APIRouter()


def _get_firestore_client():
    """Get a Firestore client from the Firebase Admin SDK."""
    app = get_firebase_app()
    if app is None:
        raise HTTPException(
            status_code=503,
            detail="Firebase Admin SDK is not configured. "
                   "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, "
                   "and FIREBASE_PRIVATE_KEY environment variables.",
        )
    from firebase_admin import firestore
    return firestore.client(app)


@router.get("/firestore/status")
def firestore_status(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Check Firestore connectivity and return basic stats for the
    authenticated user's data.

    This is a lightweight health check that confirms:
    1. Firebase Admin SDK can connect to Firestore
    2. The user's product collection exists (or is empty)
    3. How many products and documents are stored

    Returns:
        {
            "firestore_connected": true,
            "uid": "...",
            "product_count": 3,
            "total_document_refs": 5,
            "products": [
                {
                    "productId": "12345",
                    "name": "Siemens Motor",
                    "attribute_count": 8,
                    "document_count": 1,
                    "has_llm_used": true,
                    "llm_used": "gemini",
                    "created_at": "...",
                    "updated_at": "..."
                }
            ]
        }
    """
    try:
        db = _get_firestore_client()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to initialize Firestore client: {type(e).__name__}: {e}",
        )

    uid = current_user.uid
    products_ref = db.collection("users").document(uid).collection("products")

    try:
        products_snap = list(products_ref.stream())
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Firestore read failed: {type(e).__name__}: {e}",
        )

    product_summaries = []
    total_doc_refs = 0

    for prod_snap in products_snap:
        prod_data = prod_snap.to_dict() or {}
        product_id = prod_snap.id

        # Count document references (uploaded files) under this product
        docs_ref = products_ref.document(product_id).collection("documents")
        try:
            doc_snaps = list(docs_ref.stream())
            doc_count = len(doc_snaps)
        except Exception:
            doc_count = 0

        total_doc_refs += doc_count

        product_summaries.append({
            "productId": product_id,
            "name": prod_data.get("name", ""),
            "model_number": prod_data.get("model_number", ""),
            "category": prod_data.get("category", ""),
            "attribute_count": len(prod_data.get("attributes", [])),
            "document_count": doc_count,
            "health_score": prod_data.get("health_score"),
            "has_llm_used": bool(prod_data.get("llm_used")),
            "llm_used": prod_data.get("llm_used"),
            "has_conflicts": bool(prod_data.get("conflicts")),
            "has_review_items": bool(prod_data.get("review_items")),
            "storageUrl": prod_data.get("storageUrl"),
            "fileName": prod_data.get("fileName"),
            "created_at": str(prod_data.get("created_at", "")),
            "updated_at": str(prod_data.get("updated_at", "")),
        })

    return {
        "firestore_connected": True,
        "uid": uid,
        "email": current_user.email,
        "product_count": len(products_snap),
        "total_document_refs": total_doc_refs,
        "products": product_summaries,
    }


@router.get("/firestore/products/{product_id}")
def firestore_get_product(
    product_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Read a single product from Firestore with all sub-collections.

    Returns the full product document including:
    - Product attributes
    - Uploaded file metadata (documents sub-collection)
    - Review items
    - Conflicts
    - Versions

    This verifies that ALL data written by the frontend is readable
    server-side via Firebase Admin SDK.
    """
    try:
        db = _get_firestore_client()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to initialize Firestore client: {type(e).__name__}: {e}",
        )

    uid = current_user.uid
    prod_ref = (
        db.collection("users")
        .document(uid)
        .collection("products")
        .document(product_id)
    )

    try:
        prod_snap = prod_ref.get()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Firestore read failed: {type(e).__name__}: {e}",
        )

    if not prod_snap.exists:
        raise HTTPException(
            status_code=404,
            detail=f"Product {product_id} not found in Firestore for user {uid}.",
        )

    prod_data = prod_snap.to_dict() or {}

    # Read sub-collections
    documents = []
    try:
        for doc_snap in prod_ref.collection("documents").stream():
            documents.append({"id": doc_snap.id, **(doc_snap.to_dict() or {})})
    except Exception:
        pass

    review_items = prod_data.get("review_items", [])
    conflicts = prod_data.get("conflicts", [])
    versions = prod_data.get("versions", [])

    return {
        "firestore_connected": True,
        "productId": product_id,
        "uid": uid,
        "product": prod_data,
        "documents": documents,
        "review_items": review_items,
        "conflicts": conflicts,
        "versions": versions,
        "persistence_check": {
            "product_exists": True,
            "has_attributes": bool(prod_data.get("attributes")),
            "attribute_count": len(prod_data.get("attributes", [])),
            "has_documents": bool(documents),
            "document_count": len(documents),
            "has_review_items": bool(review_items),
            "has_conflicts": bool(conflicts),
            "has_health_score": prod_data.get("health_score") is not None,
            "has_llm_used": bool(prod_data.get("llm_used")),
            "llm_used": prod_data.get("llm_used"),
            "has_storage_url": bool(prod_data.get("storageUrl")),
            "data_survives_refresh": True,  # If we can read it server-side, it persists
        },
    }
