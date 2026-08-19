from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db, AuthenticatedUser
from backend.schemas.product import ReviewActionInput

from backend.services.product_service import process_human_review_action

router = APIRouter()


@router.post("/{review_id}/action")
def execute_review_action(
    review_id: int,
    action_input: ReviewActionInput,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    if action_input.action.strip().lower() not in ("approved", "rejected", "edited"):
        raise HTTPException(status_code=422, detail=f"Unsupported review action: {action_input.action}. Use approve, reject, or edit.")

    try:
        res = process_human_review_action(
            db=db,
            review_id=review_id,
            action=action_input.action.lower(),
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
