from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.database import get_db
from backend.models import Project, Chapter
from backend.schemas import ProjectCreate, ProjectUpdate, ProjectOut
from typing import List

router = APIRouter()


@router.get("", response_model=List[ProjectOut])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.updated_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(**data.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Roman introuvable")
    return project


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: int, data: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Roman introuvable")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Roman introuvable")
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/recalculate_words", response_model=ProjectOut)
async def recalculate_words(project_id: int, db: AsyncSession = Depends(get_db)):
    """Recalcule le nombre de mots total du roman."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Roman introuvable")
    result = await db.execute(
        select(func.sum(Chapter.word_count)).where(Chapter.project_id == project_id)
    )
    total = result.scalar() or 0
    project.word_count = total
    await db.commit()
    await db.refresh(project)
    return project
