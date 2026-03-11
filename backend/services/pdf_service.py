import re
import io


def _clean_text(text: str) -> str:
    """Remplace les caractères Unicode non supportés par leurs équivalents ASCII."""
    replacements = {
        '\u2014': ' - ', '\u2013': ' - ', '\u2012': '-',
        '\u201c': '"', '\u201d': '"', '\u201e': '"',
        '\u2018': "'", '\u2019': "'", '\u201a': "'",
        '\u2026': '...', '\u00ab': '"', '\u00bb': '"',
        '\u2022': '*', '\u00a0': ' ',
    }
    for char, repl in replacements.items():
        text = text.replace(char, repl)
    return text


def _strip_html(html: str) -> str:
    """Retire les balises HTML et retourne le texte propre."""
    h = re.sub(r'<br\s*/?>', '\n', html or '')
    h = re.sub(r'</p>', '\n', h)
    h = re.sub(r'<[^>]+>', '', h)
    h = re.sub(r'&nbsp;', ' ', h)
    h = re.sub(r'&amp;', '&', h)
    h = re.sub(r'&lt;', '<', h)
    h = re.sub(r'&gt;', '>', h)
    return h.strip()


def _hex_to_rgb(hex_color: str):
    """Convertit une couleur hex (#RRGGBB) en tuple (R, G, B)."""
    hex_color = hex_color.lstrip('#')
    if len(hex_color) != 6:
        return (114, 123, 87)  # couleur par défaut
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def generate_novel_pdf(project: dict, chapters: list) -> bytes:
    """Génère un PDF du roman et retourne les bytes."""
    from fpdf import FPDF

    cover_color = project.get("cover_color", "#727B57")
    title = project.get("title", "Mon Roman")
    author = project.get("author", "")
    subtitle = project.get("subtitle", "")
    r, g, b = _hex_to_rgb(cover_color)

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=25)
    pdf.set_margins(30, 25, 30)

    # ── Page de couverture ────────────────────────────────────────────────────
    pdf.add_page()
    pdf.ln(60)

    # Titre
    pdf.set_font("Helvetica", "B", 28)
    pdf.set_text_color(26, 26, 26)
    pdf.multi_cell(0, 12, _clean_text(title), align="C")
    pdf.ln(4)

    # Ligne décorative
    pdf.set_fill_color(r, g, b)
    page_w = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.set_x(pdf.l_margin + page_w / 2 - 20)
    pdf.cell(40, 3, "", fill=True)
    pdf.ln(8)

    # Sous-titre
    if subtitle:
        pdf.set_font("Helvetica", "I", 14)
        pdf.set_text_color(85, 85, 85)
        pdf.multi_cell(0, 8, _clean_text(subtitle), align="C")
        pdf.ln(4)

    # Auteur
    if author:
        pdf.ln(20)
        pdf.set_font("Helvetica", "", 13)
        pdf.set_text_color(51, 51, 51)
        pdf.multi_cell(0, 8, _clean_text(author).upper(), align="C")

    # ── Chapitres ─────────────────────────────────────────────────────────────
    for i, chapter in enumerate(chapters):
        pdf.add_page()

        # Titre du chapitre
        pdf.set_font("Helvetica", "B", 16)
        pdf.set_text_color(r, g, b)
        ch_title = _clean_text(f"Chapitre {i + 1} - {chapter.get('title', '')}")
        pdf.multi_cell(0, 10, ch_title, align="L")

        # Ligne sous le titre
        pdf.set_draw_color(r, g, b)
        pdf.set_line_width(0.5)
        pdf.line(pdf.l_margin, pdf.get_y() + 2, pdf.w - pdf.r_margin, pdf.get_y() + 2)
        pdf.ln(10)

        # Contenu
        pdf.set_font("Times", "", 12)
        pdf.set_text_color(26, 26, 26)
        content = _clean_text(_strip_html(chapter.get("content", "")))

        # Découper en paragraphes
        paragraphs = [p.strip() for p in content.split('\n') if p.strip()]
        first = True
        for para in paragraphs:
            if not first:
                pdf.ln(3)
            pdf.multi_cell(0, 7, para, align="J")
            first = False

    output = io.BytesIO()
    pdf.output(output)
    return output.getvalue()
