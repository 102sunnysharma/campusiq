"""
Data Import Router — Phase 9 (Section 10 & 13)

Endpoints:
  POST /data-imports/upload              — Upload (.csv/.xlsx), parse, validate, return preview
  POST /data-imports/{id}/confirm        — Confirm import: commit valid rows, reject invalid, generate report
  GET  /data-imports                     — Paginated list of past data imports
  GET  /data-imports/{id}                — Detailed report of a data import run
  GET  /data-imports/templates/{type}    — Download sample CSV template for a data type
"""

import uuid
import logging
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, Query, UploadFile, File, Form, HTTPException, status, BackgroundTasks
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_role
from app.models import DataImport, User
from app.schemas.data_import import (
    ImportPreviewResponse,
    ImportConfirmResponse,
    DataImportResponse,
    PaginatedDataImportsResponse,
)
from app.services.import_service import (
    SUPPORTED_DATA_TYPES,
    parse_file_content,
    validate_rows_for_type,
    execute_import_commit,
    get_sample_csv_template,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/data-imports", tags=["Data Imports"])


# ─── POST /data-imports/upload ────────────────────────────────────────────────

@router.post("/upload", response_model=ImportPreviewResponse)
async def upload_and_preview_file(
    file: UploadFile = File(...),
    data_type: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    """
    Step 1 & 2: Upload file (.csv or .xlsx) and perform validation.
    Creates a data_imports row in 'preview_ready' status and returns a preview
    with row-level validation results before committing.
    """
    clean_type = data_type.strip().lower()
    if clean_type not in SUPPORTED_DATA_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_DATA_TYPE",
                "message": f"Unsupported data type '{data_type}'. Must be one of: {', '.join(SUPPORTED_DATA_TYPES)}",
            },
        )

    filename = file.filename or "upload.csv"
    if not (filename.lower().endswith(".csv") or filename.lower().endswith((".xlsx", ".xls"))):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_FILE_FORMAT",
                "message": "Only .csv and .xlsx files are supported for import.",
            },
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "EMPTY_FILE",
                "message": "The uploaded file is empty.",
            },
        )

    # Parse content
    try:
        raw_rows = parse_file_content(file_bytes, filename)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "FILE_PARSE_ERROR",
                "message": f"Failed to parse file: {str(exc)}",
            },
        )

    if not raw_rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "NO_DATA_ROWS",
                "message": "No data rows found in the uploaded file.",
            },
        )

    # Validate rows
    valid_rows, invalid_rows = validate_rows_for_type(db, clean_type, raw_rows)

    # Create tracked DataImport record in preview_ready state
    import_record = DataImport(
        id=uuid.uuid4(),
        uploaded_by=current_user.id,
        file_name=filename,
        data_type=clean_type,
        status="preview_ready",
        total_records=len(raw_rows),
        successful_records=len(valid_rows),
        failed_records=len(invalid_rows),
        error_report={
            "valid_data": valid_rows,
            "errors": invalid_rows,
        },
    )
    db.add(import_record)
    db.commit()
    db.refresh(import_record)

    # Build preview sample rows
    sample_rows = []
    # Up to 25 sample rows (combining valid and invalid for visual review)
    combined = []
    for r in valid_rows[:15]:
        combined.append({
            "row_number": r.get("__row_number__"),
            "status": "valid",
            "errors": [],
            "data": {k: v for k, v in r.items() if not k.startswith("__") and not k.endswith("_id")},
        })
    for inv in invalid_rows[:10]:
        combined.append({
            "row_number": inv.get("row"),
            "status": "invalid",
            "errors": inv.get("reasons", []),
            "data": inv.get("data", {}),
        })
    combined.sort(key=lambda x: x.get("row_number", 0))

    return ImportPreviewResponse(
        import_id=import_record.id,
        file_name=filename,
        data_type=clean_type,
        status="preview_ready",
        total_records=len(raw_rows),
        valid_records_count=len(valid_rows),
        invalid_records_count=len(invalid_rows),
        sample_rows=combined,
        errors=invalid_rows,
    )


# ─── POST /data-imports/{id}/confirm ──────────────────────────────────────────

