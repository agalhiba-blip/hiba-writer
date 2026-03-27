/**
 * dashboard.js — Tableau de bord principal
 */
const DashboardView = (() => {
  async function render() {
    const view = document.getElementById('view');
    const topbar = document.getElementById('topbar');

    topbar.innerHTML = `
      <div class="topbar-title">Mes romans</div>
      <div class="topbar-actions">
        <button class="btn btn-secondary" onclick="DashboardView.importDocument()" title="Importer un document Word ou texte">
          <i class="fa-solid fa-file-import"></i> Importer
        </button>
        <button class="btn btn-primary" onclick="DashboardView.createProject()">
          <i class="fa-solid fa-plus"></i> Nouveau roman
        </button>
      </div>
    `;

    view.innerHTML = `<div class="dashboard"><p class="text-muted" style="padding:8px 0">Chargement...</p></div>`;

    try {
      const projects = await API.projects.list();
      // Mettre en cache la liste pour la récupération hors-ligne
      try { localStorage.setItem('hiba-projects-list', JSON.stringify(projects)); } catch {}
      renderProjects(projects);
    } catch (err) {
      // Tenter de charger depuis le cache local si le serveur est indisponible
      try {
        const cached = localStorage.getItem('hiba-projects-list');
        if (cached) {
          const projects = JSON.parse(cached);
          if (projects.length > 0) {
            Toast.info('Données chargées depuis le cache local');
            renderProjects(projects);
            return;
          }
        }
      } catch {}
      view.innerHTML = `<div class="dashboard"><p class="text-muted">Erreur : ${err.message}</p></div>`;
    }
  }

  function renderProjects(projects) {
    const view = document.getElementById('view');

    const cards = projects.map(p => `
      <div class="project-card" onclick="DashboardView.openProject(${p.id})">
        <div class="project-card-cover" style="background:${p.cover_color}"></div>
        <div class="project-card-body">
          <div class="project-card-title">${escHtml(p.title)}</div>
          <div class="project-card-author">${p.author ? 'par ' + escHtml(p.author) : '&nbsp;'}</div>
          ${p.genre ? `<span class="project-card-genre">${escHtml(p.genre)}</span>` : ''}
          <div class="project-card-stats">
            <span><i class="fa-regular fa-calendar" style="margin-right:3px"></i>${formatDate(p.updated_at)}</span>
            <span>~${(p.word_count||0).toLocaleString('fr-FR')} mots</span>
          </div>
        </div>
      </div>
    `).join('');

    view.innerHTML = `
      <div class="dashboard">
        <div class="dashboard-header">
          <h1>Mes romans</h1>
          <p>${projects.length} roman${projects.length !== 1 ? 's' : ''}</p>
        </div>

        <div class="projects-grid">
          ${cards}
          <div class="project-new-card" onclick="DashboardView.createProject()">
            <i class="fa-solid fa-plus new-icon"></i>
            <span>Nouveau roman</span>
          </div>
          <div class="project-new-card" onclick="DashboardView.importDocument()" style="border-style:dashed;border-color:var(--accent)">
            <i class="fa-solid fa-file-import new-icon" style="color:var(--accent)"></i>
            <span style="color:var(--accent)">Importer un document</span>
          </div>
        </div>
      </div>
    `;
  }

  async function openProject(id) {
    try {
      const project = await API.projects.get(id);
      State.setProject(project);
      window.location.hash = `#/project/${id}/hub`;
    } catch (err) {
      Toast.error(err.message);
    }
  }

  function createProject() {
    Modal.open({
      title: '<i class="fa-solid fa-pen-nib"></i> Nouveau roman',
      body: `
        <div class="form-group">
          <label class="form-label">Titre *</label>
          <input class="form-control" data-field="title" placeholder="Le titre de votre roman" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Sous-titre</label>
          <input class="form-control" data-field="subtitle" placeholder="Sous-titre optionnel">
        </div>
        <div class="form-group">
          <label class="form-label">Auteur</label>
          <input class="form-control" data-field="author" placeholder="Votre nom">
        </div>
        <div class="form-group">
          <label class="form-label">Genre</label>
          <select class="form-control" data-field="genre">
            <option value="">— Choisir —</option>
            <option>Roman</option><option>Fantasy</option><option>Science-fiction</option>
            <option>Thriller</option><option>Romance</option><option>Historique</option>
            <option>Policier</option><option>Horreur</option><option>Jeunesse</option><option>Autre</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Synopsis</label>
          <textarea class="form-control" data-field="synopsis" rows="3" placeholder="Résumé de l'intrigue..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Couleur de couverture</label>
          <input type="color" data-field="cover_color" value="#727B57">
        </div>
      `,
      confirmText: 'Créer le roman',
      async onConfirm(data) {
        if (!data.title.trim()) { Toast.error('Le titre est requis'); return; }
        try {
          const project = await API.projects.create(data);
          Modal.close();
          Toast.success('Roman créé !');
          await openProject(project.id);
        } catch (err) {
          Toast.error(err.message);
        }
      },
    });
  }

  // ── Import document ───────────────────────────────────────────────────────
  function importDocument() {
    Modal.open({
      title: '<i class="fa-solid fa-file-import"></i> Importer un document',
      body: `
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;line-height:1.7;">
          Importez un fichier <strong>.docx</strong> (Word) ou <strong>.txt</strong>.
          Un nouveau roman sera créé automatiquement avec les chapitres détectés.
        </p>
        <div class="form-group">
          <label class="form-label">Fichier *</label>
          <div class="import-drop-zone" id="import-drop-zone" onclick="document.getElementById('import-file-input').click()">
            <i class="fa-solid fa-cloud-arrow-up" style="font-size:28px;color:var(--accent);margin-bottom:8px;display:block"></i>
            <span id="import-file-name">Cliquez ou glissez un fichier .docx / .txt</span>
          </div>
          <input type="file" id="import-file-input" accept=".docx,.doc,.txt" style="display:none" onchange="DashboardView.onImportFileSelect(this)">
        </div>
        <div class="form-group">
          <label class="form-label">Titre du roman</label>
          <input class="form-control" id="import-title" placeholder="Sera déduit du nom de fichier si vide">
        </div>
        <div class="form-group">
          <label class="form-label">Mode de découpage</label>
          <select class="form-control" id="import-mode">
            <option value="auto">Automatique — détecter les titres comme chapitres</option>
            <option value="single">Un seul chapitre (tout le document)</option>
          </select>
        </div>
      `,
      confirmText: '<i class="fa-solid fa-file-import"></i> Importer',
      async onConfirm() {
        const fileInput = document.getElementById('import-file-input');
        const title = document.getElementById('import-title')?.value.trim();
        const mode = document.getElementById('import-mode')?.value || 'auto';

        if (!fileInput || !fileInput.files.length) {
          Toast.error('Sélectionnez un fichier'); return;
        }
        const file = fileInput.files[0];
        const projectTitle = title || file.name.replace(/\.\w+$/, '');

        Modal.close();
        Toast.info('Création du roman en cours...');

        try {
          // Créer le projet
          const project = await API.projects.create({ title: projectTitle });
          State.setProject(project);

          // Importer le fichier
          if (file.name.toLowerCase().endsWith('.txt')) {
            await importTxt(file, project.id);
          } else {
            await importWordFile(file, project.id, mode);
          }

          Toast.success('Import terminé !');
          window.location.hash = `#/project/${project.id}/hub`;
        } catch (err) {
          Toast.error('Erreur : ' + err.message);
        }
      },
    });

    // Drag & drop sur la zone
    setTimeout(() => {
      const zone = document.getElementById('import-drop-zone');
      if (!zone) return;
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const f = e.dataTransfer.files[0];
        if (f) {
          const input = document.getElementById('import-file-input');
          const dt = new DataTransfer();
          dt.items.add(f);
          input.files = dt.files;
          DashboardView.onImportFileSelect(input);
        }
      });
    }, 100);
  }

  function onImportFileSelect(input) {
    const nameEl = document.getElementById('import-file-name');
    const titleInput = document.getElementById('import-title');
    if (input.files.length) {
      const f = input.files[0];
      if (nameEl) nameEl.innerHTML = `<i class="fa-solid fa-file-word" style="color:var(--accent)"></i> ${f.name} (${(f.size/1024).toFixed(1)} Ko)`;
      if (titleInput && !titleInput.value) {
        titleInput.value = f.name.replace(/\.\w+$/, '');
      }
    }
  }

  async function importTxt(file, projectId) {
    const text = await file.text();
    // Découper sur les lignes vides doubles ou les titres majuscules
    const paragraphs = text.split(/\n{2,}/);
    let chapters = [];
    let current = { title: 'Chapitre 1', paras: [] };

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      // Détecter un titre (ligne courte, tout en majuscules ou commence par "Chapitre")
      if (/^(chapitre|chapter|partie|part|acte)\s+\w+/i.test(trimmed) || (trimmed.length < 60 && trimmed === trimmed.toUpperCase() && trimmed.length > 3)) {
        if (current.paras.length > 0) chapters.push(current);
        current = { title: trimmed, paras: [] };
      } else {
        current.paras.push(`<p>${trimmed.replace(/\n/g, '<br>')}</p>`);
      }
    }
    if (current.paras.length > 0) chapters.push(current);
    if (!chapters.length) chapters = [{ title: file.name.replace(/\.\w+$/, ''), paras: [`<p>${text.replace(/\n/g, '<br>')}</p>`] }];

    for (let i = 0; i < chapters.length; i++) {
      await API.chapters.create({ project_id: projectId, title: chapters[i].title, content: chapters[i].paras.join(''), order_index: i });
    }
  }

  async function importWordFile(file, projectId, mode) {
    try {
      const res = await API.importWord.upload(file, projectId, mode);
      return res;
    } catch {
      // Fallback mammoth.js
      await loadMammoth();
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;
      if (mode === 'single') {
        await API.chapters.create({ project_id: projectId, title: file.name.replace(/\.\w+$/, ''), content: html });
      } else {
        await splitDocIntoChapters(html, projectId);
      }
    }
  }

  async function splitDocIntoChapters(html, projectId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    let chapters = [], current = { title: 'Introduction', content: [] };
    for (const node of doc.body.childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'H1' || node.tagName === 'H2')) {
        if (current.content.length) chapters.push({ ...current });
        current = { title: node.textContent.trim(), content: [] };
      } else {
        current.content.push(node.outerHTML || '');
      }
    }
    if (current.content.length) chapters.push(current);
    for (let i = 0; i < chapters.length; i++) {
      await API.chapters.create({ project_id: projectId, title: chapters[i].title, content: chapters[i].content.join(''), order_index: i });
    }
  }

  async function loadMammoth() {
    if (window.mammoth) return;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      s.onload = resolve; s.onerror = () => reject(new Error('Impossible de charger mammoth.js'));
      document.head.appendChild(s);
    });
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { render, openProject, createProject, importDocument, onImportFileSelect };
})();
