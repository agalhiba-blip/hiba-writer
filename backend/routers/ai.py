from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.database import get_db
from backend.models import Setting
from backend.schemas import AIRequest, AIConfigUpdate, TranslateRequest
from backend.services import ai_service
from typing import Optional
import json

router = APIRouter()


async def resolve_api_config(
    db: AsyncSession,
    x_api_key: Optional[str] = None,
    x_ai_model: Optional[str] = None,
) -> tuple[str, str]:
    """Retourne (api_key, model) depuis le header ou la DB selon disponibilité."""
    if x_api_key and x_api_key.strip():
        model = x_ai_model or "claude-sonnet-4-6"
        return x_api_key.strip(), model
    return await ai_service.get_api_config(db)


@router.get("/status")
async def ai_status(
    x_api_key: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Vérifie si la clé API est configurée (header ou DB)."""
    if x_api_key and x_api_key.strip():
        return {"configured": True, "model": "claude-sonnet-4-6", "source": "header"}
    result = await db.execute(select(Setting).where(Setting.key == "anthropic_api_key"))
    setting = result.scalar_one_or_none()
    has_key = bool(setting and setting.value and setting.value.strip())
    result_model = await db.execute(select(Setting).where(Setting.key == "claude_model"))
    model_setting = result_model.scalar_one_or_none()
    return {
        "configured": has_key,
        "model": model_setting.value if model_setting else "claude-sonnet-4-6",
        "source": "db",
    }


@router.put("/config")
async def update_ai_config(data: AIConfigUpdate, db: AsyncSession = Depends(get_db)):
    """Sauvegarde la clé API et le modèle en DB (backup)."""
    for key, value in [("anthropic_api_key", data.anthropic_api_key), ("claude_model", data.claude_model)]:
        result = await db.execute(select(Setting).where(Setting.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            db.add(Setting(key=key, value=value))
    await db.commit()
    return {"status": "ok"}


STREAM_SYSTEMS = {
    "improve": (
        "Tu es un assistant de rédaction littéraire expert en français. "
        "Améliore le style, le rythme et la fluidité du texte proposé, "
        "sans en changer le sens ni les personnages. Réponds uniquement avec le texte amélioré."
    ),
    "proofread": (
        "Tu es un correcteur littéraire expert en français. "
        "Corrige les fautes d'orthographe, de grammaire, de syntaxe et de ponctuation. "
        "Signale les corrections entre [crochets] et fournis le texte corrigé complet."
    ),
    "summarize": (
        "Tu es un assistant littéraire. Résume le passage fourni en 2-3 phrases claires, "
        "en identifiant les événements clés, les personnages impliqués et les enjeux."
    ),
    "continue": (
        "Tu es un écrivain créatif expert en français. "
        "Propose une continuation naturelle et cohérente du passage fourni, "
        "en respectant le ton, le style et les personnages. "
        "Écris environ 150-200 mots de continuation."
    ),
    "review": (
        "Tu es un éditeur littéraire expert en langue française. "
        "Effectue une relecture complète et approfondie du texte fourni en corrigeant : "
        "1) Les fautes de syntaxe et de construction grammaticale "
        "2) Les incohérences de temps, de point de vue ou de logique narrative "
        "3) Les tournures de phrases maladroites ou répétitives "
        "4) Le rythme et la fluidité des phrases "
        "5) Les répétitions de mots et les tics de style "
        "Présente d'abord un bref rapport des problèmes identifiés (bullet points), "
        "puis fournis le texte intégralement corrigé et amélioré. "
        "Conserve le sens, les personnages et l'intention de l'auteur."
    ),
}

# max_tokens adapté à chaque action pour plus de rapidité
STREAM_MAX_TOKENS = {
    "improve": 2048, "proofread": 2048, "review": 3000,
    "continue": 512, "summarize": 256,
}


@router.post("/stream")
async def stream_ai(
    request: AIRequest,
    action: str = "improve",
    x_api_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Endpoint streaming SSE — renvoie les tokens au fur et à mesure."""
    if action not in STREAM_SYSTEMS:
        raise HTTPException(status_code=400, detail=f"Action inconnue : {action}")
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide")

    api_key, model = await resolve_api_config(db, x_api_key, x_ai_model)
    if not api_key:
        raise HTTPException(status_code=403, detail="Clé API non configurée")

    system = STREAM_SYSTEMS[action]
    max_tokens = STREAM_MAX_TOKENS.get(action, 2048)
    prompt = request.text
    if request.context:
        prompt = f"Contexte du roman : {request.context}\n\n{prompt}"

    async def generate():
        full_text = []
        try:
            async for chunk in ai_service.stream_claude(prompt, system, api_key, model, max_tokens):
                full_text.append(chunk)
                # Format SSE : data: <json>\n\n
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return
        yield "data: [DONE]\n\n"
        # Sauvegarder l'historique en arrière-plan
        try:
            await ai_service.save_history(
                db, action, request.text, "".join(full_text),
                request.project_id, request.chapter_id
            )
        except Exception:
            pass

    return StreamingResponse(generate(), media_type="text/event-stream",
                              headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/improve")
async def improve(
    request: AIRequest,
    x_api_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide")
    api_key, model = await resolve_api_config(db, x_api_key, x_ai_model)
    if not api_key:
        raise HTTPException(status_code=403, detail="Clé API non configurée")
    try:
        result = await ai_service.improve_text(
            request.text, request.context or "", db,
            request.project_id, request.chapter_id, api_key, model
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")


@router.post("/proofread")
async def proofread(
    request: AIRequest,
    x_api_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide")
    api_key, model = await resolve_api_config(db, x_api_key, x_ai_model)
    if not api_key:
        raise HTTPException(status_code=403, detail="Clé API non configurée")
    try:
        result = await ai_service.proofread_text(
            request.text, request.context or "", db,
            request.project_id, request.chapter_id, api_key, model
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")


@router.post("/summarize")
async def summarize(
    request: AIRequest,
    x_api_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide")
    api_key, model = await resolve_api_config(db, x_api_key, x_ai_model)
    if not api_key:
        raise HTTPException(status_code=403, detail="Clé API non configurée")
    try:
        result = await ai_service.summarize_text(
            request.text, request.context or "", db,
            request.project_id, request.chapter_id, api_key, model
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")


@router.post("/review")
async def review(
    request: AIRequest,
    x_api_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide")
    api_key, model = await resolve_api_config(db, x_api_key, x_ai_model)
    if not api_key:
        raise HTTPException(status_code=403, detail="Clé API non configurée")
    try:
        result = await ai_service.review_text(
            request.text, request.context or "", db,
            request.project_id, request.chapter_id, api_key, model
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")


@router.post("/translate")
async def translate(
    request: TranslateRequest,
    x_api_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide")
    allowed = {"en", "ar", "ja", "zh"}
    if request.language not in allowed:
        raise HTTPException(status_code=400, detail=f"Langue non supportée : {request.language}")
    api_key, model = await resolve_api_config(db, x_api_key, x_ai_model)
    if not api_key:
        raise HTTPException(status_code=403, detail="Clé API non configurée")
    try:
        result = await ai_service.translate_text(
            request.text, request.language, db,
            request.project_id, request.chapter_id, api_key, model
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur traduction : {str(e)}")


@router.post("/continue")
async def continue_writing(
    request: AIRequest,
    x_api_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Texte vide")
    api_key, model = await resolve_api_config(db, x_api_key, x_ai_model)
    if not api_key:
        raise HTTPException(status_code=403, detail="Clé API non configurée")
    try:
        result = await ai_service.continue_text(
            request.text, request.context or "", db,
            request.project_id, request.chapter_id, api_key, model
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")
