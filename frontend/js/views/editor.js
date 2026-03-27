/**
 * editor.js — Éditeur Quill avec autosave, correcteur ortho et panneau IA
 */
const EditorView = (() => {
  let _quill = null;
  let _chapter = null;
  let _project = null;
  let _autosaveTimer = null;
  let _isDirty = false;
  let _isSaving = false;
  let _autosaveInterval = 10000; // 10 secondes
  let _spellcheck = true;
  let _focusMode = false;
  let _originalContent = null;   // Contenu avant suggestion IA
  let _suggestionActive = false;

  const POV_OPTIONS = [
    '', '1ère personne (je)', '3ème personne omnisciente',
    '3ème personne limitée', '2ème personne (tu)', 'Multiple',
  ];

  async function render(projectId, chapterId) {
    const view = document.getElementById('view');
    const topbar = document.getElementById('topbar');

    try {
      _project = State.project || await API.projects.get(projectId);
      State.setProject(_project);
    } catch {
      // Projet introuvable sur le serveur → essayer le cache
      try {
        const raw = localStorage.getItem(`hiba-project-${projectId}`);
        _project = raw ? JSON.parse(raw) : null;
        if (!_project) {
          // Essayer aussi la liste complète
          const listRaw = localStorage.getItem('hiba-projects-list');
          if (listRaw) {
            const list = JSON.parse(listRaw);
            _project = list.find(p => p.id == projectId) || null;
          }
        }
      } catch {}
      if (!_project) {
        view.innerHTML = `<p class="text-muted" style="padding:32px">Roman introuvable.</p>`;
        return;
      }
      State.setProject(_project);
    }

    try {
      _chapter = await API.chapters.get(chapterId);
      State.setChapter(_chapter);
    } catch {
      // Chapitre introuvable sur le serveur → chercher dans le cache par ID puis par titre
      try {
        const listRaw = localStorage.getItem(`hiba-chapters-${projectId}`);
        if (listRaw) {
          const list = JSON.parse(listRaw);
          // Chercher par ID exact
          let cached = list.find(c => c.id == chapterId);
          // Si pas trouvé par ID, prendre le premier chapitre disponible
          if (!cached && list.length > 0) cached = list[0];
          if (cached) {
            // Contenu : chercher d'abord par l'ID exact de la liste, puis par chapterId original
            let contentRaw = localStorage.getItem(`hiba-chapter-${cached.id}`)
                          || localStorage.getItem(`hiba-chapter-${chapterId}`);
            const content = contentRaw ? (JSON.parse(contentRaw).content || '') : '';
            _chapter = { ...cached, content };
            State.setChapter(_chapter);
            Toast.info('Contenu chargé depuis la sauvegarde locale');
          }
        }
      } catch {}
      if (!_chapter) {
        view.innerHTML = `<p class="text-muted" style="padding:32px">Chapitre introuvable.</p>`;
        return;
      }
    }

    try {
      const status = await API.ai.status();
      State.setAiConfigured(status.configured);
    } catch {}

    const povOptions = POV_OPTIONS.map(p =>
      `<option value="${p}" ${(_chapter.pov || '') === p ? 'selected' : ''}>${p || '— PDV —'}</option>`
    ).join('');

    topbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/project/${projectId}'">
        <i class="fa-solid fa-arrow-left"></i> Chapitres
      </button>
      <div class="topbar-title" style="font-size:14px;">${escHtml(_chapter.title)}</div>
      <div class="topbar-subtitle" id="editor-word-count">${_chapter.word_count} mots</div>
      <div class="topbar-actions">
        <select class="form-control" style="width:auto;font-size:12px;" title="Point de vue" onchange="EditorView.updatePov(this.value)">
          ${povOptions}
        </select>
        <button class="btn btn-secondary btn-sm" onclick="EditorView.saveNow()" title="Sauvegarder (Ctrl+S)">
          <i class="fa-solid fa-floppy-disk"></i> Sauvegarder
        </button>
        <button class="btn btn-secondary btn-sm" id="ai-toggle-btn" onclick="AIPanel.toggle()" title="Assistant IA">
          <i class="fa-solid fa-wand-magic-sparkles"></i> IA
        </button>
        <select class="form-control" style="width:auto;font-size:12px;" onchange="EditorView.updateStatus(this.value)">
          <option value="brouillon" ${_chapter.status==='brouillon'?'selected':''}>Brouillon</option>
          <option value="en_cours" ${_chapter.status==='en_cours'?'selected':''}>En cours</option>
          <option value="terminé" ${_chapter.status==='terminé'?'selected':''}>Terminé ✓</option>
        </select>
      </div>
    `;

    view.innerHTML = `
      <div class="editor-layout">
        <div class="editor-main">
          <!-- Barre d'outils -->
          <div class="editor-toolbar" id="editor-toolbar">

            <!-- Formatage texte -->
            <button class="ql-toolbar-btn" onclick="EditorView.format('bold')" title="Gras (Ctrl+B)">
              <i class="fa-solid fa-bold"></i>
            </button>
            <button class="ql-toolbar-btn" onclick="EditorView.format('italic')" title="Italique (Ctrl+I)">
              <i class="fa-solid fa-italic"></i>
            </button>
            <button class="ql-toolbar-btn" onclick="EditorView.format('underline')" title="Souligné">
              <i class="fa-solid fa-underline"></i>
            </button>
            <button class="ql-toolbar-btn" onclick="EditorView.format('strike')" title="Barré">
              <i class="fa-solid fa-strikethrough"></i>
            </button>

            <div class="editor-toolbar-sep"></div>

            <!-- Titres -->
            <button class="ql-toolbar-btn" onclick="EditorView.formatBlock('header',1)" title="Titre 1">H1</button>
            <button class="ql-toolbar-btn" onclick="EditorView.formatBlock('header',2)" title="Titre 2">H2</button>
            <button class="ql-toolbar-btn" onclick="EditorView.formatBlock('header',false)" title="Paragraphe">
              <i class="fa-solid fa-paragraph"></i>
            </button>

            <div class="editor-toolbar-sep"></div>

            <!-- Alignement -->
            <button class="ql-toolbar-btn" onclick="EditorView.formatAlign('left')" title="Gauche">
              <i class="fa-solid fa-align-left"></i>
            </button>
            <button class="ql-toolbar-btn" onclick="EditorView.formatAlign('center')" title="Centre">
              <i class="fa-solid fa-align-center"></i>
            </button>
            <button class="ql-toolbar-btn" onclick="EditorView.formatAlign('justify')" title="Justifier">
              <i class="fa-solid fa-align-justify"></i>
            </button>

            <div class="editor-toolbar-sep"></div>

            <!-- Citation & listes -->
            <button class="ql-toolbar-btn" onclick="EditorView.format('blockquote')" title="Citation">
              <i class="fa-solid fa-quote-left"></i>
            </button>
            <button class="ql-toolbar-btn" onclick="EditorView.formatBlock('list','bullet')" title="Liste à puces">
              <i class="fa-solid fa-list-ul"></i>
            </button>
            <button class="ql-toolbar-btn" onclick="EditorView.formatBlock('list','ordered')" title="Liste numérotée">
              <i class="fa-solid fa-list-ol"></i>
            </button>

            <div class="editor-toolbar-sep"></div>

            <!-- Taille de police -->
            <select class="form-control" style="width:auto;font-size:12px;" onchange="EditorView.formatSize(this.value)" title="Taille de police">
              <option value="false">Taille</option>
              <option value="small">Petite</option>
              <option value="false" selected>Normale</option>
              <option value="large">Grande</option>
              <option value="huge">Très grande</option>
            </select>

            <div class="editor-toolbar-sep"></div>

            <!-- Marqueurs de couleur -->
            <span style="font-size:11px;color:var(--text-muted);align-self:center;margin-right:2px;">Surligner :</span>
            <button class="ql-toolbar-btn" style="background:#fff176;color:#333;" onclick="EditorView.highlight('#fff176')" title="Surligner en jaune">A</button>
            <button class="ql-toolbar-btn" style="background:#ff8a80;color:#333;" onclick="EditorView.highlight('#ff8a80')" title="Surligner en rouge">A</button>
            <button class="ql-toolbar-btn" style="background:#69f0ae;color:#333;" onclick="EditorView.highlight('#69f0ae')" title="Surligner en vert">A</button>
            <button class="ql-toolbar-btn" style="background:#80d8ff;color:#333;" onclick="EditorView.highlight('#80d8ff')" title="Surligner en bleu">A</button>
            <button class="ql-toolbar-btn" style="background:#ea80fc;color:#333;" onclick="EditorView.highlight('#ea80fc')" title="Surligner en violet">A</button>
            <button class="ql-toolbar-btn" onclick="EditorView.highlight(false)" title="Effacer le surlignage">✕</button>

            <div class="editor-toolbar-sep"></div>

            <!-- Correcteur orthographique toggle -->
            <button class="ql-toolbar-btn ${_spellcheck ? 'active' : ''}" id="spellcheck-btn"
              onclick="EditorView.toggleSpellcheck()" title="Correcteur orthographique (navigateur)">
              <i class="fa-solid fa-spell-check"></i>
            </button>

            <!-- Mode Focus -->
            <button class="ql-toolbar-btn" id="focus-btn"
              onclick="EditorView.toggleFocus()" title="Mode plein écran (F11)">
              <i class="fa-solid fa-expand"></i>
            </button>

            <!-- Relecture IA — bouton proéminent -->
            <button class="ql-toolbar-btn btn-relecture ${!State.aiConfigured ? 'disabled' : ''}"
              id="relecture-btn"
              onclick="EditorView.runRelecture()"
              title="${State.aiConfigured ? 'Relecture IA — syntaxe, cohérence, style' : 'Clé API requise (Paramètres)'}"
              ${!State.aiConfigured ? 'disabled' : ''}>
              <i class="fa-solid fa-glasses"></i>
              <span style="font-size:12px;margin-left:4px">Relecture IA</span>
            </button>

            <!-- Traduction IA -->
            <button class="ql-toolbar-btn ${!State.aiConfigured ? 'disabled' : ''}"
              id="translate-btn"
              onclick="EditorView.openTranslatePanel()"
              title="${State.aiConfigured ? 'Traduire ce chapitre' : 'Clé API requise (Paramètres)'}"
              ${!State.aiConfigured ? 'disabled' : ''}
              style="margin-left:4px;background:var(--accent-soft,rgba(114,123,87,0.12));">
              <i class="fa-solid fa-language"></i>
              <span style="font-size:12px;margin-left:4px">Traduire</span>
            </button>
          </div>

          <!-- Zone d'écriture -->
          <div class="editor-wrapper">
            <div class="editor-paper">
              <div id="quill-editor" spellcheck="${_spellcheck}"></div>
            </div>
          </div>

          <!-- Barre de suggestion IA (masquée par défaut) -->
          <div id="ai-suggestion-bar" style="display:none;
            position:sticky;bottom:0;z-index:50;
            background:linear-gradient(135deg,var(--accent),#5a6340);
            color:#fff;padding:10px 18px;
            display:none;align-items:center;justify-content:space-between;
            border-top:2px solid rgba(255,255,255,0.2);
            box-shadow:0 -4px 16px rgba(0,0,0,0.15);">
            <span style="font-size:13px;font-weight:600">
              <i class="fa-solid fa-wand-magic-sparkles" style="margin-right:6px"></i>
              Suggestion IA appliquée — que voulez-vous faire ?
            </span>
            <div style="display:flex;gap:8px">
              <button onclick="EditorView.acceptSuggestion()" style="
                background:#fff;color:var(--accent);border:none;border-radius:6px;
                padding:6px 16px;font-size:13px;font-weight:700;cursor:pointer;">
                <i class="fa-solid fa-check"></i> Valider
              </button>
              <button onclick="EditorView.rejectSuggestion()" style="
                background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.4);
                border-radius:6px;padding:6px 16px;font-size:13px;cursor:pointer;">
                <i class="fa-solid fa-rotate-left"></i> Revenir à l'original
              </button>
            </div>
          </div>

          <!-- Barre de statut -->
          <div class="editor-status">
            <div class="editor-status-dot saved" id="save-dot"></div>
            <span id="save-status">Sauvegardé</span>
            <span>•</span>
            <span id="live-word-count">${_chapter.word_count} mots</span>
            ${_chapter.word_goal > 0 ? `
            <span>•</span>
            <span id="wg-progress" style="color:var(--accent);">
              objectif : ${_chapter.word_goal} mots
            </span>
            ` : ''}
            <span>•</span>
            <span id="spellcheck-status" style="color:${_spellcheck?'var(--accent)':'var(--text-muted)'}">
              <i class="fa-solid fa-spell-check"></i> ${_spellcheck ? 'Correcteur actif' : 'Correcteur désactivé'}
            </span>
          </div>
        </div>
      </div>
    `;

    // Initialiser Quill
    _quill = new Quill('#quill-editor', {
      theme: 'snow',
      modules: { toolbar: false },
      placeholder: 'Commencez à écrire votre chapitre...',
    });

    // Activer le spellcheck sur l'éditeur
    _quill.root.setAttribute('spellcheck', _spellcheck);

    // Charger le contenu : depuis l'API ou depuis le cache local si l'API est vide
    if (_chapter.content) {
      _quill.root.innerHTML = _chapter.content;
    } else {
      // Essayer de restaurer depuis localStorage si le serveur n'a pas le contenu
      try {
        const cached = localStorage.getItem(`hiba-chapter-${_chapter.id}`);
        if (cached) {
          const data = JSON.parse(cached);
          if (data.content) {
            _quill.root.innerHTML = data.content;
            Toast.info('Contenu restauré depuis la sauvegarde locale');
            _isDirty = true; // Marquer comme non-sauvegardé pour re-sync
          }
        }
      } catch {}
    }

    // Panneau IA
    AIPanel.init({
      getContent: () => _quill.root.innerText,
      getContext: () => _project ? _project.synopsis : '',
      projectId: parseInt(projectId),
      chapterId: parseInt(chapterId),
    });
    AIPanel.inject(document.querySelector('.editor-layout'));

    _quill.on('text-change', onTextChange);
    document.addEventListener('keydown', onKeyDown);

    const interval = parseInt(localStorage.getItem('autosave_interval') || '30');
    _autosaveInterval = (interval || 30) * 1000;
    startAutosave();

    Sidebar.render();
  }

  function toggleSpellcheck() {
    _spellcheck = !_spellcheck;
    if (_quill) _quill.root.setAttribute('spellcheck', _spellcheck);
    const btn = document.getElementById('spellcheck-btn');
    const status = document.getElementById('spellcheck-status');
    if (btn) btn.classList.toggle('active', _spellcheck);
    if (status) {
      status.style.color = _spellcheck ? 'var(--accent)' : 'var(--text-muted)';
      status.innerHTML = `<i class="fa-solid fa-spell-check"></i> ${_spellcheck ? 'Correcteur actif' : 'Correcteur désactivé'}`;
    }
    Toast.info(_spellcheck ? 'Correcteur orthographique activé' : 'Correcteur orthographique désactivé');
  }

  function toggleFocus() {
    _focusMode = !_focusMode;
    document.body.classList.toggle('focus-mode', _focusMode);
    const btn = document.getElementById('focus-btn');
    if (btn) {
      btn.classList.toggle('active', _focusMode);
      btn.innerHTML = _focusMode
        ? '<i class="fa-solid fa-compress"></i>'
        : '<i class="fa-solid fa-expand"></i>';
      btn.title = _focusMode ? 'Quitter le mode focus (Echap)' : 'Mode plein écran (F11)';
    }
    if (_focusMode) Toast.info('Mode focus activé — Appuyez sur Echap pour quitter');
  }

  function highlight(color) {
    if (!_quill) return;
    _quill.format('background', color || false);
  }

  async function runRelecture() {
    if (!State.aiConfigured) {
      Toast.error('Configurez votre clé API dans Paramètres pour utiliser la relecture IA.');
      return;
    }
    const text = _quill ? _quill.root.innerText : '';
    if (!text.trim()) { Toast.error('Aucun texte à relire'); return; }

    AIPanel.open();
    AIPanel.runRelecture(text, _project?.synopsis || '');
  }

  function onTextChange() {
    _isDirty = true;
    updateWordCount();
    setSaveStatus('unsaved');
  }

  function updateWordCount() {
    const text = _quill.getText();
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const el = document.getElementById('live-word-count');
    if (el) el.textContent = `${words} mots`;
    const el2 = document.getElementById('editor-word-count');
    if (el2) el2.textContent = `${words} mots`;
    // Mise à jour barre objectif
    const wgEl = document.getElementById('wg-progress');
    if (wgEl && _chapter?.word_goal > 0) {
      const pct = Math.min(100, Math.round((words / _chapter.word_goal) * 100));
      wgEl.textContent = `objectif : ${words}/${_chapter.word_goal} mots (${pct}%)`;
      wgEl.style.color = pct >= 100 ? '#4aaa6a' : 'var(--accent)';
    }
  }

  function setSaveStatus(status) {
    const dot = document.getElementById('save-dot');
    const txt = document.getElementById('save-status');
    if (!dot || !txt) return;
    if (status === 'saved') { dot.className = 'editor-status-dot saved'; txt.textContent = 'Sauvegardé'; }
    else if (status === 'saving') { dot.className = 'editor-status-dot saving'; txt.textContent = 'Sauvegarde...'; }
    else { dot.className = 'editor-status-dot'; txt.textContent = 'Non sauvegardé'; }
  }

  function startAutosave() {
    _autosaveTimer = setInterval(() => { if (_isDirty && !_isSaving) saveNow(); }, _autosaveInterval);
  }

  async function saveNow() {
    if (!_chapter || !_quill) return;
    _isSaving = true;
    setSaveStatus('saving');
    const content = _quill.root.innerHTML;
    // Toujours sauvegarder en local d'abord (backup fiable)
    try {
      localStorage.setItem(`hiba-chapter-${_chapter.id}`, JSON.stringify({
        content,
        title: _chapter.title,
        savedAt: new Date().toISOString(),
      }));
      // Mettre aussi à jour la liste des chapitres en cache
      if (_project) {
        const listKey = `hiba-chapters-${_project.id}`;
        const raw = localStorage.getItem(listKey);
        if (raw) {
          const list = JSON.parse(raw);
          const idx = list.findIndex(c => c.id === _chapter.id);
          const words = content.replace(/<[^>]+>/g,' ').split(/\s+/).filter(Boolean).length;
          if (idx >= 0) { list[idx] = { ...list[idx], content: undefined, word_count: words }; }
          localStorage.setItem(listKey, JSON.stringify(list));
        }
      }
    } catch {}
    try {
      await API.chapters.update(_chapter.id, { content, title: _chapter.title });
      _isDirty = false;
      setSaveStatus('saved');
    } catch (err) {
      // 404 = Vercel a réinitialisé la DB → recréer projet + chapitre
      if (err.message && (err.message.includes('404') || err.message.toLowerCase().includes('introuvable'))) {
        try {
          await _resyncToServer(content);
          _isDirty = false;
          setSaveStatus('saved');
        } catch (resyncErr) {
          Toast.error('Erreur serveur — contenu sauvegardé localement');
          setSaveStatus('unsaved');
        }
      } else {
        Toast.error('Erreur serveur — contenu sauvegardé localement');
        setSaveStatus('unsaved');
      }
    } finally { _isSaving = false; }
  }

  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveNow(); }
    if (e.key === 'Escape' && _focusMode) toggleFocus();
    if (e.key === 'F11' && !e.ctrlKey) { e.preventDefault(); toggleFocus(); }
  }

  function format(type) {
    if (!_quill) return;
    _quill.format(type, !_quill.getFormat()[type]);
  }

  function formatBlock(type, value) {
    if (!_quill) return;
    _quill.format(type, value);
  }

  function formatAlign(align) {
    if (!_quill) return;
    _quill.format('align', align === 'left' ? false : align);
  }

  function formatSize(size) {
    if (!_quill) return;
    _quill.format('size', size === 'false' ? false : size);
  }

  async function updateStatus(status) {
    if (!_chapter) return;
    try {
      await API.chapters.update(_chapter.id, { status });
      _chapter.status = status;
    } catch (err) { Toast.error(err.message); }
  }

  async function updatePov(pov) {
    if (!_chapter) return;
    try {
      await API.chapters.update(_chapter.id, { pov });
      _chapter.pov = pov;
    } catch (err) { Toast.error(err.message); }
  }

  // ── Suggestion IA inline ──────────────────────────────────────────────────

  function applyAISuggestion(newText) {
    if (!_quill) return;
    // Sauvegarder l'original avant remplacement
    _originalContent = _quill.root.innerHTML;
    _suggestionActive = true;

    // Remplacer le contenu — convertir le texte brut en HTML paragraphes
    const html = newText
      .split('\n')
      .map(line => line.trim() ? `<p>${line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>` : '')
      .filter(Boolean)
      .join('');
    _quill.root.innerHTML = html || `<p>${newText}</p>`;

    // Afficher la barre de validation
    const bar = document.getElementById('ai-suggestion-bar');
    if (bar) bar.style.display = 'flex';

    // Désactiver l'autosave pendant la suggestion
    if (_autosaveTimer) clearInterval(_autosaveTimer);

    Toast.info('Suggestion appliquée — Validez ou revenez à l\'original');
  }

  function acceptSuggestion() {
    _originalContent = null;
    _suggestionActive = false;
    _isDirty = true;
    const bar = document.getElementById('ai-suggestion-bar');
    if (bar) bar.style.display = 'none';
    saveNow();
    startAutosave();
    Toast.success('Modifications validées et sauvegardées !');
  }

  function rejectSuggestion() {
    if (!_quill || _originalContent === null) return;
    _quill.root.innerHTML = _originalContent;
    _originalContent = null;
    _suggestionActive = false;
    const bar = document.getElementById('ai-suggestion-bar');
    if (bar) bar.style.display = 'none';
    startAutosave();
    Toast.info('Texte original restauré');
  }

  function openTranslatePanel() {
    if (!State.aiConfigured) {
      Toast.error('Configurez votre clé API Claude dans Paramètres.');
      return;
    }
    Modal.open({
      title: '<i class="fa-solid fa-language"></i> Traduire ce chapitre',
      body: `
        <div class="form-group">
          <label class="form-label">Langue cible</label>
          <select class="form-control" id="editor-translate-lang">
            <option value="en">🇬🇧 Anglais</option>
            <option value="ar">🇸🇦 Arabe</option>
            <option value="ja">🇯🇵 Japonais</option>
            <option value="zh">🇨🇳 Chinois (simplifié)</option>
          </select>
        </div>
        <div id="editor-translate-result-area" style="display:none;margin-top:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <label class="form-label" style="margin:0">Traduction</label>
            <button class="btn btn-sm btn-secondary" onclick="EditorView._copyTranslation()">
              <i class="fa-solid fa-copy"></i> Copier
            </button>
          </div>
          <textarea id="editor-translate-result-text" class="form-control" rows="12" readonly
            style="font-size:13px;line-height:1.7;resize:vertical"></textarea>
        </div>
        <div id="editor-translate-loading" style="display:none;text-align:center;padding:24px;color:var(--text-muted)">
          <i class="fa-solid fa-spinner fa-spin" style="font-size:24px;margin-bottom:8px;display:block"></i>
          Traduction en cours...
        </div>
      `,
      confirmText: '<i class="fa-solid fa-language"></i> Traduire',
      cancelText: 'Fermer',
      async onConfirm() {
        const lang = document.getElementById('editor-translate-lang')?.value;
        const loadingEl = document.getElementById('editor-translate-loading');
        const resultArea = document.getElementById('editor-translate-result-area');
        const resultText = document.getElementById('editor-translate-result-text');

        const text = _quill ? _quill.root.innerText : '';
        if (!text.trim()) { Toast.error('Aucun contenu à traduire'); return false; }

        if (loadingEl) loadingEl.style.display = 'block';
        if (resultArea) resultArea.style.display = 'none';

        try {
          const res = await API.ai.translate({
            text,
            language: lang,
            project_id: _project ? _project.id : null,
            chapter_id: _chapter ? _chapter.id : null,
          });
          if (resultText) resultText.value = res.result;
          if (resultArea) resultArea.style.display = 'block';
        } catch (err) {
          Toast.error('Erreur traduction : ' + err.message);
        } finally {
          if (loadingEl) loadingEl.style.display = 'none';
        }
        return false; // Garder le modal ouvert
      },
    });
  }

  function _copyTranslation() {
    const text = document.getElementById('editor-translate-result-text')?.value;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => Toast.success('Copié !'))
      .catch(() => Toast.error('Impossible de copier'));
  }

  function cleanup() {
    if (_autosaveTimer) clearInterval(_autosaveTimer);
    document.removeEventListener('keydown', onKeyDown);
    if (_focusMode) document.body.classList.remove('focus-mode');
    // Si une suggestion est en cours, revenir silencieusement à l'original
    if (_suggestionActive && _originalContent !== null && _quill) {
      _quill.root.innerHTML = _originalContent;
    }
    _quill = null; _chapter = null; _focusMode = false;
    _originalContent = null; _suggestionActive = false;
  }

  // Recrée le projet + chapitre sur le serveur après un reset Vercel
  async function _resyncToServer(content) {
    // 1. Vérifier si le projet existe encore
    let projectId = _project.id;
    try {
      await API.projects.get(projectId);
    } catch {
      // Projet disparu → le recréer
      const newProject = await API.projects.create({
        title: _project.title,
        genre: _project.genre || '',
        synopsis: _project.synopsis || '',
      });
      projectId = newProject.id;
      _project = { ..._project, id: projectId };
      State.setProject(_project);
      // Mettre à jour le cache projets
      try {
        const raw = localStorage.getItem('hiba-projects');
        if (raw) {
          const list = JSON.parse(raw);
          const idx = list.findIndex(p => p.id == _project.id);
          if (idx >= 0) list[idx] = _project; else list.unshift(_project);
          localStorage.setItem('hiba-projects', JSON.stringify(list));
        }
      } catch {}
    }

    // 2. Recréer le chapitre avec son contenu
    const newChapter = await API.chapters.create({
      project_id: projectId,
      title: _chapter.title,
      content,
      status: _chapter.status || 'brouillon',
      summary: _chapter.summary || '',
      pov: _chapter.pov || '',
      order_index: _chapter.order_index || 0,
    });

    // 3. Mettre à jour l'ID local et les caches
    const oldId = _chapter.id;
    _chapter = { ..._chapter, id: newChapter.id, project_id: projectId };
    State.setChapter(_chapter);

    localStorage.setItem(`hiba-chapter-${newChapter.id}`, JSON.stringify({
      content, title: _chapter.title, savedAt: new Date().toISOString()
    }));
    try { localStorage.removeItem(`hiba-chapter-${oldId}`); } catch {}

    // Mettre à jour la liste des chapitres en cache
    try {
      const listKey = `hiba-chapters-${projectId}`;
      const raw = localStorage.getItem(`hiba-chapters-${_project.id}`) || localStorage.getItem(listKey);
      if (raw) {
        const list = JSON.parse(raw);
        const idx = list.findIndex(c => c.id == oldId);
        if (idx >= 0) list[idx] = { ...list[idx], id: newChapter.id, project_id: projectId };
        localStorage.setItem(listKey, JSON.stringify(list));
      }
    } catch {}

    // Mettre à jour l'URL sans recharger
    const newHash = `#/project/${projectId}/chapter/${newChapter.id}`;
    if (window.location.hash !== newHash) {
      history.replaceState(null, '', newHash);
    }
    Toast.success('Reconnecté au serveur — sauvegarde effectuée');
  }

  function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return { render, saveNow, format, formatBlock, formatAlign, formatSize, updateStatus, updatePov,
           toggleSpellcheck, toggleFocus, highlight, runRelecture, cleanup,
           openTranslatePanel, _copyTranslation,
           applyAISuggestion, acceptSuggestion, rejectSuggestion };
})();
