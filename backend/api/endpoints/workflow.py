from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import Any

from backend.api.dependencies import get_current_user, get_db
from backend.services.pipeline_service import run_product_pipeline

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
