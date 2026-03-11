/**
 * characters.js — Gestion des personnages avec onglets et relations
 */
const CharactersView = (() => {
  let _projectId = null;
  let _characters = [];
  let _activeTab = {};  // charId → tabName

  async function render(projectId) {
    _projectId = projectId;
    const view = document.getElementById('view');
    const topbar = document.getElementById('topbar');

    topbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/project/${projectId}'">
        <i class="fa-solid fa-arrow-left"></i> Chapitres
      </button>
      <div class="topbar-title"><i class="fa-solid fa-users"></i> Personnages</div>
      <div class="topbar-actions">
        <button class="btn btn-primary" onclick="CharactersView.createCharacter()">＋ Nouveau personnage</button>
      </div>
    `;

    view.innerHTML = '<div class="cards-view"><p class="text-muted">Chargement...</p></div>';

    try {
      _characters = await API.characters.list(projectId);
      renderList();
    } catch (err) {
      view.innerHTML = `<div class="cards-view"><p class="text-muted">Erreur : ${err.message}</p></div>`;
    }
  }

  function renderList() {
    const view = document.getElementById('view');
    if (!_characters.length) {
      view.innerHTML = `
        <div class="cards-view">
          <div class="empty-state">
            <div class="empty-icon">👤</div>
            <p>Aucun personnage pour l'instant.</p>
            <button class="btn btn-primary" onclick="CharactersView.createCharacter()">Créer un personnage</button>
          </div>
        </div>
      `;
      return;
    }

    const cards = _characters.map(c => {
      const tags = (c.tags || '').split(',').filter(t => t.trim());
      const tagsHtml = tags.length
        ? tags.map(t => `<span style="background:var(--bg-tertiary);padding:1px 6px;border-radius:10px;font-size:10px;color:var(--text-secondary);">${escHtml(t.trim())}</span>`).join(' ')
        : '';
      return `
        <div class="character-card" onclick="CharactersView.editCharacter(${c.id})">
          <div class="character-card-top" style="background:${c.color_tag}"></div>
          <div class="character-card-body">
            <div class="character-avatar">
              ${c.image_path
                ? `<img src="${c.image_path}" alt="${escHtml(c.name)}">`
                : '<i class="fa-solid fa-user" style="font-size:28px;color:var(--text-muted)"></i>'}
            </div>
            <div class="character-name">${escHtml(c.name)}</div>
            ${c.aliases ? `<div style="font-size:11px;color:var(--text-muted);font-style:italic;">${escHtml(c.aliases)}</div>` : ''}
            <div class="character-role">${escHtml(c.role)}</div>
            ${c.age ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">${escHtml(c.age)} ans</div>` : ''}
            <div class="character-desc">${escHtml(c.description)}</div>
            ${tagsHtml ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:6px;">${tagsHtml}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    view.innerHTML = `
      <div class="cards-view">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span class="text-muted">${_characters.length} personnage${_characters.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="cards-grid">${cards}</div>
      </div>
    `;
  }

  function createCharacter() {
    openCharacterModal(null);
  }

  function editCharacter(id) {
    const char = _characters.find(c => c.id === id);
    if (char) openCharacterModal(char);
  }

  function _parseRelations(char) {
    try { return JSON.parse(char.relations || '[]'); }
    catch { return []; }
  }

  function openCharacterModal(char) {
    const isNew = !char;
    const relations = isNew ? [] : _parseRelations(char);
    const activeTab = _activeTab[char?.id] || 'profil';

    const tabBtn = (name, label, icon) => `
      <button class="tab-btn ${activeTab === name ? 'active' : ''}"
        onclick="CharactersView._switchTab('${char?.id || 'new'}','${name}')"
        style="padding:6px 12px;border:none;background:${activeTab === name ? 'var(--accent)' : 'transparent'};
               color:${activeTab === name ? '#fff' : 'var(--text-secondary)'};border-radius:6px;cursor:pointer;font-size:12px;">
        <i class="fa-solid ${icon}"></i> ${label}
      </button>
    `;

    const relationsRows = relations.map((r, i) => `
      <tr>
        <td style="padding:4px 6px;"><input class="form-control" value="${escHtml(r.name)}" placeholder="Nom" onchange="CharactersView._updateRelation('${char?.id || 'new'}',${i},'name',this.value)" style="padding:4px;font-size:12px;"></td>
        <td style="padding:4px 6px;"><select class="form-control" onchange="CharactersView._updateRelation('${char?.id || 'new'}',${i},'type',this.value)" style="padding:4px;font-size:12px;">
          ${['famille','amour','ami','ennemi','allié','rival','autre'].map(t =>
            `<option ${r.type===t?'selected':''}>${t}</option>`).join('')}
        </select></td>
        <td style="padding:4px 6px;"><input class="form-control" value="${escHtml(r.description)}" placeholder="Description" onchange="CharactersView._updateRelation('${char?.id || 'new'}',${i},'desc',this.value)" style="padding:4px;font-size:12px;"></td>
        <td style="padding:4px 6px;"><button onclick="CharactersView._removeRelation('${char?.id || 'new'}',${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;">✕</button></td>
      </tr>
    `).join('');

    Modal.open({
      title: isNew ? '👤 Nouveau personnage' : `✏️ ${char.name}`,
      body: `
        <div id="char-modal-body">
          <!-- Onglets -->
          <div style="display:flex;gap:4px;margin-bottom:12px;background:var(--bg-tertiary);padding:4px;border-radius:8px;">
            ${tabBtn('profil','Profil','fa-user')}
            ${tabBtn('psycho','Psychologie','fa-brain')}
            ${tabBtn('relations','Relations','fa-people-arrows')}
            ${tabBtn('notes','Notes','fa-note-sticky')}
          </div>

          <!-- Onglet Profil -->
          <div id="tab-profil" style="display:${activeTab==='profil'?'block':'none'}">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div class="form-group" style="grid-column:span 2">
                <label class="form-label">Nom *</label>
                <input class="form-control" data-field="name" value="${escHtml(char?.name || '')}" placeholder="Nom du personnage" autofocus>
              </div>
              <div class="form-group">
                <label class="form-label">Rôle</label>
                <select class="form-control" data-field="role">
                  <option ${char?.role === '' ? 'selected' : ''} value="">— Choisir —</option>
                  <option ${char?.role === 'protagoniste' ? 'selected' : ''}>protagoniste</option>
                  <option ${char?.role === 'antagoniste' ? 'selected' : ''}>antagoniste</option>
                  <option ${char?.role === 'secondaire' ? 'selected' : ''}>secondaire</option>
                  <option ${char?.role === 'narrateur' ? 'selected' : ''}>narrateur</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Âge</label>
                <input class="form-control" data-field="age" value="${escHtml(char?.age || '')}" placeholder="ex: 34">
              </div>
              <div class="form-group" style="grid-column:span 2">
                <label class="form-label">Surnoms / Alias</label>
                <input class="form-control" data-field="aliases" value="${escHtml(char?.aliases || '')}" placeholder="ex: Le Fou, L'Ombre...">
              </div>
              <div class="form-group" style="grid-column:span 2">
                <label class="form-label">Tags <span style="font-size:11px;color:var(--text-muted)">(séparés par virgule)</span></label>
                <input class="form-control" data-field="tags" value="${escHtml(char?.tags || '')}" placeholder="ex: guerrier, magicien, nord...">
              </div>
              <div class="form-group" style="grid-column:span 2">
                <label class="form-label">Description physique</label>
                <textarea class="form-control" data-field="description" rows="2" placeholder="Apparence, physique...">${escHtml(char?.description || '')}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Couleur</label>
                <input type="color" data-field="color_tag" value="${char?.color_tag || '#727B57'}">
              </div>
              ${char ? `
              <div class="form-group">
                <label class="form-label">Photo</label>
                <input type="file" id="char-img-input" accept="image/*" style="font-size:12px;">
              </div>
              ` : '<div></div>'}
            </div>
          </div>

          <!-- Onglet Psychologie -->
          <div id="tab-psycho" style="display:${activeTab==='psycho'?'block':'none'}">
            <div class="form-group">
              <label class="form-label">Personnalité</label>
              <textarea class="form-control" data-field="personality" rows="3" placeholder="Traits de caractère...">${escHtml(char?.personality || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Histoire passée</label>
              <textarea class="form-control" data-field="backstory" rows="3" placeholder="Contexte, origines...">${escHtml(char?.backstory || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Objectifs / Motivations</label>
              <textarea class="form-control" data-field="goals" rows="2" placeholder="Ce que veut ce personnage...">${escHtml(char?.goals || '')}</textarea>
            </div>
          </div>

          <!-- Onglet Relations -->
          <div id="tab-relations" style="display:${activeTab==='relations'?'block':'none'}">
            <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;color:var(--text-muted)">Liens avec d'autres personnages</span>
              <button class="btn btn-secondary btn-sm" onclick="CharactersView._addRelation('${char?.id || 'new'}')">
                <i class="fa-solid fa-plus"></i> Ajouter un lien
              </button>
            </div>
            <input type="hidden" data-field="relations" id="relations-hidden" value="${escHtml(char?.relations || '[]')}">
            <div id="relations-table-wrap">
              ${relations.length > 0 ? `
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                  <tr style="color:var(--text-muted);">
                    <th style="padding:4px 6px;text-align:left;">Personnage</th>
                    <th style="padding:4px 6px;text-align:left;">Type</th>
                    <th style="padding:4px 6px;text-align:left;">Description</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="relations-tbody">${relationsRows}</tbody>
              </table>` : `<div id="relations-tbody"></div><p style="font-size:12px;color:var(--text-muted);">Aucune relation définie.</p>`}
            </div>
          </div>

          <!-- Onglet Notes -->
          <div id="tab-notes" style="display:${activeTab==='notes'?'block':'none'}">
            <div class="form-group">
              <label class="form-label">Notes libres</label>
              <textarea class="form-control" data-field="notes" rows="8" placeholder="Autres informations, idées, détails...">${escHtml(char?.notes || '')}</textarea>
            </div>
          </div>

          ${!isNew ? `
          <div style="margin-top:12px;display:flex;justify-content:flex-start;">
            <button class="btn btn-danger btn-sm" onclick="CharactersView.deleteCharacter(${char.id})">
              <i class="fa-solid fa-trash"></i> Supprimer
            </button>
          </div>` : ''}
        </div>
      `,
      confirmText: isNew ? 'Créer' : 'Enregistrer',
      async onConfirm(data) {
        if (!data.name.trim()) { Toast.error('Le nom est requis'); return; }
        // Récupérer la valeur JSON des relations depuis le champ caché
        const hiddenRel = document.getElementById('relations-hidden');
        if (hiddenRel) data.relations = hiddenRel.value;
        try {
          let updated;
          if (isNew) {
            updated = await API.characters.create({ ...data, project_id: parseInt(_projectId) });
            Toast.success('Personnage créé !');
          } else {
            updated = await API.characters.update(char.id, data);
            Toast.success('Personnage mis à jour !');
            const fileInput = document.getElementById('char-img-input');
            if (fileInput && fileInput.files.length > 0) {
              await API.characters.uploadImage(char.id, fileInput.files[0]);
            }
          }
          Modal.close();
          _characters = await API.characters.list(_projectId);
          renderList();
        } catch (err) {
          Toast.error(err.message);
        }
      },
    });
  }

  // Changer l'onglet actif dans la modal
  function _switchTab(charId, tabName) {
    _activeTab[charId] = tabName;
    ['profil','psycho','relations','notes'].forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      if (el) el.style.display = t === tabName ? 'block' : 'none';
    });
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
      const tabs = ['profil','psycho','relations','notes'];
      const isActive = tabs[i] === tabName;
      btn.style.background = isActive ? 'var(--accent)' : 'transparent';
      btn.style.color = isActive ? '#fff' : 'var(--text-secondary)';
    });
  }

  // Gestion des relations
  let _relationsData = {};

  function _addRelation(charId) {
    const key = `rel_${charId}`;
    if (!_relationsData[key]) {
      const hidden = document.getElementById('relations-hidden');
      try { _relationsData[key] = JSON.parse(hidden?.value || '[]'); } catch { _relationsData[key] = []; }
    }
    _relationsData[key].push({ name: '', type: 'famille', description: '' });
    _refreshRelationsTable(charId);
    _syncRelationsHidden(charId);
  }

  function _removeRelation(charId, idx) {
    const key = `rel_${charId}`;
    if (_relationsData[key]) {
      _relationsData[key].splice(idx, 1);
      _refreshRelationsTable(charId);
      _syncRelationsHidden(charId);
    }
  }

  function _updateRelation(charId, idx, field, value) {
    const key = `rel_${charId}`;
    if (_relationsData[key] && _relationsData[key][idx]) {
      if (field === 'name') _relationsData[key][idx].name = value;
      if (field === 'type') _relationsData[key][idx].type = value;
      if (field === 'desc') _relationsData[key][idx].description = value;
      _syncRelationsHidden(charId);
    }
  }

  function _syncRelationsHidden(charId) {
    const key = `rel_${charId}`;
    const hidden = document.getElementById('relations-hidden');
    if (hidden && _relationsData[key]) {
      hidden.value = JSON.stringify(_relationsData[key]);
    }
  }

  function _refreshRelationsTable(charId) {
    const key = `rel_${charId}`;
    const relations = _relationsData[key] || [];
    const wrap = document.getElementById('relations-table-wrap');
    if (!wrap) return;

    const rows = relations.map((r, i) => `
      <tr>
        <td style="padding:4px 6px;"><input class="form-control" value="${escHtml(r.name)}" placeholder="Nom" onchange="CharactersView._updateRelation('${charId}',${i},'name',this.value)" style="padding:4px;font-size:12px;"></td>
        <td style="padding:4px 6px;"><select class="form-control" onchange="CharactersView._updateRelation('${charId}',${i},'type',this.value)" style="padding:4px;font-size:12px;">
          ${['famille','amour','ami','ennemi','allié','rival','autre'].map(t =>
            `<option ${r.type===t?'selected':''}>${t}</option>`).join('')}
        </select></td>
        <td style="padding:4px 6px;"><input class="form-control" value="${escHtml(r.description)}" placeholder="Description" onchange="CharactersView._updateRelation('${charId}',${i},'desc',this.value)" style="padding:4px;font-size:12px;"></td>
        <td style="padding:4px 6px;"><button onclick="CharactersView._removeRelation('${charId}',${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;">✕</button></td>
      </tr>
    `).join('');

    wrap.innerHTML = relations.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="color:var(--text-muted);">
            <th style="padding:4px 6px;text-align:left;">Personnage</th>
            <th style="padding:4px 6px;text-align:left;">Type</th>
            <th style="padding:4px 6px;text-align:left;">Description</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>` : `<p style="font-size:12px;color:var(--text-muted);">Aucune relation. Cliquez sur "Ajouter un lien".</p>`;
  }

  async function deleteCharacter(id) {
    Modal.close();
    Modal.confirm({
      title: 'Supprimer ce personnage ?',
      message: 'Cette action est irréversible.',
      danger: true,
      async onConfirm() {
        try {
          await API.characters.delete(id);
          Modal.close();
          Toast.success('Personnage supprimé.');
          _characters = await API.characters.list(_projectId);
          renderList();
        } catch (err) {
          Toast.error(err.message);
        }
      },
    });
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { render, createCharacter, editCharacter, deleteCharacter,
           _switchTab, _addRelation, _removeRelation, _updateRelation };
})();
