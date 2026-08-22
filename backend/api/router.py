from fastapi import APIRouter

from backend.api.endpoints import (
    auth, health, products, workflow, review, rag,
    knowledge_graph, explainability, batch_reports, notifications,
    firestore_verify,
)

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])

api_router.include_router(workflow.router, prefix="", tags=["Workflow"])
api_router.include_router(review.router, prefix="/review", tags=["Human Review"])
api_router.include_router(rag.router, prefix="/rag", tags=["RAG Verification"])

# ─── Team 1: Knowledge Graph ────────────────────────────────────────────
api_router.include_router(knowledge_graph.router, prefix="/products", tags=["Knowledge Graph"])

# ─── Team 2: Explainability ─────────────────────────────────────────────
api_router.include_router(explainability.router, prefix="/products", tags=["Explainability"])

# ─── Team 3: Batch Operations & Reports ─────────────────────────────────
api_router.include_router(batch_reports.router, prefix="/products", tags=["Batch & Reports"])

# ─── Team 4: Notifications & WebSocket ──────────────────────────────────
api_router.include_router(notifications.router, prefix="", tags=["Notifications"])

# ─── Firestore Persistence Verification ──────────────────────────────────
api_router.include_router(firestore_verify.router, prefix="/products", tags=["Firestore Verify"])
