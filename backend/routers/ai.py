from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.database import get_db
from backend.models import Setting
from backend.schemas import AIRequest, AIConfigUpdate
from backend.services import ai_service

router = APIRouter()


@router.get("/status")
async def ai_status(db: AsyncSession = Depends(get_db)):
    """Vérifie si la clé API est configurée."""
    result = await db.execute(select(Setting).where(Setting.key == "anthropic_api_key"))
    setting = result.scalar_one_or_none()
    has_key = bool(setting and setting.value and setting.value.strip())
    result_model = await db.execute(select(Setting).where(Setting.key == "claude_model"))
    model_setting = result_model.scalar_one_or_none()
    return {
        "configured": has_key,
        "model": model_setting.value if model_setting else "claude-sonnet-4-6",
    }


@router.put("/config")
async def update_ai_config(data: AIConfigUpdate, db: AsyncSession = Depends(get_db)):
    """Sauvegarde la clé API et le modèle."""
    for key, value in [("anthropic_api_key", data.anthropic_api_key), ("claude_model", data.claude_model)]:
        result = await db.execute(select(Setting).where(Setting.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            db.add(Setting(key=key, value=value))
    await db.commit()
    return {"status": "ok"}


@router.post("/improve")
async def improve(request: AIRequest, db: AsyncSession = Depends(get_db)):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide")
    api_key, _ = await ai_service.get_api_config(db)
    if not api_key:
        raise HTTPException(status_code=403, detail="Clé API non configurée")
    try:
        result = await ai_service.improve_text(
            request.text, request.context or "",
            db, request.project_id, request.chapter_id
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")


@router.post("/proofread")
async def proofread(request: AIRequest, db: AsyncSession = Depends(get_db)):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide")
    api_key, _ = await ai_service.get_api_config(db)
    if not api_key:
        raise HTTPException(status_code=403, detail="Clé API non configurée")
    try:
        result = await ai_service.proofread_text(
            request.text, request.context or "",
            db, request.project_id, request.chapter_id
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")


@router.post("/summarize")
async def summarize(request: AIRequest, db: AsyncSession = Depends(get_db)):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide")
    api_key, _ = await ai_service.get_api_config(db)
    if not api_key:
        raise HTTPException(status_code=403, detail="Clé API non configurée")
    try:
        result = await ai_service.summarize_text(
            request.text, request.context or "",
            db, request.project_id, request.chapter_id
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")


@router.post("/review")
async def review(request: AIRequest, db: AsyncSession = Depends(get_db)):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide")
    api_key, _ = await ai_service.get_api_config(db)
    if not api_key:
        raise HTTPException(status_code=403, detail="Clé API non configurée")
    try:
        result = await ai_service.review_text(
            request.text, request.context or "",
            db, request.project_id, request.chapter_id
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")


@router.post("/continue")
async def continue_writing(request: AIRequest, db: AsyncSession = Depends(get_db)):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide")
    api_key, _ = await ai_service.get_api_config(db)
    if not api_key:
        raise HTTPException(status_code=403, detail="Clé API non configurée")
    try:
        result = await ai_service.continue_text(
            request.text, request.context or "",
            db, request.project_id, request.chapter_id
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")
