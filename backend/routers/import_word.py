from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.database import get_db
from backend.models import Chapter, Project
from typing import Optional
import re

router = APIRouter()


def count_words(html_content: str) -> int:
    text = re.sub(r'<[^>]+>', ' ', html_content or "")
    words = text.split()
    return len(words)


@router.post("")
async def import_word(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    mode: str = Form("auto"),
    db: AsyncSession = Depends(get_db),
):
    """
    Importe un fichier .docx et crée des chapitres.
    Nécessite python-docx côté serveur pour une extraction propre.
    """
    if not file.filename.lower().endswith(('.docx', '.doc')):
        raise HTTPException(status_code=400, detail="Seuls les fichiers .docx sont supportés")

    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Roman introuvable")

    try:
        import docx
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="python-docx non installé. Utilisez l'import côté navigateur (mammoth.js)."
        )

    content = await file.read()
    import io
    doc = docx.Document(io.BytesIO(content))

    chapters_data = []
    current_title = file.filename.replace('.docx', '').replace('.doc', '')
    current_paras = []
    has_headings = False

    for para in doc.paragraphs:
        style_name = para.style.name.lower() if para.style else ''
        is_heading = 'heading 1' in style_name or 'heading 2' in style_name or \
                     'titre 1' in style_name or 'titre 2' in style_name

        if is_heading and mode == 'auto':
            has_headings = True
            if current_paras:
                chapters_data.append({'title': current_title, 'content': '\n'.join(current_paras)})
            current_title = para.text.strip() or f"Chapitre {len(chapters_data) + 1}"
            current_paras = []
        else:
            text = para.text.strip()
            if text:
                # Détecter le style (gras, italique)
                html_para = '<p>'
                for run in para.runs:
                    t = run.text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    if run.bold and run.italic:
                        t = f'<strong><em>{t}</em></strong>'
                    elif run.bold:
                        t = f'<strong>{t}</strong>'
                    elif run.italic:
                        t = f'<em>{t}</em>'
                    html_para += t
                html_para += '</p>'
                current_paras.append(html_para)

    if current_paras:
        chapters_data.append({'title': current_title, 'content': '\n'.join(current_paras)})

    if not chapters_data:
        raise HTTPException(status_code=400, detail="Aucun contenu trouvé dans le fichier")

    # Calculer le prochain order_index
    result = await db.execute(
        select(Chapter).where(Chapter.project_id == project_id).order_by(Chapter.order_index.desc())
    )
    last = result.scalars().first()
    next_index = (last.order_index + 1) if last else 0

    created = []
    for i, ch_data in enumerate(chapters_data):
        html_content = ch_data['content']
        chapter = Chapter(
            project_id=project_id,
            title=ch_data['title'][:255],
            content=html_content,
            order_index=next_index + i,
            word_count=count_words(html_content),
        )
        db.add(chapter)
        created.append(ch_data['title'])

    await db.commit()
    return {"created": len(created), "chapters": created}
