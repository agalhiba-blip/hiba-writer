/**
 * project_hub.js — Vue d'accueil d'un projet (hub centralisé)
 */
const ProjectHubView = (() => {
  async function render(projectId) {
    const view = document.getElementById('view');
    const topbar = document.getElementById('topbar');

    let project;
    try {
      project = State.project || await API.projects.get(projectId);
      State.setProject(project);
    } catch (err) {
      view.innerHTML = `<p class="text-muted" style="padding:32px">Erreur : ${err.message}</p>`;
      return;
    }

    topbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/'">
        <i class="fa-solid fa-arrow-left"></i> Mes romans
      </button>
      <div class="topbar-title">${escHtml(project.title)}</div>
      <div class="topbar-subtitle">${escHtml(project.genre || '')}</div>
      <div class="topbar-actions">
        <button class="btn btn-secondary btn-sm" onclick="window._hubExportPdf(${projectId})">
          <i class="fa-solid fa-file-pdf"></i> Export PDF
        </button>
        <button class="btn btn-secondary btn-sm" onclick="ProjectHubView.editProject(${projectId})">
          <i class="fa-solid fa-pen"></i> Modifier
        </button>
      </div>
    `;

    // Charger les stats
    let chapters = [], characters = [], locations = [], notes = [];
    try {
      [chapters, characters, locations, notes] = await Promise.all([
        API.chapters.list(projectId),
        API.characters.list(projectId),
        API.locations.list(projectId),
        API.notes.list(projectId),
      ]);
    } catch {}

    const totalWords = chapters.reduce((s,c) => s + (c.word_count||0), 0);

    view.innerHTML = `
      <div class="hub-view">
        <!-- Synopsis -->
        ${project.synopsis ? `
        <div class="hub-synopsis">
          <i class="fa-solid fa-quote-left" style="color:var(--accent);margin-right:8px;opacity:0.6"></i>
          ${escHtml(project.synopsis)}
        </div>` : ''}

        <!-- Stats rapides -->
        <div class="hub-stats">
          <div class="hub-stat">
            <div class="hub-stat-num">${chapters.length}</div>
            <div class="hub-stat-label">Chapitres</div>
          </div>
          <div class="hub-stat">
            <div class="hub-stat-num">${totalWords.toLocaleString('fr-FR')}</div>
            <div class="hub-stat-label">Mots</div>
          </div>
          <div class="hub-stat">
            <div class="hub-stat-num">${Math.ceil(totalWords/250)}</div>
            <div class="hub-stat-label">Pages ~</div>
          </div>
          <div class="hub-stat">
            <div class="hub-stat-num">${characters.length}</div>
            <div class="hub-stat-label">Personnages</div>
          </div>
        </div>

        <!-- Sections principales -->
        <div class="hub-sections">

          <!-- Chapitres -->
          <div class="hub-section">
            <div class="hub-section-header">
              <span><i class="fa-solid fa-book-open" style="color:var(--accent);margin-right:8px"></i>Chapitres</span>
              <button class="btn btn-primary btn-sm" onclick="window.location.hash='#/project/${projectId}'">
                <i class="fa-solid fa-arrow-right"></i> Voir tous
              </button>
            </div>
            <div class="hub-section-body">
              ${chapters.length === 0 ? `
                <div class="hub-empty">
                  <i class="fa-solid fa-file-circle-plus" style="font-size:20px;opacity:0.4"></i>
                  <span>Aucun chapitre</span>
                  <button class="btn btn-sm btn-secondary" onclick="window.location.hash='#/project/${projectId}'">Créer</button>
                </div>
              ` : chapters.slice(0, 4).map(c => `
                <div class="hub-list-item" onclick="window.location.hash='#/project/${projectId}/chapter/${c.id}'">
                  <span class="hub-item-icon"><i class="fa-regular fa-file-lines"></i></span>
                  <span class="hub-item-label">${escHtml(c.title)}</span>
                  <span class="hub-item-meta">${c.word_count} mots</span>
                  <span class="chapter-status status-${c.status}">${c.status}</span>
                </div>
              `).join('')}
              ${chapters.length > 4 ? `<div style="text-align:center;padding:6px;font-size:12px;color:var(--text-muted)">+ ${chapters.length - 4} chapitres</div>` : ''}
            </div>
          </div>

          <!-- Colonne droite : Personnages + Lieux + Notes -->
          <div class="hub-right-col">

            <!-- Personnages -->
            <div class="hub-section hub-section-sm">
              <div class="hub-section-header">
                <span><i class="fa-solid fa-users" style="color:var(--accent);margin-right:8px"></i>Personnages</span>
                <button class="btn btn-secondary btn-sm" onclick="window.location.hash='#/project/${projectId}/characters'">
                  <i class="fa-solid fa-arrow-right"></i>
                </button>
              </div>
              <div class="hub-section-body">
                ${characters.length === 0 ? `
                  <div class="hub-empty">
                    <i class="fa-solid fa-user-plus" style="font-size:18px;opacity:0.4"></i>
                    <button class="btn btn-sm btn-secondary" onclick="window.location.hash='#/project/${projectId}/characters'">Ajouter</button>
                  </div>
                ` : `<div class="hub-chars-row">
                  ${characters.slice(0,5).map(c => `
                    <div class="hub-char-chip" onclick="window.location.hash='#/project/${projectId}/characters'" title="${escHtml(c.name)}"
                         style="border-color:${c.color_tag}">
                      ${c.image_path ? `<img src="${c.image_path}" style="width:32px;height:32px;border-radius:50%;object-fit:cover">` :
                        `<span style="font-size:20px">👤</span>`}
                      <span>${escHtml(c.name)}</span>
                    </div>
                  `).join('')}
                  ${characters.length > 5 ? `<div class="hub-char-chip" style="opacity:0.6" onclick="window.location.hash='#/project/${projectId}/characters'">+${characters.length-5}</div>` : ''}
                </div>`}
              </div>
            </div>

            <!-- Lieux -->
            <div class="hub-section hub-section-sm">
              <div class="hub-section-header">
                <span><i class="fa-solid fa-map-location-dot" style="color:var(--accent);margin-right:8px"></i>Lieux</span>
                <button class="btn btn-secondary btn-sm" onclick="window.location.hash='#/project/${projectId}/locations'">
                  <i class="fa-solid fa-arrow-right"></i>
                </button>
              </div>
              <div class="hub-section-body">
                ${locations.length === 0 ? `
                  <div class="hub-empty">
                    <i class="fa-solid fa-map-pin" style="font-size:18px;opacity:0.4"></i>
                    <button class="btn btn-sm btn-secondary" onclick="window.location.hash='#/project/${projectId}/locations'">Ajouter</button>
                  </div>
                ` : locations.slice(0,4).map(l => `
                  <div class="hub-list-item" onclick="window.location.hash='#/project/${projectId}/locations'">
                    <span class="hub-item-icon"><i class="fa-solid fa-location-dot"></i></span>
                    <span class="hub-item-label">${escHtml(l.name)}</span>
                    <span class="hub-item-meta">${escHtml(l.type)}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Notes -->
            <div class="hub-section hub-section-sm">
              <div class="hub-section-header">
                <span><i class="fa-solid fa-note-sticky" style="color:var(--accent);margin-right:8px"></i>Notes</span>
                <button class="btn btn-secondary btn-sm" onclick="window.location.hash='#/project/${projectId}/notes'">
                  <i class="fa-solid fa-arrow-right"></i>
                </button>
              </div>
              <div class="hub-section-body">
                ${notes.length === 0 ? `
                  <div class="hub-empty">
                    <i class="fa-solid fa-pen-to-square" style="font-size:18px;opacity:0.4"></i>
                    <button class="btn btn-sm btn-secondary" onclick="window.location.hash='#/project/${projectId}/notes'">Créer</button>
                  </div>
                ` : notes.slice(0,3).map(n => `
                  <div class="hub-list-item" onclick="window.location.hash='#/project/${projectId}/notes'">
                    <span class="hub-item-icon">${n.pinned ? '<i class="fa-solid fa-thumbtack" style="color:var(--accent)"></i>' : '<i class="fa-regular fa-note-sticky"></i>'}</span>
                    <span class="hub-item-label">${escHtml(n.title)}</span>
                    <span class="hub-item-meta">${escHtml(n.category)}</span>
                  </div>
                `).join('')}
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    Sidebar.render();
  }

  async function editProject(projectId) {
    const project = State.project;
    if (!project) return;
    Modal.open({
      title: '<i class="fa-solid fa-pen"></i> Modifier le roman',
      body: `
        <div class="form-group">
          <label class="form-label">Titre *</label>
          <input class="form-control" data-field="title" value="${escHtml(project.title)}" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Sous-titre</label>
          <input class="form-control" data-field="subtitle" value="${escHtml(project.subtitle)}">
        </div>
        <div class="form-group">
          <label class="form-label">Auteur</label>
          <input class="form-control" data-field="author" value="${escHtml(project.author)}">
        </div>
        <div class="form-group">
          <label class="form-label">Genre</label>
          <input class="form-control" data-field="genre" value="${escHtml(project.genre)}">
        </div>
        <div class="form-group">
          <label class="form-label">Synopsis</label>
          <textarea class="form-control" data-field="synopsis" rows="4">${escHtml(project.synopsis)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Couleur de couverture</label>
          <input type="color" data-field="cover_color" value="${project.cover_color}">
        </div>
        <hr style="border-color:var(--border);margin:12px 0">
        <button class="btn btn-danger btn-sm" onclick="ProjectHubView.confirmDeleteProject()">
          <i class="fa-solid fa-trash"></i> Supprimer ce roman
        </button>
      `,
      confirmText: 'Enregistrer',
      async onConfirm(data) {
        if (!data.title.trim()) { Toast.error('Le titre est requis'); return; }
        try {
          const updated = await API.projects.update(project.id, data);
          State.setProject(updated);
          Modal.close();
          Toast.success('Roman mis à jour !');
          render(projectId);
        } catch (err) {
          Toast.error(err.message);
        }
      },
    });
  }

  function confirmDeleteProject() {
    Modal.close();
    const project = State.project;
    Modal.confirm({
      title: 'Supprimer ce roman ?',
      message: `Tout le contenu de "${project?.title}" sera définitivement supprimé.`,
      danger: true,
      async onConfirm() {
        try {
          await API.projects.delete(project.id);
          State.setProject(null);
          Modal.close();
          Toast.success('Roman supprimé.');
          window.location.hash = '#/';
        } catch (err) {
          Toast.error(err.message);
        }
      },
    });
  }

  function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { render, editProject, confirmDeleteProject };
})();

// Helper pour export PDF depuis le hub (défini après chargement de tous les scripts)
window._hubExportPdf = async (projectId) => {
  Toast.info('Génération du PDF...');
  try {
    const res = await API.export.generatePdf(projectId);
    const url = URL.createObjectURL(res.blob);
    const a = document.createElement('a');
    a.href = url; a.download = res.filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    Toast.success('PDF téléchargé !');
  } catch (err) { Toast.error('Erreur PDF : ' + err.message); }
};
