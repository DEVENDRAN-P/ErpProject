from typing import Any


def create_review_task(product_id: int, issue: str) -> dict[str, Any]:
    return {
        "product_id": product_id,
        "issue": issue,
        "task": "Review task placeholder",
    }
