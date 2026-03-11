/**
 * library.js — Bibliothèque de fichiers (photos, PDFs, docs)
 */
const LibraryView = (() => {
  let _projectId = null;
  let _files = [];

  const FILE_ICONS = {
    'image/jpeg': { icon: 'fa-image', color: '#e8a040', label: 'Image' },
    'image/png':  { icon: 'fa-image', color: '#e8a040', label: 'Image' },
    'image/webp': { icon: 'fa-image', color: '#e8a040', label: 'Image' },
    'image/gif':  { icon: 'fa-image', color: '#e8a040', label: 'Image' },
    'application/pdf': { icon: 'fa-file-pdf', color: '#e84040', label: 'PDF' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: 'fa-file-word', color: '#4080e8', label: 'Word' },
    'text/plain': { icon: 'fa-file-lines', color: '#808080', label: 'Texte' },
  };

  const STORAGE_KEY = () => `hiba-library-${_projectId}`;

  async function render(projectId) {
    _projectId = projectId;
    const view = document.getElementById('view');
    const topbar = document.getElementById('topbar');

    let project = State.project;
    if (!project) try { project = await API.projects.get(projectId); State.setProject(project); } catch {}

    topbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/project/${projectId}/hub'">
        <i class="fa-solid fa-arrow-left"></i> Projet
      </button>
      <div class="topbar-title">Bibliothèque de documents</div>
      <div class="topbar-actions">
        <button class="btn btn-primary" onclick="document.getElementById('library-file-input').click()">
          <i class="fa-solid fa-upload"></i> Ajouter un fichier
        </button>
        <input type="file" id="library-file-input" style="display:none"
          accept="image/*,.pdf,.docx,.doc,.txt,.xlsx,.pptx"
          multiple onchange="LibraryView.handleFiles(this.files)">
      </div>
    `;

    // Charger les fichiers sauvegardés localement
    _files = loadFiles();

    view.innerHTML = `
      <div class="library-view">
        <!-- Zone de dépôt -->
        <div class="library-drop-zone" id="library-drop-zone">
          <i class="fa-solid fa-cloud-arrow-up" style="font-size:32px;margin-bottom:8px;display:block;opacity:0.5"></i>
          <strong>Glissez vos fichiers ici</strong>
          <p style="font-size:12px;margin-top:4px">Photos, PDFs, documents Word, textes...</p>
        </div>

        <!-- Barre de recherche & filtres -->
        <div class="library-toolbar">
          <input class="form-control" style="max-width:240px;font-size:13px" placeholder="🔍 Rechercher un fichier..."
            oninput="LibraryView.filter(this.value)">
          <button class="btn btn-secondary btn-sm filter-btn active" data-filter="all" onclick="LibraryView.setFilter('all', this)">
            Tout
          </button>
          <button class="btn btn-secondary btn-sm filter-btn" data-filter="image" onclick="LibraryView.setFilter('image', this)">
            <i class="fa-solid fa-image"></i> Images
          </button>
          <button class="btn btn-secondary btn-sm filter-btn" data-filter="pdf" onclick="LibraryView.setFilter('pdf', this)">
            <i class="fa-solid fa-file-pdf"></i> PDFs
          </button>
          <button class="btn btn-secondary btn-sm filter-btn" data-filter="doc" onclick="LibraryView.setFilter('doc', this)">
            <i class="fa-solid fa-file-word"></i> Docs
          </button>
          <span style="margin-left:auto;font-size:12px;color:var(--text-muted)" id="lib-count">${_files.length} fichier(s)</span>
        </div>

        <!-- Grille des fichiers -->
        <div class="library-grid" id="library-grid">
          ${renderGrid(_files)}
        </div>
      </div>
    `;

    // Drag & drop
    const dropZone = document.getElementById('library-drop-zone');
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      handleFiles(e.dataTransfer.files);
    });
    dropZone.addEventListener('click', () => document.getElementById('library-file-input').click());

    Sidebar.render();
  }

  let _currentFilter = 'all';
  let _currentSearch = '';

  function renderGrid(files) {
    if (!files.length) {
      return `
        <div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-muted)">
          <i class="fa-solid fa-folder-open" style="font-size:40px;opacity:0.2;display:block;margin-bottom:12px"></i>
          <p>Aucun fichier. Ajoutez des photos, PDFs ou documents.</p>
        </div>
      `;
    }
    return files.map(f => {
      const cfg = getFileCfg(f.type);
      const isImage = f.type.startsWith('image/');
      return `
        <div class="library-card" onclick="LibraryView.openFile('${f.id}')">
          <div class="library-card-icon">
            ${isImage && f.dataUrl
              ? `<img src="${f.dataUrl}" style="width:80px;height:60px;object-fit:cover;border-radius:4px">`
              : `<i class="fa-solid ${cfg.icon}" style="color:${cfg.color};font-size:36px"></i>`}
          </div>
          <div class="library-card-name" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
          <div class="library-card-meta">${cfg.label} · ${formatSize(f.size)}</div>
          <button class="btn btn-danger btn-sm" style="margin-top:8px;font-size:11px"
            onclick="LibraryView.deleteFile(event,'${f.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;
    }).join('');
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList);
    let processed = 0;

    files.forEach(file => {
      const reader = new FileReader();
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';

      reader.onload = (e) => {
        const fileData = {
          id: Date.now() + Math.random(),
          name: file.name,
          type: file.type,
          size: file.size,
          addedAt: new Date().toISOString(),
          dataUrl: isImage ? e.target.result : null,
          // Pour les PDFs et docs, stocker l'URL object ou base64
          objectUrl: !isImage ? e.target.result : null,
        };
        _files.unshift(fileData);
        processed++;
        if (processed === files.length) {
          saveFiles();
          updateGrid();
          document.getElementById('lib-count').textContent = `${_files.length} fichier(s)`;
          Toast.success(`${files.length} fichier(s) ajouté(s) !`);
        }
      };

      if (isImage || isPdf || file.size < 5 * 1024 * 1024) {
        reader.readAsDataURL(file);
      } else {
        // Fichier trop grand : stocker seulement les métadonnées
        _files.unshift({
          id: Date.now() + Math.random(),
          name: file.name,
          type: file.type,
          size: file.size,
          addedAt: new Date().toISOString(),
          dataUrl: null,
          objectUrl: null,
          tooBig: true,
        });
        processed++;
        if (processed === files.length) {
          saveFiles();
          updateGrid();
          Toast.info('Certains fichiers sont trop grands pour être prévisualisés (> 5 Mo), mais leurs références sont sauvegardées.');
        }
      }
    });
  }

  function openFile(id) {
    const f = _files.find(x => String(x.id) === String(id));
    if (!f) return;
    if (f.dataUrl) {
      if (f.type.startsWith('image/')) {
        // Ouvrir l'image dans une modale
        Modal.open({
          title: `<i class="fa-solid fa-image"></i> ${escHtml(f.name)}`,
          body: `<img src="${f.dataUrl}" style="max-width:100%;max-height:70vh;display:block;margin:auto;border-radius:4px">`,
          confirmText: '✕ Fermer',
          cancelText: '',
          onConfirm: Modal.close,
        });
      } else {
        // PDF ou doc : ouvrir dans un onglet
        const win = window.open();
        win.document.write(`<iframe src="${f.dataUrl}" style="width:100%;height:100%;border:none"></iframe>`);
      }
    } else if (f.tooBig) {
      Toast.info(`Le fichier "${f.name}" est trop grand pour être affiché ici.`);
    }
  }

  function deleteFile(e, id) {
    e.stopPropagation();
    _files = _files.filter(f => String(f.id) !== String(id));
    saveFiles();
    updateGrid();
    document.getElementById('lib-count').textContent = `${_files.length} fichier(s)`;
    Toast.success('Fichier supprimé.');
  }

  function filter(query) {
    _currentSearch = query.toLowerCase();
    updateGrid();
  }

  function setFilter(type, btn) {
    _currentFilter = type;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateGrid();
  }

  function updateGrid() {
    let filtered = _files;
    if (_currentFilter !== 'all') {
      if (_currentFilter === 'image') filtered = filtered.filter(f => f.type.startsWith('image/'));
      else if (_currentFilter === 'pdf') filtered = filtered.filter(f => f.type === 'application/pdf');
      else if (_currentFilter === 'doc') filtered = filtered.filter(f => f.type.includes('word') || f.type === 'text/plain');
    }
    if (_currentSearch) filtered = filtered.filter(f => f.name.toLowerCase().includes(_currentSearch));
    const grid = document.getElementById('library-grid');
    if (grid) grid.innerHTML = renderGrid(filtered);
  }

  function loadFiles() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY()) || '[]'); } catch { return []; }
  }

  function saveFiles() {
    try { localStorage.setItem(STORAGE_KEY(), JSON.stringify(_files)); } catch {
      Toast.error('Stockage local plein. Supprimez des fichiers.');
    }
  }

  function getFileCfg(type) {
    return FILE_ICONS[type] || { icon: 'fa-file', color: '#808080', label: 'Fichier' };
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(0)} Ko`;
    return `${(bytes/1024/1024).toFixed(1)} Mo`;
  }

  function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return { render, handleFiles, openFile, deleteFile, filter, setFilter };
})();
