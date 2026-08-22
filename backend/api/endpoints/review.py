from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db, AuthenticatedUser
from backend.schemas.product import ReviewActionInput
from backend.models.product import ReviewItem

from backend.services.product_service import process_human_review_action

router = APIRouter()


@router.post("/{review_id}/action")
def execute_review_action(
    review_id: int,
    action_input: ReviewActionInput,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    action_lower = action_input.action.strip().lower()
    # Normalize to past tense forms accepted by process_human_review_action
    ACTION_NORMALIZE = {"approve": "approved", "reject": "rejected", "edit": "edited"}
    normalized_action = ACTION_NORMALIZE.get(action_lower, action_lower)

    if normalized_action not in ("approved", "rejected", "edited"):
        raise HTTPException(status_code=422, detail=f"Unsupported review action: {action_input.action}. Use approve, reject, or edit.")

    # Verify the review item belongs to the current user's product
    review_item = db.query(ReviewItem).filter(ReviewItem.id == review_id).first()
    if not review_item:
        raise HTTPException(status_code=404, detail="Review item not found.")
    from backend.models.product import Product
    product = db.query(Product).filter(Product.id == review_item.product_id, Product.created_by == current_user.email).first()
    if not product:
        raise HTTPException(status_code=403, detail="Not authorized to review this item.")

    try:
        res = process_human_review_action(
            db=db,
            review_id=review_id,
            action=normalized_action,
            edited_value=action_input.edited_value,
            comment=action_input.comment,
            reviewer=action_input.reviewer or (current_user.email if current_user else None),
        )
        return {
            "message": f"Review item successfully updated with action '{action_input.action}'.",
            "data": res,
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process review action: {str(e)}")
