from typing import Any


def export_commerce_json(product_data: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "commerce_export",
        "data": product_data,
        "format": "json",
        "notes": "Commerce export placeholder",
    }
