"""
Pydantic Schemas — Data Import Module (Phase 9, Section 10 & 13)
"""

from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


class ImportPreviewResponse(BaseModel):
    import_id: uuid.UUID
    file_name: str
    data_type: str
    status: str
    total_records: int
    valid_records_count: int
    invalid_records_count: int
    sample_rows: List[Dict[str, Any]]
    errors: List[Dict[str, Any]]


class ImportConfirmResponse(BaseModel):
    id: uuid.UUID
    file_name: str
    data_type: str
    status: str
    total_records: int
    successful_records: int
    failed_records: int
    error_report: Optional[Dict[str, Any]] = None
    completed_at: Optional[datetime] = None
    message: str


class DataImportResponse(BaseModel):
    id: uuid.UUID
    uploaded_by: uuid.UUID
    uploader_name: Optional[str] = None
    uploader_email: Optional[str] = None
    file_name: str
    data_type: str
    status: str
    total_records: Optional[int] = None
    successful_records: Optional[int] = None
    failed_records: Optional[int] = None
    error_report: Optional[Dict[str, Any]] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedDataImportsResponse(BaseModel):
    items: List[DataImportResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
