from fastapi import APIRouter

from backend.api.endpoints import auth, health, products, workflow, review, rag

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])

api_router.include_router(workflow.router, prefix="", tags=["Workflow"])
api_router.include_router(review.router, prefix="/review", tags=["Human Review"])
api_router.include_router(rag.router, prefix="/rag", tags=["RAG Verification"])

