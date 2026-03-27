/**
 * project_hub.js — Vue d'accueil d'un projet (hub centralisé)
 */
const ProjectHubView = (() => {

  // ── Cache localStorage ───────────────────────────────────────────────────
  function cacheProject(project) {
    try {
      localStorage.setItem(`hiba-project-${project.id}`, JSON.stringify(project));
      // Mettre à jour la liste des projets en cache
      const list = getCachedProjectList();
      const idx = list.findIndex(p => p.id === project.id);
      if (idx >= 0) list[idx] = project; else list.push(project);
      localStorage.setItem('hiba-projects-list', JSON.stringify(list));
    } catch {}
  }

  function getCachedProject(id) {
    try {
      const raw = localStorage.getItem(`hiba-project-${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function getCachedProjectList() {
    try {
      const raw = localStorage.getItem('hiba-projects-list');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  // ── Render principal ─────────────────────────────────────────────────────
  async function render(projectId) {
    const view = document.getElementById('view');
    const topbar = document.getElementById('topbar');

    let project;
    try {
      project = State.project || await API.projects.get(projectId);
      State.setProject(project);
      cacheProject(project); // Sauvegarder en cache à chaque chargement réussi
    } catch (err) {
      // Essayer de récupérer depuis le cache localStorage
      const cached = getCachedProject(projectId);
      if (cached) {
        project = cached;
        State.setProject(project);
        Toast.info('Données chargées depuis le cache local (serveur indisponible)');
      } else {
        view.innerHTML = `
          <div style="padding:48px;text-align:center;max-width:500px;margin:0 auto;">
            <i class="fa-solid fa-book-skull" style="font-size:48px;opacity:0.3;margin-bottom:16px;display:block"></i>
            <h2 style="margin-bottom:8px">Roman introuvable</h2>
            <p class="text-muted" style="margin-bottom:24px;line-height:1.7">
              Ce roman n'existe pas ou a été supprimé. Les données sur Vercel sont temporaires —
              pensez à configurer une base de données permanente (DATABASE_URL).
            </p>
            <button class="btn btn-primary" onclick="window.location.hash='#/'">
              <i class="fa-solid fa-arrow-left"></i> Retour à mes romans
            </button>
          </div>`;
        return;
      }
    }

    topbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/'">
        <i class="fa-solid fa-arrow-left"></i> Mes romans
      </button>
      <div class="topbar-title">${escHtml(project.title)}</div>
      <div class="topbar-subtitle">${escHtml(project.genre || '')}</div>
      <div class="topbar-actions">
        <button class="btn btn-secondary btn-sm" onclick="ProjectHubView.openTranslateModal(${projectId})"
          title="Traduire le roman en anglais, arabe, japonais ou chinois">
          <i class="fa-solid fa-language"></i> Traduire
        </button>
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

  // ── Modal Traduction ─────────────────────────────────────────────────────
  async function openTranslateModal(projectId) {
    if (!State.aiConfigured) {
      Toast.error('Configurez votre clé API Claude dans Paramètres pour utiliser la traduction.');
      return;
    }

    const project = State.project;
    let chapters = [];
    try { chapters = await API.chapters.list(projectId); } catch {}

    const chapterOptions = chapters.map(c =>
      `<option value="${c.id}">${escHtml(c.title)}</option>`
    ).join('');

    Modal.open({
      title: '<i class="fa-solid fa-language"></i> Traduire le roman',
      body: `
        <div class="form-group">
          <label class="form-label">Langue cible</label>
          <select class="form-control" id="translate-lang">
            <option value="en">🇬🇧 Anglais</option>
            <option value="ar">🇸🇦 Arabe</option>
            <option value="ja">🇯🇵 Japonais</option>
            <option value="zh">🇨🇳 Chinois (simplifié)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Que traduire ?</label>
          <select class="form-control" id="translate-what">
            ${project.synopsis ? '<option value="synopsis">Synopsis seulement</option>' : ''}
            ${chapterOptions ? `<optgroup label="Chapitres">${chapterOptions}</optgroup>` : ''}
          </select>
        </div>
        <div id="translate-result-area" style="display:none;margin-top:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <label class="form-label" style="margin:0">Traduction</label>
            <button class="btn btn-sm btn-secondary" onclick="ProjectHubView._copyTranslation()">
              <i class="fa-solid fa-copy"></i> Copier
            </button>
          </div>
          <textarea id="translate-result-text" class="form-control" rows="10" readonly
            style="font-size:13px;line-height:1.7;resize:vertical"></textarea>
        </div>
        <div id="translate-loading" style="display:none;text-align:center;padding:24px;color:var(--text-muted)">
          <i class="fa-solid fa-spinner fa-spin" style="font-size:24px;margin-bottom:8px;display:block"></i>
          Traduction en cours...
        </div>
      `,
      confirmText: '<i class="fa-solid fa-language"></i> Traduire',
      cancelText: 'Fermer',
      async onConfirm() {
        const lang = document.getElementById('translate-lang')?.value;
        const what = document.getElementById('translate-what')?.value;
        const loadingEl = document.getElementById('translate-loading');
        const resultArea = document.getElementById('translate-result-area');
        const resultText = document.getElementById('translate-result-text');

        if (!lang || !what) { Toast.error('Sélectionnez une langue et un contenu'); return false; }

        let textToTranslate = '';
        let chapterId = null;

        if (what === 'synopsis') {
          textToTranslate = project.synopsis || '';
        } else {
          const chId = parseInt(what);
          chapterId = chId;
          try {
            const ch = await API.chapters.get(chId);
            // Enlever les balises HTML pour un texte propre
            const tmp = document.createElement('div');
            tmp.innerHTML = ch.content || '';
            textToTranslate = tmp.innerText;
          } catch (e) {
            Toast.error('Impossible de charger le chapitre'); return false;
          }
        }

        if (!textToTranslate.trim()) { Toast.error('Aucun contenu à traduire'); return false; }

        if (loadingEl) loadingEl.style.display = 'block';
        if (resultArea) resultArea.style.display = 'none';

        try {
          const res = await API.ai.translate({
            text: textToTranslate,
            language: lang,
            project_id: projectId,
            chapter_id: chapterId,
          });
          if (resultText) resultText.value = res.result;
          if (resultArea) resultArea.style.display = 'block';
        } catch (err) {
          Toast.error('Erreur traduction : ' + err.message);
        } finally {
          if (loadingEl) loadingEl.style.display = 'none';
        }
        return false; // Garder le modal ouvert pour afficher le résultat
      },
    });
  }

  function _copyTranslation() {
    const text = document.getElementById('translate-result-text')?.value;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => Toast.success('Copié dans le presse-papiers !'))
      .catch(() => Toast.error('Impossible de copier'));
  }

  // ── Edit project ─────────────────────────────────────────────────────────
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
          cacheProject(updated);
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
          // Supprimer du cache local
          try {
            localStorage.removeItem(`hiba-project-${project.id}`);
            const list = getCachedProjectList().filter(p => p.id !== project.id);
            localStorage.setItem('hiba-projects-list', JSON.stringify(list));
          } catch {}
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

  return { render, editProject, confirmDeleteProject, openTranslateModal, _copyTranslation };
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
