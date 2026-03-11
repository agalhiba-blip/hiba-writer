from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.database import get_db
from backend.models import Character
from backend.schemas import CharacterCreate, CharacterUpdate, CharacterOut
from typing import List
import os
import uuid
import base64

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads", "characters")

# Sur Vercel, pas de disque persistant → images stockées en base64
USE_FILE_STORAGE = not (os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))


@router.get("", response_model=List[CharacterOut])
async def list_characters(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Character)
        .where(Character.project_id == project_id)
        .order_by(Character.name)
    )
    return result.scalars().all()


@router.post("", response_model=CharacterOut, status_code=201)
async def create_character(data: CharacterCreate, db: AsyncSession = Depends(get_db)):
    character = Character(**data.model_dump())
    db.add(character)
    await db.commit()
    await db.refresh(character)
    return character


@router.get("/{character_id}", response_model=CharacterOut)
async def get_character(character_id: int, db: AsyncSession = Depends(get_db)):
    character = await db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Personnage introuvable")
    return character


@router.put("/{character_id}", response_model=CharacterOut)
async def update_character(character_id: int, data: CharacterUpdate, db: AsyncSession = Depends(get_db)):
    character = await db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Personnage introuvable")
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(character, key, value)
    await db.commit()
    await db.refresh(character)
    return character


@router.delete("/{character_id}", status_code=204)
async def delete_character(character_id: int, db: AsyncSession = Depends(get_db)):
    character = await db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Personnage introuvable")
    # Supprimer le fichier image si c'est un fichier local
    if USE_FILE_STORAGE and character.image_path and not character.image_path.startswith("data:"):
        old_path = os.path.join(UPLOADS_DIR, os.path.basename(character.image_path))
        if os.path.exists(old_path):
            os.remove(old_path)
    await db.delete(character)
    await db.commit()


@router.post("/{character_id}/image", response_model=CharacterOut)
async def upload_character_image(
    character_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    character = await db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Personnage introuvable")

    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Format d'image non supporté")

    content = await file.read()

    if USE_FILE_STORAGE:
        # Stocker en fichier (local)
        ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(UPLOADS_DIR, filename)
        os.makedirs(UPLOADS_DIR, exist_ok=True)

        import aiofiles
        async with aiofiles.open(filepath, "wb") as f:
            await f.write(content)

        # Supprimer l'ancienne image fichier
        if character.image_path and not character.image_path.startswith("data:"):
            old_path = os.path.join(UPLOADS_DIR, os.path.basename(character.image_path))
            if os.path.exists(old_path):
                os.remove(old_path)

        character.image_path = f"/uploads/characters/{filename}"
    else:
        # Stocker en base64 (Vercel / cloud)
        b64 = base64.b64encode(content).decode("utf-8")
        character.image_path = f"data:{file.content_type};base64,{b64}"

    await db.commit()
    await db.refresh(character)
    return character