@router.post("/{import_id}/confirm", response_model=ImportConfirmResponse)
def confirm_import(
    import_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    """
    Step 4 & 5: Commit valid rows to database, skip invalid rows with reasons,
    and generate the final import report.
    """
    import_record = db.query(DataImport).filter(DataImport.id == import_id).first()
    if not import_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "IMPORT_NOT_FOUND",
                "message": "The requested data import session was not found.",
            },
        )

    if import_record.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "ALREADY_COMPLETED",
                "message": "This data import has already been completed.",
            },
        )

    if import_record.status != "preview_ready":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "INVALID_IMPORT_STATUS",
                "message": f"Cannot confirm import with status '{import_record.status}'.",
            },
        )

    import_record.status = "importing"
    db.commit()

    try:
        successful, failed = execute_import_commit(
            db=db,
            import_record=import_record,
            background_tasks=background_tasks,
            user_id=current_user.id,
        )
        return ImportConfirmResponse(
            id=import_record.id,
            file_name=import_record.file_name,
            data_type=import_record.data_type,
            status=import_record.status,
            total_records=import_record.total_records or 0,
            successful_records=successful,
            failed_records=failed,
            error_report=import_record.error_report,
            completed_at=import_record.completed_at,
            message=f"Import completed. {successful} records imported successfully, {failed} rejected.",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "IMPORT_EXECUTION_FAILED",
                "message": f"Failed to execute import: {str(exc)}",
            },
        )


# ─── GET /data-imports ────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedDataImportsResponse)
def list_data_imports(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    data_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    """
    Paginated list of past import runs (Section 14.3 standard format).
    """
    q = db.query(DataImport).join(User, User.id == DataImport.uploaded_by)

    if data_type:
        q = q.filter(DataImport.data_type == data_type.lower())
    if status:
        q = q.filter(DataImport.status == status.lower())

    total = q.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    records = (
        q.order_by(DataImport.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    for r in records:
        items.append(
            DataImportResponse(
                id=r.id,
                uploaded_by=r.uploaded_by,
                uploader_name=r.uploader.full_name if r.uploader else None,
                uploader_email=r.uploader.email if r.uploader else None,
                file_name=r.file_name,
                data_type=r.data_type,
                status=r.status,
                total_records=r.total_records,
                successful_records=r.successful_records,
                failed_records=r.failed_records,
                error_report=r.error_report,
                created_at=r.created_at,
                completed_at=r.completed_at,
            )
        )

    return PaginatedDataImportsResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


# ─── GET /data-imports/{id} ───────────────────────────────────────────────────

@router.get("/{import_id}", response_model=DataImportResponse)
def get_data_import_detail(
    import_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    """
    Detailed status and full error report for an import run.
    """
    r = db.query(DataImport).filter(DataImport.id == import_id).first()
    if not r:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "IMPORT_NOT_FOUND",
                "message": "Data import run not found.",
            },
        )

    return DataImportResponse(
        id=r.id,
        uploaded_by=r.uploaded_by,
        uploader_name=r.uploader.full_name if r.uploader else None,
        uploader_email=r.uploader.email if r.uploader else None,
        file_name=r.file_name,
        data_type=r.data_type,
        status=r.status,
        total_records=r.total_records,
        successful_records=r.successful_records,
        failed_records=r.failed_records,
        error_report=r.error_report,
        created_at=r.created_at,
        completed_at=r.completed_at,
    )


# ─── GET /data-imports/templates/{data_type} ──────────────────────────────────

@router.get("/templates/{data_type}")
def download_csv_template(
    data_type: str,
    current_user: User = Depends(require_role(["admin"])),
):
    """
    Returns a downloadable CSV template with standard headers and sample data.
    """
    clean_type = data_type.strip().lower()
    if clean_type not in SUPPORTED_DATA_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "INVALID_DATA_TYPE",
                "message": f"Unsupported data type '{data_type}'. Must be one of: {', '.join(SUPPORTED_DATA_TYPES)}",
            },
        )

    csv_content = get_sample_csv_template(clean_type)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="template_{clean_type}.csv"'
        },
    )
