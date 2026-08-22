from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db, AuthenticatedUser
from backend.schemas.product import RagQueryInput, RagQueryResponse

from backend.ai.agents.rag_agent import query_rag
from backend.models.product import Product
from backend.status import canonical_status

router = APIRouter()


def _build_product_context(product: Product) -> str:
    """Build a RAG-indexable document from the product's attributes and
    their provenance so answers are always evidence-backed."""
    lines = [f"{product.name} ({product.model_number or 'unknown model'})."]
    for attr in product.attributes:
        value = attr.value or attr.normalized_value
        if value is None:
            continue
        parts = [attr.label or attr.key, str(value)]
        if attr.unit:
            parts.append(str(attr.unit))
        line = ": ".join(parts)
        if attr.evidence:
            line += f" — evidence: {attr.evidence}"
        if attr.source:
            line += f" (source: {attr.source}, page {attr.page or 1})"
        lines.append(line)
    return "\n".join(lines)


@router.post("/query", response_model=RagQueryResponse)
def execute_rag_query(
    query_input: RagQueryInput,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> RagQueryResponse:
    document_text = query_input.document_context

    if query_input.product_id is not None:
        product = db.query(Product).filter(Product.id == query_input.product_id, Product.created_by == current_user.email).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found or access denied")
        product_context = _build_product_context(product)
        # Prefer product-derived context; fall back to any pasted context
        document_text = product_context if not document_text else f"{product_context}\n{document_text}"

    res = query_rag(
        question=query_input.question,
        document_text=document_text,
    )
    return RagQueryResponse(**res)
