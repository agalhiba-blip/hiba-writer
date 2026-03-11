from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.database import get_db
from backend.models import Chapter, Project
from backend.schemas import ChapterCreate, ChapterUpdate, ChapterOut, ChapterReorder
from typing import List
import re

router = APIRouter()


def count_words(html_content: str) -> int:
    """Compte les mots en supprimant les balises HTML."""
    text = re.sub(r'<[^>]+>', ' ', html_content or "")
    words = text.split()
    return len(words)


@router.get("", response_model=List[ChapterOut])
async def list_chapters(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Chapter)
        .where(Chapter.project_id == project_id)
        .order_by(Chapter.order_index)
    )
    return result.scalars().all()


@router.post("", response_model=ChapterOut, status_code=201)
async def create_chapter(data: ChapterCreate, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, data.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Roman introuvable")
    # Calculer le prochain order_index
    result = await db.execute(
        select(Chapter).where(Chapter.project_id == data.project_id).order_by(Chapter.order_index.desc())
    )
    last = result.scalars().first()
    next_index = (last.order_index + 1) if last else 0

    chapter = Chapter(**data.model_dump(), order_index=next_index)
    chapter.word_count = count_words(data.content)
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return chapter


@router.get("/{chapter_id}", response_model=ChapterOut)
async def get_chapter(chapter_id: int, db: AsyncSession = Depends(get_db)):
    chapter = await db.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapitre introuvable")
    return chapter


@router.put("/{chapter_id}", response_model=ChapterOut)
async def update_chapter(chapter_id: int, data: ChapterUpdate, db: AsyncSession = Depends(get_db)):
    chapter = await db.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapitre introuvable")
    update_data = data.model_dump(exclude_none=True)
    if "content" in update_data:
        update_data["word_count"] = count_words(update_data["content"])
    for key, value in update_data.items():
        setattr(chapter, key, value)
    await db.commit()
    # Recalculer le total du roman
    from sqlalchemy import func
    result = await db.execute(
        select(func.sum(Chapter.word_count)).where(Chapter.project_id == chapter.project_id)
    )
    total = result.scalar() or 0
    project = await db.get(Project, chapter.project_id)
    if project:
        project.word_count = total
        await db.commit()
    await db.refresh(chapter)
    return chapter


@router.delete("/{chapter_id}", status_code=204)
async def delete_chapter(chapter_id: int, db: AsyncSession = Depends(get_db)):
    chapter = await db.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapitre introuvable")
    await db.delete(chapter)
    await db.commit()


@router.patch("/reorder")
async def reorder_chapters(data: ChapterReorder, db: AsyncSession = Depends(get_db)):
    """Met à jour l'ordre des chapitres après drag & drop."""
    for item in data.items:
        chapter = await db.get(Chapter, item["id"])
        if chapter:
            chapter.order_index = item["order_index"]
    await db.commit()
    return {"status": "ok"}
