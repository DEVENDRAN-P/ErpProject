from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db, AuthenticatedUser
from backend.schemas.product import ProductCreate, ProductRead
from backend.services.product_service import create_product

router = APIRouter()


@router.post("/ingest", response_model=ProductRead)
def ingest_product(product_data: ProductCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> ProductRead:
    if not product_data.name:
        raise HTTPException(status_code=400, detail="Product name is required.")
    product = create_product(db=db, product_data=product_data, created_by=current_user.email)
    return product