import re
import io


def html_to_text(html: str) -> str:
    """Convertit HTML en texte propre."""
    html = re.sub(r'<br\s*/?>', '\n', html)
    html = re.sub(r'</p>', '\n\n', html)
    html = re.sub(r'<[^>]+>', '', html)
    return html.strip()


def generate_novel_pdf(project: dict, chapters: list) -> bytes:
    """Génère un PDF du roman et retourne les bytes."""
    from xhtml2pdf import pisa

    cover_color = project.get("cover_color", "#727B57")
    title = project.get("title", "Mon Roman")
    author = project.get("author", "")
    subtitle = project.get("subtitle", "")

    chapters_html = ""
    for i, chapter in enumerate(chapters):
        content = chapter.get("content", "")
        chapters_html += f"""
        <div class="chapter">
            <h2 class="chapter-title">Chapitre {i + 1} — {chapter.get('title', '')}</h2>
            <div class="chapter-content">{content}</div>
        </div>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <style>
            @page {{
                size: A4;
                margin: 2.5cm 3cm;
                @bottom-center {{
                    content: counter(page);
                    font-family: Georgia, serif;
                    font-size: 10pt;
                    color: #666;
                }}
            }}
            body {{
                font-family: Georgia, "Times New Roman", serif;
                font-size: 12pt;
                line-height: 1.8;
                color: #1a1a1a;
                text-align: justify;
            }}
            .cover {{
                page-break-after: always;
                text-align: center;
                padding-top: 6cm;
            }}
            .cover-accent {{
                width: 60px;
                height: 4px;
                background-color: {cover_color};
                margin: 20px auto;
            }}
            .cover-title {{
                font-size: 28pt;
                font-weight: bold;
                color: #1a1a1a;
                margin-bottom: 0.3cm;
                letter-spacing: 1px;
            }}
            .cover-subtitle {{
                font-size: 14pt;
                color: #555;
                font-style: italic;
                margin-bottom: 0.5cm;
            }}
            .cover-author {{
                font-size: 13pt;
                color: #333;
                margin-top: 2cm;
                letter-spacing: 2px;
                text-transform: uppercase;
            }}
            .chapter {{
                page-break-before: always;
            }}
            .chapter:first-child {{
                page-break-before: avoid;
            }}
            .chapter-title {{
                font-size: 16pt;
                color: {cover_color};
                margin-bottom: 1cm;
                padding-bottom: 0.3cm;
                border-bottom: 1px solid {cover_color};
                font-weight: bold;
            }}
            .chapter-content p {{
                margin-bottom: 0.5em;
                text-indent: 1.5em;
            }}
            .chapter-content p:first-child {{
                text-indent: 0;
            }}
        </style>
    </head>
    <body>
        <div class="cover">
            <div class="cover-title">{title}</div>
            {"<div class='cover-subtitle'>" + subtitle + "</div>" if subtitle else ""}
            <div class="cover-accent"></div>
            {"<div class='cover-author'>" + author + "</div>" if author else ""}
        </div>
        {chapters_html}
    </body>
    </html>
    """

    output = io.BytesIO()
    result = pisa.CreatePDF(html_content, dest=output, encoding='utf-8')

    if result.err:
        raise RuntimeError(f"Erreur lors de la génération du PDF : {result.err}")

    return output.getvalue()
