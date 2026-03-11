/**
 * ideas.js — Tableau d'idées (post-it / cartes colorées)
 */
const IdeasView = (() => {
  let _projectId = null;
  let _notes = [];

  const IDEA_COLORS = [
    { name: 'Or', bg: '#FFF3CC', border: '#C9A84C', text: '#4A2020' },
    { name: 'Bordeaux', bg: '#FFE8E8', border: '#8B1A1A', text: '#4A0000' },
    { name: 'Terracotta', bg: '#FFEEE4', border: '#C4622D', text: '#4A2010' },
    { name: 'Vert', bg: '#E8F5E9', border: '#4CAF50', text: '#1A3A1A' },
    { name: 'Bleu', bg: '#E3F2FD', border: '#1976D2', text: '#0D2A4A' },
    { name: 'Mauve', bg: '#F3E5F5', border: '#7B1FA2', text: '#2A0A3A' },
  ];

  async function render(projectId) {
    _projectId = projectId;
    const view = document.getElementById('view');
    const topbar = document.getElementById('topbar');

    topbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/project/${projectId}'">
        <i class="fa-solid fa-arrow-left"></i> Chapitres
      </button>
      <div class="topbar-title"><i class="fa-solid fa-lightbulb" style="color:var(--gold);margin-right:6px;"></i>Idées</div>
      <div class="topbar-actions">
        <button class="btn btn-primary" onclick="IdeasView.newIdea()">
          <i class="fa-solid fa-plus"></i> Nouvelle idée
        </button>
      </div>
    `;

    view.innerHTML = '<div class="ideas-view"><p class="text-muted" style="padding:32px;">Chargement...</p></div>';

    try {
      // Idées = notes de catégorie "idée"
      const allNotes = await API.notes.list(projectId);
      _notes = allNotes.filter(n => n.category === 'idée' || n.category === 'idees' || n.category === 'idea');
      // Si aucune, aussi afficher toutes (fallback)
      if (!_notes.length) _notes = allNotes.filter(n => n.category === 'idée');
      renderBoard();
    } catch (err) {
      view.innerHTML = `<div class="ideas-view"><p class="text-muted" style="padding:32px;">Erreur : ${err.message}</p></div>`;
    }
  }

  function renderBoard() {
    const view = document.getElementById('view');

    const colorBtns = IDEA_COLORS.map((c, i) =>
      `<button class="idea-color-dot" title="${c.name}" onclick="IdeasView.newIdea(${i})"
        style="width:20px;height:20px;border-radius:50%;background:${c.bg};border:2px solid ${c.border};cursor:pointer;"></button>`
    ).join('');

    const cards = _notes.map(n => {
      const colorIdx = parseInt(n.tags || '0') || 0;
      const color = IDEA_COLORS[colorIdx % IDEA_COLORS.length];
      const preview = (n.content || '').replace(/<[^>]+>/g, '').substring(0, 200);
      const date = new Date(n.updated_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
      return `
        <div class="idea-card" style="background:${color.bg};border:1.5px solid ${color.border};color:${color.text};"
          onclick="IdeasView.editIdea(${n.id})">
          <div class="idea-card-header">
            <div class="idea-card-title">${escHtml(n.title)}</div>
            <button class="idea-card-delete" onclick="event.stopPropagation();IdeasView.deleteIdea(${n.id})"
              title="Supprimer" style="color:${color.border};">
              <i class="fa-solid fa-times"></i>
            </button>
          </div>
          ${preview ? `<div class="idea-card-body">${escHtml(preview)}${preview.length >= 200 ? '…' : ''}</div>` : ''}
          <div class="idea-card-footer" style="color:${color.border};opacity:0.8;">
            <span><i class="fa-regular fa-clock"></i> ${date}</span>
            ${n.pinned ? '<span><i class="fa-solid fa-thumbtack"></i></span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    view.innerHTML = `
      <div class="ideas-view">
        <div class="ideas-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:var(--text-muted);">Créer une carte :</span>
            <div style="display:flex;gap:6px;align-items:center;">${colorBtns}</div>
          </div>
          <span style="font-size:12px;color:var(--text-muted);">${_notes.length} idée${_notes.length !== 1 ? 's' : ''}</span>
        </div>

        ${!_notes.length ? `
          <div class="empty-state" style="margin-top:60px;">
            <div class="empty-icon">💡</div>
            <p>Aucune idée pour l'instant.</p>
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Capturez vos inspirations avant qu'elles ne s'envolent !</p>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
              ${IDEA_COLORS.map((c, i) =>
                `<button class="btn" style="background:${c.bg};border:1.5px solid ${c.border};color:${c.text};font-size:12px;padding:6px 14px;"
                  onclick="IdeasView.newIdea(${i})">
                  <i class="fa-solid fa-plus"></i> ${c.name}
                </button>`
              ).join('')}
            </div>
          </div>
        ` : `<div class="ideas-grid">${cards}</div>`}
      </div>
    `;
  }

  function newIdea(colorIdx = 0) {
    const color = IDEA_COLORS[colorIdx % IDEA_COLORS.length];
    Modal.open({
      title: `<span style="color:${color.border};">💡 Nouvelle idée</span>`,
      body: `
        <div class="form-group">
          <label class="form-label">Titre *</label>
          <input class="form-control" data-field="title" placeholder="Titre de l'idée" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Contenu</label>
          <textarea class="form-control" data-field="content" rows="5"
            placeholder="Développez votre idée...&#10;Personnage, scène, dialogue, concept, thème..."></textarea>
        </div>
        <div style="display:flex;gap:16px;align-items:center;">
          <label style="font-size:13px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" data-field="pinned"> 📌 Épingler
          </label>
          <div>
            <label class="form-label" style="display:inline;margin-right:8px;">Couleur :</label>
            ${IDEA_COLORS.map((c, i) =>
              `<button type="button" onclick="IdeasView._selectColor(${i})" id="idea-color-${i}"
                style="width:22px;height:22px;border-radius:50%;background:${c.bg};border:${i===colorIdx?'3px':'2px'} solid ${c.border};cursor:pointer;margin:0 2px;"></button>`
            ).join('')}
            <input type="hidden" id="idea-selected-color" value="${colorIdx}">
          </div>
        </div>
      `,
      confirmText: '💡 Ajouter',
      async onConfirm(data) {
        if (!data.title.trim()) { Toast.error('Le titre est requis'); return; }
        const selectedColor = document.getElementById('idea-selected-color')?.value || '0';
        try {
          await API.notes.create({
            project_id: parseInt(_projectId),
            title: data.title,
            content: data.content || '',
            category: 'idée',
            pinned: !!data.pinned,
            tags: selectedColor,
          });
          Modal.close();
          Toast.success('Idée ajoutée !');
          const allNotes = await API.notes.list(_projectId);
          _notes = allNotes.filter(n => n.category === 'idée');
          renderBoard();
        } catch (err) { Toast.error(err.message); }
      },
    });
  }

  function _selectColor(idx) {
    const hidden = document.getElementById('idea-selected-color');
    if (hidden) hidden.value = idx;
    IDEA_COLORS.forEach((c, i) => {
      const btn = document.getElementById(`idea-color-${i}`);
      if (btn) btn.style.border = `${i===idx?'3px':'2px'} solid ${c.border}`;
    });
  }

  function editIdea(id) {
    const note = _notes.find(n => n.id === id);
    if (!note) return;
    const colorIdx = parseInt(note.tags || '0') || 0;
    const color = IDEA_COLORS[colorIdx % IDEA_COLORS.length];
    Modal.open({
      title: `<span style="color:${color.border};">✏️ ${escHtml(note.title)}</span>`,
      body: `
        <div class="form-group">
          <label class="form-label">Titre *</label>
          <input class="form-control" data-field="title" value="${escHtml(note.title)}" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Contenu</label>
          <textarea class="form-control" data-field="content" rows="6">${escHtml(note.content)}</textarea>
        </div>
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
          <label style="font-size:13px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" data-field="pinned" ${note.pinned ? 'checked' : ''}> 📌 Épingler
          </label>
          <div>
            <label class="form-label" style="display:inline;margin-right:8px;">Couleur :</label>
            ${IDEA_COLORS.map((c, i) =>
              `<button type="button" onclick="IdeasView._selectColor(${i})" id="idea-color-${i}"
                style="width:22px;height:22px;border-radius:50%;background:${c.bg};border:${i===colorIdx?'3px':'2px'} solid ${c.border};cursor:pointer;margin:0 2px;"></button>`
            ).join('')}
            <input type="hidden" id="idea-selected-color" value="${colorIdx}">
          </div>
        </div>
        <hr style="border-color:var(--border);margin:12px 0;">
        <button class="btn btn-danger btn-sm" onclick="IdeasView.deleteIdea(${note.id})">
          <i class="fa-solid fa-trash"></i> Supprimer
        </button>
      `,
      confirmText: '💾 Enregistrer',
      async onConfirm(data) {
        if (!data.title.trim()) { Toast.error('Le titre est requis'); return; }
        const selectedColor = document.getElementById('idea-selected-color')?.value || '0';
        try {
          await API.notes.update(note.id, {
            title: data.title,
            content: data.content || '',
            pinned: !!data.pinned,
            tags: selectedColor,
          });
          Modal.close();
          Toast.success('Idée mise à jour !');
          const allNotes = await API.notes.list(_projectId);
          _notes = allNotes.filter(n => n.category === 'idée');
          renderBoard();
        } catch (err) { Toast.error(err.message); }
      },
    });
  }

  async function deleteIdea(id) {
    Modal.close();
    Modal.confirm({
      title: 'Supprimer cette idée ?',
      message: 'Cette action est irréversible.',
      danger: true,
      async onConfirm() {
        try {
          await API.notes.delete(id);
          Modal.close();
          Toast.success('Idée supprimée.');
          const allNotes = await API.notes.list(_projectId);
          _notes = allNotes.filter(n => n.category === 'idée');
          renderBoard();
        } catch (err) { Toast.error(err.message); }
      },
    });
  }

  function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return { render, newIdea, editIdea, deleteIdea, _selectColor };
})();
