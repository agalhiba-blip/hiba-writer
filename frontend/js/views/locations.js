/**
 * locations.js — Gestion des lieux
 */
const LocationsView = (() => {
  let _projectId = null;
  let _locations = [];

  const typeIcons = {
    ville: '🏙️', bâtiment: '🏛️', pays: '🌍', forêt: '🌲',
    château: '🏰', mer: '🌊', montagne: '⛰️', autre: '📍', '': '📍',
  };

  async function render(projectId) {
    _projectId = projectId;
    const view = document.getElementById('view');
    const topbar = document.getElementById('topbar');

    topbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/project/${projectId}'">← Chapitres</button>
      <div class="topbar-title">Lieux</div>
      <div class="topbar-actions">
        <button class="btn btn-primary" onclick="LocationsView.createLocation()">＋ Nouveau lieu</button>
      </div>
    `;

    view.innerHTML = '<div class="cards-view"><p class="text-muted">Chargement...</p></div>';

    try {
      _locations = await API.locations.list(projectId);
      renderList();
    } catch (err) {
      view.innerHTML = `<div class="cards-view"><p class="text-muted">Erreur : ${err.message}</p></div>`;
    }
  }

  function renderList() {
    const view = document.getElementById('view');
    if (!_locations.length) {
      view.innerHTML = `
        <div class="cards-view">
          <div class="empty-state">
            <div class="empty-icon">🗺️</div>
            <p>Aucun lieu pour l'instant.</p>
            <button class="btn btn-primary" onclick="LocationsView.createLocation()">Créer un lieu</button>
          </div>
        </div>
      `;
      return;
    }

    const cards = _locations.map(loc => {
      const icon = typeIcons[loc.type] || '📍';
      return `
        <div class="location-card" onclick="LocationsView.editLocation(${loc.id})">
          <div class="location-icon">${icon}</div>
          <div class="location-name">${escHtml(loc.name)}</div>
          ${loc.type ? `<div class="location-type">${escHtml(loc.type)}</div>` : ''}
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">
            ${escHtml(loc.description)}
          </div>
        </div>
      `;
    }).join('');

    view.innerHTML = `
      <div class="cards-view">
        <div style="margin-bottom:8px;">
          <span class="text-muted">${_locations.length} lieu${_locations.length !== 1 ? 'x' : ''}</span>
        </div>
        <div class="cards-grid">${cards}</div>
      </div>
    `;
  }

  function createLocation() { openModal(null); }
  function editLocation(id) {
    const loc = _locations.find(l => l.id === id);
    if (loc) openModal(loc);
  }

  function openModal(loc) {
    const isNew = !loc;
    Modal.open({
      title: isNew ? '🗺️ Nouveau lieu' : `✏️ ${loc.name}`,
      body: `
        <div class="form-group">
          <label class="form-label">Nom *</label>
          <input class="form-control" data-field="name" value="${escHtml(loc?.name || '')}" placeholder="Nom du lieu" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-control" data-field="type">
            <option value="">— Choisir —</option>
            ${['ville','bâtiment','pays','forêt','château','mer','montagne','autre'].map(t =>
              `<option ${loc?.type === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" data-field="description" rows="3" placeholder="Décrivez ce lieu...">${escHtml(loc?.description || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Atmosphère</label>
          <textarea class="form-control" data-field="atmosphere" rows="2" placeholder="L'ambiance, les sensations...">${escHtml(loc?.atmosphere || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Histoire</label>
          <textarea class="form-control" data-field="history" rows="2" placeholder="Le passé de ce lieu...">${escHtml(loc?.history || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-control" data-field="notes" rows="2" placeholder="Autres informations...">${escHtml(loc?.notes || '')}</textarea>
        </div>
        ${!isNew ? `
        <div style="margin-top:8px;">
          <button class="btn btn-danger btn-sm" onclick="LocationsView.deleteLocation(${loc.id})">🗑️ Supprimer</button>
        </div>` : ''}
      `,
      confirmText: isNew ? 'Créer' : 'Enregistrer',
      async onConfirm(data) {
        if (!data.name.trim()) { Toast.error('Le nom est requis'); return; }
        try {
          if (isNew) {
            await API.locations.create({ ...data, project_id: parseInt(_projectId) });
            Toast.success('Lieu créé !');
          } else {
            await API.locations.update(loc.id, data);
            Toast.success('Lieu mis à jour !');
          }
          Modal.close();
          _locations = await API.locations.list(_projectId);
          renderList();
        } catch (err) {
          Toast.error(err.message);
        }
      },
    });
  }

  async function deleteLocation(id) {
    Modal.close();
    Modal.confirm({
      title: 'Supprimer ce lieu ?',
      message: 'Cette action est irréversible.',
      danger: true,
      async onConfirm() {
        try {
          await API.locations.delete(id);
          Modal.close();
          Toast.success('Lieu supprimé.');
          _locations = await API.locations.list(_projectId);
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

  return { render, createLocation, editLocation, deleteLocation };
})();
