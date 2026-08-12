from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.models import TransportRoute, TransportStop, User
from app.core.dependencies import get_current_user, require_role
from app.core.exceptions import APIException
from app.schemas.campus import (
    TransportRouteResponse, TransportRouteCreate, TransportRouteUpdate, TransportRouteListResponse,
    TransportStopResponse, TransportStopCreate, TransportStopUpdate
)

router = APIRouter(prefix="/transport", tags=["Transport"])

@router.get("/routes", response_model=TransportRouteListResponse)
def list_transport_routes(
    include_inactive: bool = Query(default=False, description="Include inactive transport routes"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(TransportRoute).options(
        selectinload(TransportRoute.stops)
    )

    if not include_inactive or current_user.role.name != "admin":
        query = query.filter(TransportRoute.is_active == True)

    routes = query.order_by(TransportRoute.route_number.asc()).all()

    items = []
    for r in routes:
        # Sort stops by sequence
        r.stops.sort(key=lambda s: s.sequence)
        items.append(TransportRouteResponse.model_validate(r))

    return TransportRouteListResponse(items=items, total=len(items))


@router.get("/routes/{route_id}", response_model=TransportRouteResponse)
def get_transport_route(
    route_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    route = (
        db.query(TransportRoute)
        .options(selectinload(TransportRoute.stops))
        .filter(TransportRoute.id == route_id)
        .first()
    )

    if not route:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="ROUTE_NOT_FOUND",
            message=f"Transport route with ID '{route_id}' not found."
        )

    route.stops.sort(key=lambda s: s.sequence)
    return TransportRouteResponse.model_validate(route)


@router.post("/routes", response_model=TransportRouteResponse, status_code=status.HTTP_201_CREATED)
def create_transport_route(
    request: TransportRouteCreate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    existing = db.query(TransportRoute).filter(TransportRoute.route_number == request.route_number).first()
    if existing:
        raise APIException(
            status_code=status.HTTP_409_CONFLICT,
            code="ROUTE_ALREADY_EXISTS",
            message=f"Route with number '{request.route_number}' already exists."
        )

    route = TransportRoute(
        route_name=request.route_name,
        route_number=request.route_number,
        description=request.description,
        is_active=True
    )
    db.add(route)
    db.flush()

    # Add initial stops if provided
    if request.stops:
        for s in request.stops:
            stop = TransportStop(
                route_id=route.id,
                name=s.name,
                latitude=s.latitude,
                longitude=s.longitude,
                sequence=s.sequence
            )
            db.add(stop)

    db.commit()
    db.refresh(route)

    # Reload with stops
    full_route = (
        db.query(TransportRoute)
        .options(selectinload(TransportRoute.stops))
        .filter(TransportRoute.id == route.id)
        .first()
    )
    full_route.stops.sort(key=lambda s: s.sequence)
    return TransportRouteResponse.model_validate(full_route)


@router.put("/routes/{route_id}", response_model=TransportRouteResponse)
def update_transport_route(
    route_id: UUID,
    request: TransportRouteUpdate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    route = (
        db.query(TransportRoute)
        .options(selectinload(TransportRoute.stops))
        .filter(TransportRoute.id == route_id)
        .first()
    )
    if not route:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="ROUTE_NOT_FOUND",
            message=f"Transport route with ID '{route_id}' not found."
        )

    if request.route_name is not None:
        route.route_name = request.route_name
    if request.route_number is not None:
        route.route_number = request.route_number
    if request.description is not None:
        route.description = request.description
    if request.is_active is not None:
        route.is_active = request.is_active

    db.commit()
    db.refresh(route)
    route.stops.sort(key=lambda s: s.sequence)
    return TransportRouteResponse.model_validate(route)


@router.post("/routes/{route_id}/stops", response_model=TransportStopResponse, status_code=status.HTTP_201_CREATED)
def add_transport_stop(
    route_id: UUID,
    request: TransportStopCreate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    route = db.query(TransportRoute).filter(TransportRoute.id == route_id).first()
    if not route:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="ROUTE_NOT_FOUND",
            message=f"Transport route '{route_id}' not found."
        )

    stop = TransportStop(
        route_id=route_id,
        name=request.name,
        latitude=request.latitude,
        longitude=request.longitude,
        sequence=request.sequence
    )
    db.add(stop)
    db.commit()
    db.refresh(stop)

    return TransportStopResponse.model_validate(stop)


@router.put("/stops/{stop_id}", response_model=TransportStopResponse)
def update_transport_stop(
    stop_id: UUID,
    request: TransportStopUpdate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    stop = db.query(TransportStop).filter(TransportStop.id == stop_id).first()
    if not stop:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STOP_NOT_FOUND",
            message=f"Transport stop '{stop_id}' not found."
        )

    if request.name is not None:
        stop.name = request.name
    if request.latitude is not None:
        stop.latitude = request.latitude
    if request.longitude is not None:
        stop.longitude = request.longitude
    if request.sequence is not None:
        stop.sequence = request.sequence

    db.commit()
    db.refresh(stop)

    return TransportStopResponse.model_validate(stop)


@router.delete("/stops/{stop_id}")
def delete_transport_stop(
    stop_id: UUID,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    stop = db.query(TransportStop).filter(TransportStop.id == stop_id).first()
    if not stop:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STOP_NOT_FOUND",
            message=f"Transport stop '{stop_id}' not found."
        )

    db.delete(stop)
    db.commit()

    return {
        "success": True,
        "message": f"Transport stop '{stop.name}' removed successfully."
    }
