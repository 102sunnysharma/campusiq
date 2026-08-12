from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Category, Department, User
from app.core.dependencies import get_current_user, require_role
from app.core.exceptions import APIException
from app.schemas.campus import CategoryResponse, CategoryCreate, CategoryUpdate, CategoryListResponse

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.get("", response_model=CategoryListResponse)
def list_categories(
    department_id: Optional[UUID] = Query(default=None, description="Filter categories by department ID"),
    include_inactive: bool = Query(default=False, description="Include inactive categories"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Category).options(joinedload(Category.department))

    if department_id:
        query = query.filter(Category.department_id == department_id)

    if not include_inactive or current_user.role.name != "admin":
        query = query.filter(Category.is_active == True)

    categories = query.order_by(Category.name.asc()).all()

    items = []
    for cat in categories:
        res = CategoryResponse.model_validate(cat)
        if cat.department:
            res.department_name = cat.department.name
        items.append(res)

    return CategoryListResponse(items=items, total=len(items))


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    category = db.query(Category).options(joinedload(Category.department)).filter(Category.id == category_id).first()
    if not category:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="CATEGORY_NOT_FOUND",
            message=f"Category with ID '{category_id}' not found."
        )

    res = CategoryResponse.model_validate(category)
    if category.department:
        res.department_name = category.department.name
    return res


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    request: CategoryCreate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    dept = db.query(Department).filter(Department.id == request.department_id).first()
    if not dept:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="DEPARTMENT_NOT_FOUND",
            message=f"Associated department with ID '{request.department_id}' not found."
        )

    category = Category(
        name=request.name,
        description=request.description,
        department_id=request.department_id,
        is_active=True
    )
    db.add(category)
    db.commit()
    db.refresh(category)

    res = CategoryResponse.model_validate(category)
    res.department_name = dept.name
    return res


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: UUID,
    request: CategoryUpdate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    category = db.query(Category).options(joinedload(Category.department)).filter(Category.id == category_id).first()
    if not category:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="CATEGORY_NOT_FOUND",
            message=f"Category with ID '{category_id}' not found."
        )

    if request.name is not None:
        category.name = request.name
    if request.description is not None:
        category.description = request.description
    if request.department_id is not None:
        dept = db.query(Department).filter(Department.id == request.department_id).first()
        if not dept:
            raise APIException(
                status_code=status.HTTP_404_NOT_FOUND,
                code="DEPARTMENT_NOT_FOUND",
                message=f"Department '{request.department_id}' not found."
            )
        category.department_id = request.department_id

    db.commit()
    db.refresh(category)

    res = CategoryResponse.model_validate(category)
    if category.department:
        res.department_name = category.department.name
    return res


@router.patch("/{category_id}/deactivate", response_model=CategoryResponse)
def deactivate_category(
    category_id: UUID,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    category = db.query(Category).options(joinedload(Category.department)).filter(Category.id == category_id).first()
    if not category:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="CATEGORY_NOT_FOUND",
            message=f"Category with ID '{category_id}' not found."
        )

    category.is_active = False
    db.commit()
    db.refresh(category)

    res = CategoryResponse.model_validate(category)
    if category.department:
        res.department_name = category.department.name
    return res


@router.patch("/{category_id}/activate", response_model=CategoryResponse)
def activate_category(
    category_id: UUID,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    category = db.query(Category).options(joinedload(Category.department)).filter(Category.id == category_id).first()
    if not category:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="CATEGORY_NOT_FOUND",
            message=f"Category with ID '{category_id}' not found."
        )

    category.is_active = True
    db.commit()
    db.refresh(category)

    res = CategoryResponse.model_validate(category)
    if category.department:
        res.department_name = category.department.name
    return res
