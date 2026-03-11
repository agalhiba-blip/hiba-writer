from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.database import get_db
from backend.models import Location
from backend.schemas import LocationCreate, LocationUpdate, LocationOut
from typing import List

router = APIRouter()


@router.get("", response_model=List[LocationOut])
async def list_locations(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Location)
        .where(Location.project_id == project_id)
        .order_by(Location.name)
    )
    return result.scalars().all()


@router.post("", response_model=LocationOut, status_code=201)
async def create_location(data: LocationCreate, db: AsyncSession = Depends(get_db)):
    location = Location(**data.model_dump())
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return location


@router.get("/{location_id}", response_model=LocationOut)
async def get_location(location_id: int, db: AsyncSession = Depends(get_db)):
    location = await db.get(Location, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Lieu introuvable")
    return location


@router.put("/{location_id}", response_model=LocationOut)
async def update_location(location_id: int, data: LocationUpdate, db: AsyncSession = Depends(get_db)):
    location = await db.get(Location, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Lieu introuvable")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(location, key, value)
    await db.commit()
    await db.refresh(location)
    return location


@router.delete("/{location_id}", status_code=204)
async def delete_location(location_id: int, db: AsyncSession = Depends(get_db)):
    location = await db.get(Location, location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Lieu introuvable")
    await db.delete(location)
    await db.commit()
