from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.database import get_db
from backend.models import Note
from backend.schemas import NoteCreate, NoteUpdate, NoteOut
from typing import List

router = APIRouter()


@router.get("", response_model=List[NoteOut])
async def list_notes(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Note)
        .where(Note.project_id == project_id)
        .order_by(Note.pinned.desc(), Note.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=NoteOut, status_code=201)
async def create_note(data: NoteCreate, db: AsyncSession = Depends(get_db)):
    note = Note(**data.model_dump())
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.get("/{note_id}", response_model=NoteOut)
async def get_note(note_id: int, db: AsyncSession = Depends(get_db)):
    note = await db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    return note


@router.put("/{note_id}", response_model=NoteOut)
async def update_note(note_id: int, data: NoteUpdate, db: AsyncSession = Depends(get_db)):
    note = await db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(note, key, value)
    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=204)
async def delete_note(note_id: int, db: AsyncSession = Depends(get_db)):
    note = await db.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note introuvable")
    await db.delete(note)
    await db.commit()
