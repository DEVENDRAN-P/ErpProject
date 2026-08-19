from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, Any

from backend.api.dependencies import get_current_user, get_db
from backend.services.pipeline_service import run_product_pipeline, validate_input_file
from backend.evaluation import run_evaluation, load_ground_truth_dataset

router = APIRouter()


@router.post("/workflow/process")
def process_workflow(
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
    url: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    if file is None and not text and not url:
        raise HTTPException(status_code=400, detail="Please provide a file, text, or URL for processing.")

    filename = file.filename if file else None
    contents = file.file.read() if file else None

    # Basic validation: file size and allowed extensions
    if file and filename:
        allowed_exts = ("pdf", "csv", "txt", "png", "jpg", "jpeg", "webp")
        ext = filename.lower().split(".")[-1] if "." in filename else ""
        if ext not in allowed_exts:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")
        max_size_bytes = 10 * 1024 * 1024  # 10 MB limit
        if contents and len(contents) > max_size_bytes:
            raise HTTPException(status_code=413, detail="Uploaded file exceeds the maximum allowed size of 10 MB.")

    # Basic URL validation before handing off to the pipeline
    if url and not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=422, detail="Invalid URL. Must start with http:// or https://.")

    # Pass DB and the current user so pipeline can persist the ProductTwin
    result = run_product_pipeline(db=db, file=contents, filename=filename, text=text, url=url, created_by=(current_user.email if current_user else None))

    if result.get("error"):
        raise HTTPException(status_code=422, detail=result["error"])

    return result


@router.post("/evaluation/run")
def evaluation_run(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Run Step 6 ground truth evaluation against the 200-item dataset."""
    filepath = "Unilog-Sample_200_Items-Input-vs-Output.xlsx"
    try:
        report = run_evaluation(filepath)
        return {
            "status": "completed",
            "dataset": report["dataset"],
            "rows_evaluated": report["rows_evaluated"],
            "overall_accuracy": report["overall_accuracy"],
            "manufacturer_accuracy": report["manufacturer_accuracy"],
            "brand_accuracy": report["brand_accuracy"],
            "classification_accuracy": report["classification_accuracy"],
            "attribute_accuracy": report["attribute_accuracy"],
            "lov_compliance": report["lov_compliance"],
            "uom_compliance": report["uom_compliance"],
            "character_limit_compliance": report["character_limit_compliance"],
            "verified_value_rate": report["verified_value_rate"],
            "missing_detection_rate": report["missing_detection_rate"],
            "human_review_rate": report["human_review_rate"],
            "failed_rows_count": len(report["failed_rows"]),
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Evaluation dataset not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/evaluation/dataset")
def evaluation_dataset() -> dict[str, Any]:
    """Load the ground-truth dataset structure."""
    try:
        input_rows, ground_truth_rows = load_ground_truth_dataset(
            "Unilog-Sample_200_Items-Input-vs-Output.xlsx"
        )
        return {
            "status": "loaded",
            "input_rows": len(input_rows),
            "ground_truth_rows": len(ground_truth_rows),
            "input_sheet_columns": list(
                input_rows[0].keys() if input_rows else []
            ),
            "delivery_sheet_columns": list(
                ground_truth_rows[0].keys() if ground_truth_rows else []
            ),
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Evaluation dataset not found")

