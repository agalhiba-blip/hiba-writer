/**
 * chapters_list.js — Liste des chapitres d'un roman avec drag & drop
 */
const ChaptersListView = (() => {
  let _projectId = null;
  let _chapters = [];
  let _project = null;
  let _dragSrc = null;
  let _showArchived = false;

  async function render(projectId) {
    _projectId = projectId;
    const view = document.getElementById('view');
    const topbar = document.getElementById('topbar');

    try {
      _project = State.project || await API.projects.get(projectId);
      State.setProject(_project);
    } catch {}

    topbar.innerHTML = `
      <div class="topbar-title">${escHtml(_project?.title || 'Roman')}</div>
      <div class="topbar-subtitle">${escHtml(_project?.genre || '')}</div>
      <div class="topbar-actions">
        <div class="export-dropdown" style="position:relative;display:inline-block;">
          <button class="btn btn-secondary btn-sm" onclick="ChaptersListView.toggleExportMenu()" title="Exporter le roman">
            <i class="fa-solid fa-file-export"></i> Exporter ▾
          </button>
          <div id="export-menu" class="dropdown-menu" style="display:none;position:absolute;right:0;top:100%;z-index:200;min-width:160px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-lg);padding:4px 0;">
            <button class="dropdown-item" onclick="ChaptersListView.exportFormat('pdf')" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 14px;background:none;border:none;color:var(--text-primary);cursor:pointer;font-size:13px;">
              <i class="fa-solid fa-file-pdf" style="color:#e57373;"></i> PDF
            </button>
            <button class="dropdown-item" onclick="ChaptersListView.exportFormat('docx')" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 14px;background:none;border:none;color:var(--text-primary);cursor:pointer;font-size:13px;">
              <i class="fa-solid fa-file-word" style="color:#42a5f5;"></i> Word (.docx)
            </button>
            <button class="dropdown-item" onclick="ChaptersListView.exportFormat('md')" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 14px;background:none;border:none;color:var(--text-primary);cursor:pointer;font-size:13px;">
              <i class="fa-brands fa-markdown" style="color:#78909c;"></i> Markdown
            </button>
            <button class="dropdown-item" onclick="ChaptersListView.exportFormat('txt')" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 14px;background:none;border:none;color:var(--text-primary);cursor:pointer;font-size:13px;">
              <i class="fa-solid fa-file-lines" style="color:#90a4ae;"></i> Texte brut
            </button>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="ChaptersListView.editProject()" title="Modifier le roman">
          <i class="fa-solid fa-pen"></i> Modifier
        </button>
        <button class="btn btn-primary" onclick="ChaptersListView.createChapter()">＋ Chapitre</button>
      </div>
    `;

    // Fermer le menu export si clic ailleurs
    document.addEventListener('click', _closeExportMenuOutside);

    view.innerHTML = '<div class="chapters-view"><p class="text-muted">Chargement...</p></div>';

    try {
      _chapters = await API.chapters.list(projectId);

      if (_chapters.length > 0) {
        // Serveur OK → mettre en cache
        _saveChaptersCache(projectId, _chapters);
        renderList();
      } else {
        // Serveur vide → Vercel a peut-être réinitialisé la DB
        const cached = _loadCachedChapters(projectId);
        if (cached.length > 0) {
          Toast.info('Serveur vide — restauration depuis la sauvegarde locale en cours...');
          _chapters = await _resyncChaptersToServer(projectId, cached);
          renderList();
        } else {
          renderList(); // Vraiment vide
        }
      }
    } catch (err) {
      const cached = _loadCachedChapters(projectId);
      if (cached.length > 0) {
        Toast.info('Serveur indisponible — chapitres chargés depuis la sauvegarde locale');
        _chapters = cached;
        renderList();
      } else {
        view.innerHTML = `<div class="chapters-view"><p class="text-muted">Erreur : ${err.message}</p></div>`;
      }
    }
  }

  function _closeExportMenuOutside(e) {
    if (!e.target.closest('.export-dropdown')) {
      const m = document.getElementById('export-menu');
      if (m) m.style.display = 'none';
    }
  }

  function toggleExportMenu() {
    const m = document.getElementById('export-menu');
    if (!m) return;
    m.style.display = m.style.display === 'none' ? 'block' : 'none';
  }

  function renderList() {
    const view = document.getElementById('view');
    const active = _chapters.filter(c => !c.archived);
    const archived = _chapters.filter(c => c.archived);
    const totalWords = active.reduce((s, c) => s + (c.word_count || 0), 0);
    const wordGoal = _project?.word_goal || 0;

    let goalBar = '';
    if (wordGoal > 0) {
      const pct = Math.min(100, Math.round((totalWords / wordGoal) * 100));
      goalBar = `
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:4px;">
            <span>Objectif : ${totalWords.toLocaleString('fr-FR')} / ${wordGoal.toLocaleString('fr-FR')} mots</span>
            <span>${pct}%</span>
          </div>
          <div style="background:var(--bg-tertiary);border-radius:4px;height:6px;overflow:hidden;">
            <div style="background:var(--accent);height:100%;width:${pct}%;border-radius:4px;transition:width .3s;"></div>
          </div>
        </div>
      `;
    }

    const stats = `
      <div style="display:flex;gap:16px;margin-bottom:8px;flex-wrap:wrap;">
        <span style="font-size:12px;color:var(--text-muted)"><i class="fa-solid fa-bookmark"></i> ${active.length} chapitre${active.length !== 1 ? 's' : ''}</span>
        <span style="font-size:12px;color:var(--text-muted)">~${totalWords.toLocaleString('fr-FR')} mots</span>
        <span style="font-size:12px;color:var(--text-muted)">≈ ${Math.ceil(totalWords / 250)} pages</span>
        ${archived.length > 0 ? `<span style="font-size:12px;color:var(--text-muted)">${archived.length} archivé${archived.length !== 1 ? 's' : ''}</span>` : ''}
      </div>
      ${goalBar}
    `;

    if (!active.length && !archived.length) {
      view.innerHTML = `
        <div class="chapters-view">
          ${stats}
          <div class="empty-state">
            <div class="empty-icon">📖</div>
            <p>Aucun chapitre. Commencez à écrire !</p>
            <div style="display:flex;gap:8px;justify-content:center;">
              <button class="btn btn-primary" onclick="ChaptersListView.createChapter()">＋ Créer un chapitre</button>
              <button class="btn btn-secondary" onclick="ChaptersListView.importWord()">📂 Importer Word</button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const renderItems = (list, isArchived) => list.map((c, i) => {
      const pov = c.pov ? `<span class="chapter-badge" style="background:var(--bg-tertiary);color:var(--text-secondary);font-size:10px;padding:1px 6px;border-radius:10px;margin-left:4px;">${escHtml(c.pov)}</span>` : '';
      let wgBar = '';
      if (!isArchived && c.word_goal > 0) {
        const p = Math.min(100, Math.round((c.word_count / c.word_goal) * 100));
        wgBar = `<div style="background:var(--bg-tertiary);border-radius:2px;height:3px;margin-top:4px;overflow:hidden;"><div style="background:var(--accent);height:100%;width:${p}%;"></div></div>`;
      }
      return `
        <div class="chapter-item${isArchived ? ' archived' : ''}" ${!isArchived ? `draggable="true"
          data-id="${c.id}" data-idx="${i}"
          ondragstart="ChaptersListView.onDragStart(event,${i})"
          ondragover="ChaptersListView.onDragOver(event)"
          ondrop="ChaptersListView.onDrop(event,${i})"
          ondragend="ChaptersListView.onDragEnd(event)"` : ''}>
          ${!isArchived ? '<span class="chapter-drag-handle" title="Glisser pour réorganiser">⠿</span>' : ''}
          <span class="chapter-num">${isArchived ? '🗃' : i + 1}</span>
          <div class="chapter-info" onclick="ChaptersListView.openChapter(${c.id})">
            <div class="chapter-title-text">${escHtml(c.title)}${pov}</div>
            <div class="chapter-meta">${c.word_count} mots${c.word_goal > 0 ? ' / ' + c.word_goal : ''}${c.summary ? ' · ' + escHtml(c.summary).substring(0, 60) + '…' : ''}</div>
            ${wgBar}
          </div>
          <span class="chapter-status status-${c.status}">${c.status}</span>
          <div class="chapter-actions">
            <button class="btn-icon" onclick="ChaptersListView.openChapter(${c.id})" title="Éditer"><i class="fa-solid fa-pen"></i></button>
            ${!isArchived
              ? `<button class="btn-icon" onclick="ChaptersListView.archiveChapter(${c.id})" title="Archiver"><i class="fa-solid fa-box-archive"></i></button>`
              : `<button class="btn-icon" onclick="ChaptersListView.unarchiveChapter(${c.id})" title="Désarchiver"><i class="fa-solid fa-box-open"></i></button>`
            }
            <button class="btn-icon danger" onclick="ChaptersListView.deleteChapter(${c.id})" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join('');

    const archivedSection = archived.length > 0 ? `
      <div style="margin-top:20px;">
        <button class="btn btn-ghost btn-sm" onclick="ChaptersListView.toggleArchived()" style="margin-bottom:8px;font-size:12px;">
          <i class="fa-solid fa-box-archive"></i>
          ${_showArchived ? 'Masquer' : 'Afficher'} les ${archived.length} chapitre${archived.length !== 1 ? 's' : ''} archivé${archived.length !== 1 ? 's' : ''}
        </button>
        ${_showArchived ? `<div class="chapter-list">${renderItems(archived, true)}</div>` : ''}
      </div>
    ` : '';

    view.innerHTML = `
      <div class="chapters-view">
        ${stats}
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <button class="btn btn-secondary btn-sm" onclick="ChaptersListView.importWord()">
            <i class="fa-solid fa-file-import"></i> Importer Word
          </button>
        </div>
        <div class="chapter-list" id="chapter-list">${renderItems(active, false)}</div>
        ${archivedSection}
      </div>
    `;
  }

  function toggleArchived() {
    _showArchived = !_showArchived;
    renderList();
  }

  function openChapter(id) {
    window.location.hash = `#/project/${_projectId}/chapter/${id}`;
  }

  function createChapter() {
    Modal.open({
      title: '📖 Nouveau chapitre',
      body: `
        <div class="form-group">
          <label class="form-label">Titre *</label>
          <input class="form-control" data-field="title" placeholder="Titre du chapitre" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Résumé (optionnel)</label>
          <textarea class="form-control" data-field="summary" rows="2" placeholder="Ce qui se passe dans ce chapitre..."></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div class="form-group">
            <label class="form-label">Objectif de mots</label>
            <input class="form-control" type="number" data-field="word_goal" placeholder="0 = pas d'objectif" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Point de vue</label>
            <select class="form-control" data-field="pov">
              <option value="">— PDV —</option>
              <option>1ère personne (je)</option>
              <option>3ème personne omnisciente</option>
              <option>3ème personne limitée</option>
              <option>2ème personne (tu)</option>
              <option>Multiple</option>
            </select>
          </div>
        </div>
      `,
      confirmText: 'Créer',
      async onConfirm(data) {
        if (!data.title.trim()) { Toast.error('Le titre est requis'); return; }
        try {
          const chapter = await API.chapters.create({
            project_id: parseInt(_projectId),
            title: data.title,
            summary: data.summary || '',
            word_goal: parseInt(data.word_goal) || 0,
            pov: data.pov || '',
          });
          // Cacher immédiatement dans localStorage
          _addChapterToCache(_projectId, chapter);
          Modal.close();
          Toast.success('Chapitre créé !');
          window.location.hash = `#/project/${_projectId}/chapter/${chapter.id}`;
        } catch (err) {
          Toast.error(err.message);
        }
      },
    });
  }

  async function archiveChapter(id) {
    try {
      await API.chapters.update(id, { archived: true });
      _chapters = await API.chapters.list(_projectId);
      _saveChaptersCache(_projectId, _chapters);
      renderList();
      Toast.success('Chapitre archivé.');
    } catch (err) { Toast.error(err.message); }
  }

  async function unarchiveChapter(id) {
    try {
      await API.chapters.update(id, { archived: false });
      _chapters = await API.chapters.list(_projectId);
      renderList();
      Toast.success('Chapitre désarchivé.');
    } catch (err) { Toast.error(err.message); }
  }

  async function deleteChapter(id) {
    const chapter = _chapters.find(c => c.id === id);
    Modal.confirm({
      title: `Supprimer "${chapter?.title || 'ce chapitre'}" ?`,
      message: 'Le contenu sera définitivement perdu.',
      danger: true,
      async onConfirm() {
        try {
          await API.chapters.delete(id);
          Modal.close();
          Toast.success('Chapitre supprimé.');
          _chapters = await API.chapters.list(_projectId);
          renderList();
        } catch (err) {
          Toast.error(err.message);
        }
      },
    });
  }

  function exportFormat(format) {
    const m = document.getElementById('export-menu');
    if (m) m.style.display = 'none';
    _showExportModal(format);
  }

  function _showExportModal(format) {
    const labels = { pdf: 'PDF', docx: 'Word (.docx)', md: 'Markdown (.md)', txt: 'Texte brut (.txt)' };
    const icons = { pdf: 'fa-file-pdf', docx: 'fa-file-word', md: 'fa-brands fa-markdown', txt: 'fa-file-lines' };
    const activeChapters = _chapters.filter(c => !c.archived);
    const totalWords = activeChapters.reduce((s, c) => s + (c.word_count || 0), 0);
    const unfinished = activeChapters.filter(c => c.status !== 'terminé').length;
    const empty = activeChapters.filter(c => c.word_count === 0).length;

    const checkItem = (icon, cls, text) =>
      `<div class="export-check-item ${cls}"><i class="fa-solid ${icon}"></i><span>${text}</span></div>`;

    Modal.open({
      title: `<i class="fa-solid ${icons[format]}" style="color:var(--accent);"></i> Exporter en ${labels[format]}`,
      body: `
        <div style="margin-bottom:16px;">
          <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:10px;">
            <i class="fa-solid fa-clipboard-check"></i> Vérification avant export
          </div>
          ${checkItem('fa-book', 'ok', `<strong>${activeChapters.length}</strong> chapitre${activeChapters.length!==1?'s':''} · ${totalWords.toLocaleString('fr-FR')} mots · ≈${Math.ceil(totalWords/250)} pages`)}
          ${unfinished > 0
            ? checkItem('fa-triangle-exclamation', 'warn', `<strong>${unfinished}</strong> chapitre${unfinished!==1?'s':''} pas encore marqué${unfinished!==1?'s':''} "Terminé"`)
            : checkItem('fa-circle-check', 'ok', 'Tous les chapitres sont terminés ✓')}
          ${empty > 0
            ? checkItem('fa-circle-xmark', 'error', `<strong>${empty}</strong> chapitre${empty!==1?'s':''} vide${empty!==1?'s':''}`)
            : checkItem('fa-circle-check', 'ok', 'Aucun chapitre vide ✓')}
        </div>

        ${State.aiConfigured ? `
        <div style="margin-bottom:16px;padding:12px 14px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius);">
          <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">
            <i class="fa-solid fa-glasses" style="color:var(--accent);"></i> Relecture professionnelle IA
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px;line-height:1.5;">
            Lancer une analyse de cohérence, de style et de syntaxe sur l'ensemble des chapitres avant de télécharger.
          </p>
          <button class="btn btn-secondary btn-sm" id="preexport-relecture-btn"
            onclick="ChaptersListView._runPreExportRelecture()" style="border-color:var(--accent);color:var(--accent);">
            <i class="fa-solid fa-magnifying-glass"></i> Analyser le roman avant export
          </button>
          <div id="preexport-result" style="margin-top:10px;font-size:12px;line-height:1.5;color:var(--text-secondary);display:none;max-height:200px;overflow-y:auto;white-space:pre-wrap;"></div>
        </div>
        ` : `
        <div style="padding:10px;background:var(--bg-tertiary);border-radius:var(--radius);font-size:12px;color:var(--text-muted);margin-bottom:16px;">
          <i class="fa-solid fa-circle-info"></i> Configurez une clé API Claude dans <strong>Paramètres</strong> pour activer la relecture IA.
        </div>
        `}

        <div style="font-size:13px;color:var(--text-muted);">
          Format sélectionné : <strong style="color:var(--accent);">${labels[format]}</strong>
        </div>
      `,
      confirmText: `<i class="fa-solid fa-download"></i> Télécharger`,
      async onConfirm() {
        Toast.info('Génération en cours...');
        try {
          let res;
          if (format === 'pdf')  res = await API.export.generatePdf(_projectId);
          if (format === 'docx') res = await API.export.generateDocx(_projectId);
          if (format === 'md')   res = await API.export.generateMarkdown(_projectId);
          if (format === 'txt')  res = await API.export.generateTxt(_projectId);
          const url = URL.createObjectURL(res.blob);
          const a = document.createElement('a');
          a.href = url; a.download = res.filename;
          document.body.appendChild(a); a.click(); a.remove();
          URL.revokeObjectURL(url);
          Modal.close();
          Toast.success(`${labels[format]} téléchargé !`);
        } catch (err) { Toast.error('Erreur export : ' + err.message); }
      },
    });
  }

  async function _runPreExportRelecture() {
    const btn = document.getElementById('preexport-relecture-btn');
    const result = document.getElementById('preexport-result');
    if (!btn || !result) return;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:12px;height:12px;display:inline-block;"></div> Analyse en cours...';
    result.style.display = 'block';
    result.innerHTML = '<div class="spinner" style="display:inline-block;width:14px;height:14px;"></div> Lecture des chapitres...';
    try {
      // Concaténer le contenu de tous les chapitres actifs
      const active = _chapters.filter(c => !c.archived && c.word_count > 0);
      if (!active.length) { result.textContent = '⚠️ Aucun chapitre avec du contenu.'; btn.disabled = false; return; }
      const fullText = active.map(c => {
        const text = (c.content || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
        return `[${c.title}]\n${text}`;
      }).join('\n\n---\n\n').substring(0, 4000); // Limite pour l'API
      const res = await API.ai.review({
        text: fullText,
        project_id: parseInt(_projectId),
        context: _project?.synopsis || '',
      });
      result.innerHTML = `<strong style="color:var(--accent);">📋 Rapport de relecture :</strong>\n\n${res.result || res.text || 'Aucun résultat'}`;
      btn.innerHTML = '<i class="fa-solid fa-check" style="color:#4aaa6a;"></i> Analyse terminée';
    } catch (err) {
      result.textContent = '❌ Erreur : ' + err.message;
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Réessayer';
    }
  }

  // Alias pour compatibilité avec project_hub
  function exportPdf() { exportFormat('pdf'); }

  function editProject() {
    if (!_project) return;
    Modal.open({
      title: '✏️ Modifier le roman',
      body: `
        <div class="form-group">
          <label class="form-label">Titre *</label>
          <input class="form-control" data-field="title" value="${escHtml(_project.title)}">
        </div>
        <div class="form-group">
          <label class="form-label">Sous-titre</label>
          <input class="form-control" data-field="subtitle" value="${escHtml(_project.subtitle)}">
        </div>
        <div class="form-group">
          <label class="form-label">Auteur</label>
          <input class="form-control" data-field="author" value="${escHtml(_project.author)}">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div class="form-group">
            <label class="form-label">Genre</label>
            <input class="form-control" data-field="genre" value="${escHtml(_project.genre)}">
          </div>
          <div class="form-group">
            <label class="form-label">Objectif de mots</label>
            <input class="form-control" type="number" data-field="word_goal" value="${_project.word_goal || 0}" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Temps verbal</label>
            <select class="form-control" data-field="tense">
              <option ${_project.tense === 'passé' ? 'selected' : ''} value="passé">Passé</option>
              <option ${_project.tense === 'présent' ? 'selected' : ''} value="présent">Présent</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">PDV global</label>
            <input class="form-control" data-field="pov" value="${escHtml(_project.pov)}" placeholder="ex: 3ème personne">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Synopsis</label>
          <textarea class="form-control" data-field="synopsis" rows="3">${escHtml(_project.synopsis)}</textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div class="form-group">
            <label class="form-label">Nom de série</label>
            <input class="form-control" data-field="series_name" value="${escHtml(_project.series_name)}" placeholder="Optionnel">
          </div>
          <div class="form-group">
            <label class="form-label">Couleur de couverture</label>
            <input type="color" data-field="cover_color" value="${_project.cover_color}">
          </div>
        </div>
        <hr style="border-color:var(--border);margin:12px 0;">
        <button class="btn btn-danger btn-sm" onclick="ChaptersListView.confirmDeleteProject()">🗑️ Supprimer ce roman</button>
      `,
      confirmText: 'Enregistrer',
      async onConfirm(data) {
        if (!data.title.trim()) { Toast.error('Le titre est requis'); return; }
        try {
          const updated = await API.projects.update(_project.id, {
            ...data,
            word_goal: parseInt(data.word_goal) || 0,
          });
          State.setProject(updated);
          _project = updated;
          Modal.close();
          Toast.success('Roman mis à jour !');
          render(_projectId);
        } catch (err) {
          Toast.error(err.message);
        }
      },
    });
  }

  function confirmDeleteProject() {
    Modal.close();
    Modal.confirm({
      title: 'Supprimer ce roman ?',
      message: `Tout le contenu de "${_project?.title}" sera définitivement supprimé.`,
      danger: true,
      async onConfirm() {
        try {
          await API.projects.delete(_project.id);
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

  // ── Import Word ──────────────────────────────────────────────────────────
  function importWord() {
    Modal.open({
      title: '📂 Importer un fichier Word (.docx)',
      body: `
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;line-height:1.6;">
          Sélectionnez un fichier <strong>.docx</strong>. Chaque section séparée par un titre (Titre 1, Titre 2)
          sera convertie en chapitre.
        </p>
        <div class="form-group">
          <label class="form-label">Fichier Word (.docx) *</label>
          <input type="file" id="word-file-input" accept=".docx,.doc" class="form-control" style="padding:6px;">
        </div>
        <div class="form-group">
          <label class="form-label">Mode d'import</label>
          <select class="form-control" id="import-mode">
            <option value="auto">Automatique (détecter les titres)</option>
            <option value="single">Un seul chapitre</option>
          </select>
        </div>
        <div id="import-preview" style="margin-top:8px;font-size:12px;color:var(--text-muted);"></div>
      `,
      confirmText: '📥 Importer',
      async onConfirm() {
        const fileInput = document.getElementById('word-file-input');
        const mode = document.getElementById('import-mode')?.value || 'auto';
        if (!fileInput || !fileInput.files.length) {
          Toast.error('Sélectionnez un fichier .docx');
          return;
        }
        const file = fileInput.files[0];
        Modal.close();
        await processWordFile(file, mode);
      },
    });

    setTimeout(() => {
      const input = document.getElementById('word-file-input');
      if (input) {
        input.addEventListener('change', () => {
          const preview = document.getElementById('import-preview');
          if (preview && input.files.length) {
            preview.textContent = `Fichier : ${input.files[0].name} (${(input.files[0].size / 1024).toFixed(1)} Ko)`;
          }
        });
      }
    }, 100);
  }

  async function processWordFile(file, mode) {
    Toast.info('Lecture du fichier Word...');
    try {
      const res = await API.importWord.upload(file, _projectId, mode);
      Toast.success(`${res.created} chapitre${res.created !== 1 ? 's' : ''} importé${res.created !== 1 ? 's' : ''} !`);
      _chapters = await API.chapters.list(_projectId);
      // Charger et cacher le contenu complet de chaque chapitre importé
      for (const ch of _chapters) {
        try {
          const full = await API.chapters.get(ch.id);
          if (full.content) _cacheChapterContent(full.id, full.content);
        } catch {}
      }
      _saveChaptersCache(_projectId, _chapters);
      renderList();
      return;
    } catch (backendErr) {
      console.warn('Backend import failed, using mammoth.js fallback:', backendErr.message);
    }

    try {
      await loadMammoth();
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;

      if (mode === 'single') {
        await createChapterFromHtml(file.name.replace(/\.\w+$/, ''), html);
        Toast.success('Chapitre importé !');
        _chapters = await API.chapters.list(_projectId);
        renderList();
      } else {
        await splitIntoChapters(html);
      }
    } catch (err) {
      Toast.error('Erreur lors de la lecture du fichier : ' + err.message);
    }
  }

  async function loadMammoth() {
    if (window.mammoth) return;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Impossible de charger mammoth.js'));
      document.head.appendChild(script);
    });
  }

  async function splitIntoChapters(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;

    let chapters = [];
    let currentTitle = 'Chapitre importé';
    let currentContent = [];
    let hasHeadings = false;

    for (const node of body.childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'H1' || node.tagName === 'H2')) {
        hasHeadings = true;
        if (currentContent.length > 0) {
          chapters.push({ title: currentTitle, content: currentContent.join('') });
        }
        currentTitle = node.textContent.trim() || `Chapitre ${chapters.length + 1}`;
        currentContent = [];
      } else {
        currentContent.push(node.outerHTML || node.textContent);
      }
    }
    if (currentContent.length > 0) {
      chapters.push({ title: currentTitle, content: currentContent.join('') });
    }

    if (!hasHeadings || chapters.length <= 1) {
      await createChapterFromHtml('Document importé', html);
      return;
    }

    let created = 0;
    for (const ch of chapters) {
      if (ch.content.trim()) {
        await createChapterFromHtml(ch.title, ch.content);
        created++;
      }
    }
    Toast.success(`${created} chapitre${created !== 1 ? 's' : ''} importé${created !== 1 ? 's' : ''} !`);
    _chapters = await API.chapters.list(_projectId);
    renderList();
  }

  async function createChapterFromHtml(title, html) {
    try {
      const chapter = await API.chapters.create({
        project_id: parseInt(_projectId),
        title,
        content: html,
      });
      // Sauvegarder le contenu immédiatement (clé par ID ET par titre)
      _cacheChapterContent(chapter.id, html);
      _addChapterToCache(_projectId, chapter);
      return chapter;
    } catch (err) {
      Toast.error(`Erreur lors de la création de "${title}" : ${err.message}`);
    }
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  function onDragStart(e, idx) {
    _dragSrc = idx;
    e.currentTarget.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('active');
  }

  function onDragEnd(e) {
    e.currentTarget.style.opacity = '';
    document.querySelectorAll('.chapter-item').forEach(el => el.classList.remove('active'));
  }

  async function onDrop(e, targetIdx) {
    e.preventDefault();
    if (_dragSrc === null || _dragSrc === targetIdx) return;

    const active = _chapters.filter(c => !c.archived);
    const archived = _chapters.filter(c => c.archived);
    const moved = active.splice(_dragSrc, 1)[0];
    active.splice(targetIdx, 0, moved);
    active.forEach((c, i) => c.order_index = i);
    _chapters = [...active, ...archived];

    renderList();

    try {
      await API.chapters.reorder(active.map(c => ({ id: c.id, order_index: c.order_index })));
    } catch (err) {
      Toast.error('Erreur de réorganisation : ' + err.message);
    }
    _dragSrc = null;
  }

  // ── Cache localStorage ──────────────────────────────────────────────────

  function _loadCachedChapters(projectId) {
    try {
      const raw = localStorage.getItem(`hiba-chapters-${projectId}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function _saveChaptersCache(projectId, chapters) {
    try { localStorage.setItem(`hiba-chapters-${projectId}`, JSON.stringify(chapters)); } catch {}
  }

  function _addChapterToCache(projectId, chapter) {
    const list = _loadCachedChapters(projectId);
    const idx = list.findIndex(c => c.id === chapter.id);
    if (idx >= 0) list[idx] = chapter; else list.push(chapter);
    _saveChaptersCache(projectId, list);
  }

  function _cacheChapterContent(chapterId, content) {
    try {
      localStorage.setItem(`hiba-chapter-${chapterId}`, JSON.stringify({
        content, savedAt: new Date().toISOString()
      }));
    } catch {}
  }

  function _getChapterContent(chapterId) {
    try {
      const raw = localStorage.getItem(`hiba-chapter-${chapterId}`);
      if (!raw) return '';
      const data = JSON.parse(raw);
      return data.content || data; // Compatibilité ancien format
    } catch { return ''; }
  }

  // Re-crée les chapitres sur le serveur depuis le cache local (après reset Vercel)
  async function _resyncChaptersToServer(projectId, cachedChapters) {
    const sorted = [...cachedChapters].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    const newChapters = [];

    for (let i = 0; i < sorted.length; i++) {
      const ch = sorted[i];
      // Récupérer le contenu depuis localStorage (sauvegardé par l'éditeur ou l'import)
      const content = _getChapterContent(ch.id) || ch.content || '';
      try {
        const newCh = await API.chapters.create({
          project_id: parseInt(projectId),
          title: ch.title,
          content,
          status: ch.status || 'brouillon',
          summary: ch.summary || '',
          pov: ch.pov || '',
          order_index: i,
        });
        // Mettre à jour le contenu avec le nouvel ID
        if (content) _cacheChapterContent(newCh.id, content);
        newChapters.push(newCh);
      } catch {}
    }

    _saveChaptersCache(projectId, newChapters);
    Toast.success(`${newChapters.length} chapitre(s) re-synchronisé(s) avec le serveur`);
    return newChapters;
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return {
    render, openChapter, createChapter, deleteChapter, archiveChapter, unarchiveChapter,
    editProject, confirmDeleteProject, toggleArchived,
    exportPdf, exportFormat, toggleExportMenu,
    importWord,
    onDragStart, onDragOver, onDragEnd, onDrop,
    _runPreExportRelecture,
  };
})();
