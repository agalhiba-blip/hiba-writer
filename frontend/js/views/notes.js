/**
 * notes.js — Gestion des notes avec dossiers (catégories)
 */
const NotesView = (() => {
  let _projectId = null;
  let _notes = [];
  let _currentNote = null;
  let _saveTimer = null;
  let _activeFolder = 'tous';

  // Dossiers disponibles (catégories)
  const DEFAULT_FOLDERS = ['général', 'idée', 'dialogue', 'plan', 'recherche', 'autre'];

  async function render(projectId) {
    _projectId = projectId;
    const view = document.getElementById('view');
    const topbar = document.getElementById('topbar');

    topbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/project/${projectId}/hub'">
        <i class="fa-solid fa-arrow-left"></i> Projet
      </button>
      <div class="topbar-title">Notes &amp; Dossiers</div>
      <div class="topbar-actions">
        <button class="btn btn-secondary btn-sm" onclick="NotesView.createFolder()">
          <i class="fa-solid fa-folder-plus"></i> Nouveau dossier
        </button>
        <button class="btn btn-primary" onclick="NotesView.createNote()">
          <i class="fa-solid fa-plus"></i> Nouvelle note
        </button>
      </div>
    `;

    view.innerHTML = `
      <div class="notes-layout">
        <!-- Dossiers (colonne gauche) -->
        <div class="notes-folders" id="notes-folders">
          <div class="notes-folder-header">
            <i class="fa-solid fa-folder-tree" style="color:var(--accent)"></i>
            Dossiers
          </div>
          <div id="folders-list">
            <p style="font-size:12px;color:var(--text-muted);padding:8px">Chargement...</p>
          </div>
        </div>

        <!-- Liste des notes -->
        <div class="notes-list">
          <div class="notes-list-header">
            <input class="form-control" style="font-size:12px;" placeholder="🔍 Rechercher..."
              oninput="NotesView.filterNotes(this.value)">
          </div>
          <div class="notes-list-items" id="notes-list-items">
            <p class="text-muted" style="padding:12px;font-size:12px;">Chargement...</p>
          </div>
        </div>

        <!-- Éditeur de note -->
        <div class="notes-editor" id="notes-editor">
          <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--text-muted);">
            <i class="fa-solid fa-note-sticky" style="font-size:36px;opacity:0.2;margin-bottom:12px"></i>
            <p style="font-size:13px;">Sélectionnez ou créez une note.</p>
          </div>
        </div>
      </div>
    `;

    try {
      _notes = await API.notes.list(projectId);
      renderFolders();
      renderNotesList(_notes);
      if (_notes.length > 0) selectNote(_notes[0]);
    } catch (err) {
      document.getElementById('notes-list-items').innerHTML =
        `<p style="padding:12px;font-size:12px;color:var(--text-muted)">Erreur : ${err.message}</p>`;
    }
  }

  // ── Dossiers ──────────────────────────────────────────────────────────────
  function getAllFolders() {
    const custom = _notes.map(n => n.category).filter(c => c && !DEFAULT_FOLDERS.includes(c));
    return ['tous', ...DEFAULT_FOLDERS, ...new Set(custom)];
  }

  function renderFolders() {
    const container = document.getElementById('folders-list');
    if (!container) return;
    const folders = getAllFolders();
    const counts = {};
    _notes.forEach(n => { counts[n.category] = (counts[n.category]||0)+1; });
    counts['tous'] = _notes.length;

    container.innerHTML = folders.map(f => {
      const isActive = _activeFolder === f;
      const isCustom = !DEFAULT_FOLDERS.includes(f) && f !== 'tous';
      const icons = {
        tous: 'fa-layer-group', général: 'fa-folder', idée: 'fa-lightbulb',
        dialogue: 'fa-comments', plan: 'fa-sitemap', recherche: 'fa-magnifying-glass',
        autre: 'fa-box-archive',
      };
      const icon = icons[f] || 'fa-folder';
      return `
        <div class="folder-item ${isActive ? 'active' : ''}" onclick="NotesView.selectFolder('${f}')">
          <i class="fa-solid ${icon}" style="width:16px;text-align:center;color:${isActive?'var(--accent)':'var(--text-muted)'}"></i>
          <span class="folder-label">${f}</span>
          <span class="folder-count">${counts[f]||0}</span>
          ${isCustom ? `<button class="folder-delete-btn" onclick="NotesView.deleteFolder(event,'${f}')" title="Supprimer ce dossier">
            <i class="fa-solid fa-trash" style="font-size:10px"></i>
          </button>` : ''}
        </div>
      `;
    }).join('');
  }

  function selectFolder(folder) {
    _activeFolder = folder;
    renderFolders();
    const filtered = folder === 'tous' ? _notes : _notes.filter(n => n.category === folder);
    renderNotesList(filtered);
  }

  function createFolder() {
    Modal.open({
      title: '<i class="fa-solid fa-folder-plus"></i> Nouveau dossier',
      body: `
        <div class="form-group">
          <label class="form-label">Nom du dossier *</label>
          <input class="form-control" data-field="name" placeholder="ex: Recherches historiques" autofocus>
        </div>
        <p style="font-size:12px;color:var(--text-muted)">Le dossier sera disponible comme catégorie pour vos notes.</p>
      `,
      confirmText: 'Créer',
      async onConfirm(data) {
        const name = data.name?.trim().toLowerCase();
        if (!name) { Toast.error('Nom requis'); return; }
        if (getAllFolders().includes(name)) { Toast.error('Ce dossier existe déjà'); return; }
        // Créer une note placeholder dans ce dossier pour le créer
        try {
          const note = await API.notes.create({
            project_id: parseInt(_projectId),
            title: 'Nouvelle note',
            content: '',
            category: name,
          });
          _notes.unshift(note);
          Modal.close();
          Toast.success(`Dossier "${name}" créé !`);
          renderFolders();
          selectFolder(name);
          selectNote(note);
        } catch (err) {
          Toast.error(err.message);
        }
      },
    });
  }

  async function deleteFolder(e, folder) {
    e.stopPropagation();
    const notesInFolder = _notes.filter(n => n.category === folder);
    Modal.confirm({
      title: `Supprimer le dossier "${folder}" ?`,
      message: notesInFolder.length > 0
        ? `${notesInFolder.length} note(s) seront déplacées vers "général".`
        : 'Le dossier est vide.',
      danger: true,
      async onConfirm() {
        for (const note of notesInFolder) {
          await API.notes.update(note.id, { category: 'général' });
          note.category = 'général';
        }
        Modal.close();
        _activeFolder = 'tous';
        renderFolders();
        renderNotesList(_notes);
        Toast.success('Dossier supprimé.');
      },
    });
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  function renderNotesList(notes) {
    const container = document.getElementById('notes-list-items');
    if (!container) return;
    if (!notes.length) {
      container.innerHTML = `
        <div style="padding:16px;text-align:center;">
          <i class="fa-solid fa-note-sticky" style="font-size:24px;opacity:0.2;margin-bottom:8px;display:block"></i>
          <p style="font-size:12px;color:var(--text-muted)">Aucune note dans ce dossier.</p>
          <button class="btn btn-sm btn-secondary" onclick="NotesView.createNote()" style="margin-top:8px">
            <i class="fa-solid fa-plus"></i> Créer une note
          </button>
        </div>
      `;
      return;
    }
    container.innerHTML = notes.map(n => `
      <div class="note-item ${_currentNote?.id === n.id ? 'active' : ''}"
           onclick="NotesView.selectNote(${JSON.stringify(n).replace(/"/g,'&quot;')})">
        <div class="note-item-title">
          ${n.pinned ? '<i class="fa-solid fa-thumbtack" style="color:var(--accent);margin-right:4px;font-size:10px"></i>' : ''}
          ${escHtml(n.title)}
        </div>
        <div class="note-item-preview">${escHtml(stripHtml(n.content)).substring(0, 60)}</div>
      </div>
    `).join('');
  }

  function selectNote(note) {
    _currentNote = typeof note === 'string' ? JSON.parse(note) : note;
    renderNotesList(_activeFolder === 'tous' ? _notes : _notes.filter(n => n.category === _activeFolder));
    const editor = document.getElementById('notes-editor');
    if (!editor) return;

    const folders = getAllFolders().filter(f => f !== 'tous');

    editor.innerHTML = `
      <div class="notes-editor-header">
        <input class="notes-editor-title" value="${escHtml(_currentNote.title)}"
          onchange="NotesView.updateTitle(this.value)" placeholder="Titre de la note">
        <select class="form-control" style="width:auto;font-size:12px;" onchange="NotesView.updateCategory(this.value)">
          ${folders.map(c => `<option ${_currentNote.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <button class="btn btn-icon btn-sm" onclick="NotesView.togglePin()"
          title="${_currentNote.pinned ? 'Désépingler' : 'Épingler'}">
          <i class="fa-solid fa-thumbtack" style="color:${_currentNote.pinned ? 'var(--accent)' : 'var(--text-muted)'}"></i>
        </button>
        <button class="btn btn-icon btn-sm btn-danger-icon" onclick="NotesView.deleteNote()" title="Supprimer la note">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      <textarea class="notes-editor-content" id="note-content"
        placeholder="Écrivez ici..."
        oninput="NotesView.scheduleAutoSave()">${escHtml(_currentNote.content)}</textarea>
    `;
  }

  function scheduleAutoSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => saveCurrentNote(), 1500);
  }

  async function saveCurrentNote() {
    if (!_currentNote) return;
    const contentEl = document.getElementById('note-content');
    if (!contentEl) return;
    try {
      await API.notes.update(_currentNote.id, { content: contentEl.value });
      _currentNote.content = contentEl.value;
      const idx = _notes.findIndex(n => n.id === _currentNote.id);
      if (idx !== -1) _notes[idx].content = contentEl.value;
    } catch {}
  }

  async function updateTitle(value) {
    if (!_currentNote) return;
    try {
      await API.notes.update(_currentNote.id, { title: value });
      _currentNote.title = value;
      const idx = _notes.findIndex(n => n.id === _currentNote.id);
      if (idx !== -1) _notes[idx].title = value;
      renderNotesList(_activeFolder === 'tous' ? _notes : _notes.filter(n => n.category === _activeFolder));
    } catch {}
  }

  async function updateCategory(value) {
    if (!_currentNote) return;
    try {
      await API.notes.update(_currentNote.id, { category: value });
      _currentNote.category = value;
      const idx = _notes.findIndex(n => n.id === _currentNote.id);
      if (idx !== -1) _notes[idx].category = value;
      renderFolders();
    } catch {}
  }

  async function togglePin() {
    if (!_currentNote) return;
    try {
      const updated = await API.notes.update(_currentNote.id, { pinned: !_currentNote.pinned });
      _currentNote.pinned = updated.pinned;
      const idx = _notes.findIndex(n => n.id === _currentNote.id);
      if (idx !== -1) _notes[idx].pinned = updated.pinned;
      _notes.sort((a,b) => b.pinned - a.pinned);
      renderNotesList(_activeFolder === 'tous' ? _notes : _notes.filter(n => n.category === _activeFolder));
      selectNote(_currentNote);
    } catch {}
  }

  async function createNote() {
    const category = _activeFolder === 'tous' ? 'général' : _activeFolder;
    try {
      const note = await API.notes.create({
        project_id: parseInt(_projectId),
        title: 'Nouvelle note',
        content: '',
        category,
      });
      _notes.unshift(note);
      renderFolders();
      selectFolder(_activeFolder);
      selectNote(note);
    } catch (err) {
      Toast.error(err.message);
    }
  }

  async function deleteNote() {
    if (!_currentNote) return;
    Modal.confirm({
      title: 'Supprimer cette note ?',
      message: 'Cette action est irréversible.',
      danger: true,
      async onConfirm() {
        try {
          await API.notes.delete(_currentNote.id);
          Modal.close();
          _notes = _notes.filter(n => n.id !== _currentNote.id);
          _currentNote = null;
          renderFolders();
          const filtered = _activeFolder === 'tous' ? _notes : _notes.filter(n => n.category === _activeFolder);
          renderNotesList(filtered);
          const editor = document.getElementById('notes-editor');
          if (filtered.length > 0) selectNote(filtered[0]);
          else if (editor) editor.innerHTML = `
            <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--text-muted);height:100%">
              <i class="fa-solid fa-note-sticky" style="font-size:36px;opacity:0.2;margin-bottom:12px"></i>
              <p style="font-size:13px;">Créez une première note.</p>
            </div>`;
          Toast.success('Note supprimée.');
        } catch (err) {
          Toast.error(err.message);
        }
      },
    });
  }

  function filterNotes(query) {
    const q = query.toLowerCase();
    const base = _activeFolder === 'tous' ? _notes : _notes.filter(n => n.category === _activeFolder);
    renderNotesList(base.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)));
  }

  function stripHtml(html) { return (html||'').replace(/<[^>]+>/g,' ').trim(); }
  function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return { render, selectNote, selectFolder, scheduleAutoSave, createNote, deleteNote,
           updateTitle, updateCategory, togglePin, filterNotes, createFolder, deleteFolder };
})();
