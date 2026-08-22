"""Team 1: Knowledge Graph API endpoints."""

from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db, AuthenticatedUser
from backend.models.product import Product, ProductRelationship
from backend.schemas.product import KnowledgeGraphResponse, KnowledgeGraphQueryInput
from backend.ai.agents.knowledge_graph_agent import (
    extract_relationships,
    build_graph_nodes_edges,
    query_graph,
)

router = APIRouter()


def _product_to_dict(product: Product) -> Dict[str, Any]:
    """Convert a Product ORM model to a dict for the agent."""
    return {
        "id": product.id,
        "name": product.name,
        "model_number": product.model_number,
        "category": product.category,
        "description": product.description,
        "health_score": product.health_score,
        "attributes": [
            {
                "key": a.key,
                "label": a.label,
                "value": a.value,
                "normalized_value": a.normalized_value,
                "raw_value": a.raw_value,
                "unit": a.unit,
                "confidence": a.confidence,
                "source": a.source,
                "evidence": a.evidence,
                "evidence_quote": a.evidence_quote,
                "status": a.status,
            }
            for a in product.attributes
        ],
    }


@router.get("/{product_id}/knowledge-graph", response_model=KnowledgeGraphResponse)
def get_product_knowledge_graph(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> KnowledgeGraphResponse:
    """Get the knowledge graph for a specific product."""
    product = db.query(Product).filter(Product.id == product_id, Product.created_by == current_user.email).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or access denied")

    product_dict = _product_to_dict(product)
    graph_data = build_graph_nodes_edges([product_dict])

    return KnowledgeGraphResponse(
        nodes=graph_data["nodes"],
        edges=graph_data["edges"],
        summary={
            "total_nodes": len(graph_data["nodes"]),
            "total_edges": len(graph_data["edges"]),
            "node_types": list(set(n["type"] for n in graph_data["nodes"])),
            "edge_types": list(set(e["type"] for e in graph_data["edges"])),
        },
    )


@router.get("/knowledge-graph/full", response_model=KnowledgeGraphResponse)
def get_full_knowledge_graph(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> KnowledgeGraphResponse:
    """Get the complete knowledge graph across all products."""
    products = db.query(Product).filter(Product.created_by == current_user.email).all()
    product_dicts = [_product_to_dict(p) for p in products]
    graph_data = build_graph_nodes_edges(product_dicts)

    return KnowledgeGraphResponse(
        nodes=graph_data["nodes"],
        edges=graph_data["edges"],
        summary={
            "total_nodes": len(graph_data["nodes"]),
            "total_edges": len(graph_data["edges"]),
            "total_products": len(products),
            "node_types": list(set(n["type"] for n in graph_data["nodes"])),
            "edge_types": list(set(e["type"] for e in graph_data["edges"])),
        },
    )


@router.post("/knowledge-graph/query")
def query_knowledge_graph(
    query_input: KnowledgeGraphQueryInput,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Query the knowledge graph for related entities."""
    products = db.query(Product).filter(Product.created_by == current_user.email).all()
    product_dicts = [_product_to_dict(p) for p in products]
    graph_data = build_graph_nodes_edges(product_dicts)

    result = query_graph(
        graph_data=graph_data,
        query_type=query_input.query_type,
        entity_id=query_input.entity_id,
        entity_type=query_input.entity_type,
    )

    return {
        "nodes": result["nodes"],
        "edges": result["edges"],
        "query": query_input.model_dump(),
    }


@router.get("/knowledge-graph/relationships", response_model=List[Dict[str, Any]])
def list_relationships(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """List all stored product relationships."""
    relationships = db.query(ProductRelationship).all()
    return [
        {
            "id": r.id,
            "source_id": r.source_id,
            "source_type": r.source_type,
            "target_id": r.target_id,
            "target_type": r.target_type,
            "relationship_type": r.relationship_type,
            "label": r.label,
            "weight": r.weight,
        }
        for r in relationships
    ]
