import anthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.models import Setting, AIHistory


async def get_api_config(db: AsyncSession) -> tuple[str, str]:
    """Récupère la clé API et le modèle depuis la base de données."""
    result = await db.execute(
        select(Setting).where(Setting.key.in_(["anthropic_api_key", "claude_model"]))
    )
    settings = {s.key: s.value for s in result.scalars().all()}
    api_key = settings.get("anthropic_api_key", "")
    model = settings.get("claude_model", "claude-sonnet-4-6")
    return api_key, model


async def call_claude(prompt: str, system: str, api_key: str, model: str) -> str:
    """Appelle l'API Claude et retourne la réponse."""
    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model=model,
        max_tokens=2048,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


async def improve_text(text: str, context: str, db: AsyncSession, project_id: int = None, chapter_id: int = None) -> str:
    api_key, model = await get_api_config(db)
    system = (
        "Tu es un assistant de rédaction littéraire expert en français. "
        "Améliore le style, le rythme et la fluidité du texte proposé, "
        "sans en changer le sens ni les personnages. Réponds uniquement avec le texte amélioré."
    )
    prompt = f"Améliore stylistiquement ce passage :\n\n{text}"
    if context:
        prompt = f"Contexte du roman : {context}\n\n{prompt}"
    result = await call_claude(prompt, system, api_key, model)
    await save_history(db, "improve", text, result, project_id, chapter_id)
    return result


async def proofread_text(text: str, context: str, db: AsyncSession, project_id: int = None, chapter_id: int = None) -> str:
    api_key, model = await get_api_config(db)
    system = (
        "Tu es un correcteur littéraire expert en français. "
        "Corrige les fautes d'orthographe, de grammaire, de syntaxe et de ponctuation. "
        "Signale les corrections entre [crochets] et fournis le texte corrigé complet."
    )
    prompt = f"Relis et corrige ce texte :\n\n{text}"
    result = await call_claude(prompt, system, api_key, model)
    await save_history(db, "proofread", text, result, project_id, chapter_id)
    return result


async def summarize_text(text: str, context: str, db: AsyncSession, project_id: int = None, chapter_id: int = None) -> str:
    api_key, model = await get_api_config(db)
    system = (
        "Tu es un assistant littéraire. Résume le passage fourni en 2-3 phrases claires, "
        "en identifiant les événements clés, les personnages impliqués et les enjeux."
    )
    prompt = f"Résume ce passage :\n\n{text}"
    result = await call_claude(prompt, system, api_key, model)
    await save_history(db, "summarize", text, result, project_id, chapter_id)
    return result


async def continue_text(text: str, context: str, db: AsyncSession, project_id: int = None, chapter_id: int = None) -> str:
    api_key, model = await get_api_config(db)
    system = (
        "Tu es un écrivain créatif expert en français. "
        "Propose une continuation naturelle et cohérente du passage fourni, "
        "en respectant le ton, le style et les personnages. "
        "Écris environ 150-200 mots de continuation."
    )
    prompt = f"Continue naturellement ce passage :\n\n{text}"
    if context:
        prompt = f"Contexte du roman : {context}\n\n{prompt}"
    result = await call_claude(prompt, system, api_key, model)
    await save_history(db, "continue", text, result, project_id, chapter_id)
    return result


async def review_text(text: str, context: str, db: AsyncSession, project_id: int = None, chapter_id: int = None) -> str:
    """Relecture complète : syntaxe, cohérence, tournures de phrases."""
    api_key, model = await get_api_config(db)
    system = (
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
    )
    prompt = f"Effectue une relecture complète de ce texte :\n\n{text}"
    if context:
        prompt = f"Contexte du roman : {context}\n\n{prompt}"
    result = await call_claude(prompt, system, api_key, model)
    await save_history(db, "review", text, result, project_id, chapter_id)
    return result


async def save_history(db: AsyncSession, action_type: str, input_text: str, output_text: str, project_id: int = None, chapter_id: int = None):
    history = AIHistory(
        project_id=project_id,
        chapter_id=chapter_id,
        action_type=action_type,
        input_text=input_text[:2000],
        output_text=output_text[:5000],
    )
    db.add(history)
    await db.commit()
