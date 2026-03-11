/**
 * bd_editor.js — Éditeur BD / Collage (Fabric.js)
 * Canvas interactif : bulles, texte, formes, images, surligneur, planches multiples
 */
const BDEditorView = (() => {
  /* ── Constantes ─────────────────────────────────────────────────────────── */
  const CANVAS_W = 750;
  const CANVAS_H = 1060; // A4 approximatif

  // Chemins SVG des bulles de dialogue
  const BUBBLE_PATHS = {
    dialogue: 'M 15 0 H 185 Q 200 0 200 15 V 75 Q 200 90 185 90 H 65 L 40 115 L 55 90 H 15 Q 0 90 0 75 V 15 Q 0 0 15 0 Z',
    pensee:   'M 100 8 C 128 2 155 18 158 44 C 170 42 182 55 178 68 C 188 72 192 86 184 94 C 188 106 178 117 166 114 C 164 126 152 133 140 128 C 135 138 120 140 110 133 C 102 140 90 140 82 133 C 72 140 58 135 55 123 C 43 126 33 116 38 104 C 28 100 24 87 32 78 C 22 72 22 57 33 52 C 28 38 38 26 52 28 C 56 15 72 8 88 13 C 91 7 95 6 100 8 Z',
    action:   'M 100 5 L 112 42 L 148 18 L 122 56 L 162 50 L 134 74 L 165 92 L 125 90 L 140 130 L 105 106 L 100 148 L 95 106 L 60 130 L 75 90 L 35 92 L 66 74 L 38 50 L 78 56 L 52 18 L 88 42 Z',
  };

  /* ── État ────────────────────────────────────────────────────────────────── */
  let _projectId = null;
  let _canvas = null;
  let _tool = 'select';
  let _pages = [];
  let _pageIdx = 0;
  let _history = [];
  let _historyIdx = -1;
  let _historyEnabled = true;
  let _keyHandler = null;
  let _saveTimer = null;

  /* ── Stockage (localStorage) ─────────────────────────────────────────────── */
  function _storageKey() { return `bd_${_projectId}`; }

  function _save() {
    if (!_canvas || !_projectId) return;
    const json = JSON.stringify(_canvas.toJSON(['selectable', 'evented']));
    _pages[_pageIdx] = json;
    try { localStorage.setItem(_storageKey(), JSON.stringify(_pages)); } catch {}
  }

  function _load() {
    try {
      const raw = localStorage.getItem(_storageKey());
      _pages = raw ? JSON.parse(raw) : [null];
    } catch { _pages = [null]; }
    _pageIdx = 0;
  }

  function _loadPage(idx) {
    if (!_canvas) return;
    _pageIdx = Math.max(0, Math.min(idx, _pages.length - 1));
    _historyEnabled = false;
    const json = _pages[_pageIdx];
    if (json) {
      _canvas.loadFromJSON(json, () => {
        _canvas.renderAll();
        _historyEnabled = true;
        _pushHistory();
        _updatePageBar();
      });
    } else {
      _canvas.clear();
      _canvas.setBackgroundColor('#ffffff', () => {
        _canvas.renderAll();
        _historyEnabled = true;
        _pushHistory();
        _updatePageBar();
      });
    }
  }

  /* ── Historique Undo/Redo ─────────────────────────────────────────────────── */
  function _pushHistory() {
    if (!_historyEnabled || !_canvas) return;
    const json = JSON.stringify(_canvas.toJSON(['selectable', 'evented']));
    _history = _history.slice(0, _historyIdx + 1);
    _history.push(json);
    if (_history.length > 50) { _history.shift(); } // limite
    _historyIdx = _history.length - 1;
  }

  function _undo() {
    if (_historyIdx <= 0) return;
    _historyIdx--;
    _historyEnabled = false;
    _canvas.loadFromJSON(_history[_historyIdx], () => {
      _canvas.renderAll();
      _historyEnabled = true;
    });
  }

  function _redo() {
    if (_historyIdx >= _history.length - 1) return;
    _historyIdx++;
    _historyEnabled = false;
    _canvas.loadFromJSON(_history[_historyIdx], () => {
      _canvas.renderAll();
      _historyEnabled = true;
    });
  }

  /* ── Propriétés depuis la barre ──────────────────────────────────────────── */
  function _getProps() {
    return {
      fill:        document.getElementById('bd-fill')?.value        || '#ffffff',
      stroke:      document.getElementById('bd-stroke')?.value      || '#000000',
      strokeWidth: parseInt(document.getElementById('bd-stroke-w')?.value || '2'),
      fontSize:    parseInt(document.getElementById('bd-font-size')?.value || '18'),
      fontFamily:  document.getElementById('bd-font')?.value        || 'Comic Sans MS',
      bold:        document.getElementById('bd-bold')?.checked      || false,
      italic:      document.getElementById('bd-italic')?.checked    || false,
    };
  }

  /* ── Création d'objets ───────────────────────────────────────────────────── */
  function _addText(left = 100, top = 100) {
    const p = _getProps();
    const t = new fabric.IText('Texte…', {
      left, top,
      fontSize:    p.fontSize,
      fontFamily:  p.fontFamily,
      fontWeight:  p.bold   ? 'bold'   : 'normal',
      fontStyle:   p.italic ? 'italic' : 'normal',
      fill:        p.stroke,
      editable:    true,
    });
    _canvas.add(t);
    _canvas.setActiveObject(t);
    t.enterEditing();
    _canvas.renderAll();
  }

  function _addBubble(type, left = 80, top = 80) {
    const p = _getProps();
    const path = new fabric.Path(BUBBLE_PATHS[type] || BUBBLE_PATHS.dialogue, {
      left, top,
      fill:        p.fill,
      stroke:      p.stroke,
      strokeWidth: p.strokeWidth,
      scaleX: 1.6,
      scaleY: 1.4,
    });
    _canvas.add(path);
    // Texte centré dans la bulle
    const text = new fabric.IText('…', {
      left: left + 40,
      top:  top + 30,
      fontSize:   p.fontSize,
      fontFamily: p.fontFamily,
      fill:       '#000000',
      editable:   true,
    });
    _canvas.add(text);
    _canvas.setActiveObject(text);
    text.enterEditing();
    _canvas.renderAll();
  }

  function _addRect(left = 50, top = 50) {
    const p = _getProps();
    _canvas.add(new fabric.Rect({
      left, top, width: 200, height: 150,
      fill: p.fill, stroke: p.stroke, strokeWidth: p.strokeWidth,
    }));
    _canvas.renderAll();
  }

  function _addEllipse(left = 50, top = 50) {
    const p = _getProps();
    _canvas.add(new fabric.Ellipse({
      left, top, rx: 100, ry: 60,
      fill: p.fill, stroke: p.stroke, strokeWidth: p.strokeWidth,
    }));
    _canvas.renderAll();
  }

  function _addLine(left = 50, top = 50) {
    const p = _getProps();
    _canvas.add(new fabric.Line([0, 0, 200, 0], {
      left, top,
      stroke: p.stroke, strokeWidth: p.strokeWidth,
    }));
    _canvas.renderAll();
  }

  function _addHighlight(left = 80, top = 80) {
    const p = _getProps();
    _canvas.add(new fabric.Rect({
      left, top, width: 240, height: 32,
      fill:        p.fill,
      opacity:     0.38,
      stroke:      'transparent',
      strokeWidth: 0,
    }));
    _canvas.renderAll();
  }

  function _deleteSelected() {
    if (!_canvas) return;
    const obj = _canvas.getActiveObject();
    if (!obj) return;
    if (obj.type === 'activeSelection') {
      obj.forEachObject(o => _canvas.remove(o));
      _canvas.discardActiveObject();
    } else {
      _canvas.remove(obj);
    }
    _canvas.renderAll();
  }

  function _triggerImageUpload() {
    const input = document.getElementById('bd-image-input');
    if (input) input.click();
  }

  function _handleImageFile(file) {
    if (!file || !_canvas) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      fabric.Image.fromURL(e.target.result, (img) => {
        const maxW = 360;
        if (img.width > maxW) img.scaleToWidth(maxW);
        img.set({ left: 80, top: 80 });
        _canvas.add(img);
        _canvas.setActiveObject(img);
        _canvas.renderAll();
      });
    };
    reader.readAsDataURL(file);
  }

  /* ── Événement clic canvas ───────────────────────────────────────────────── */
  function _canvasClick(opt) {
    if (_tool === 'select') return;
    if (_tool === 'del') {
      if (opt.target) { _canvas.remove(opt.target); _canvas.renderAll(); }
      return;
    }
    const ptr = _canvas.getPointer(opt.e);
    const x = ptr.x, y = ptr.y;
    switch (_tool) {
      case 'text':     _addText(x, y);              break;
      case 'dialogue': _addBubble('dialogue', x, y); break;
      case 'pensee':   _addBubble('pensee',   x, y); break;
      case 'action':   _addBubble('action',   x, y); break;
      case 'rect':     _addRect(x, y);               break;
      case 'ellipse':  _addEllipse(x, y);            break;
      case 'line':     _addLine(x, y);               break;
      case 'highlight':_addHighlight(x, y);          break;
    }
  }

  /* ── Sélection d'outil ──────────────────────────────────────────────────── */
  function _setTool(t) {
    _tool = t;
    _canvas.selection = (t === 'select');
    _canvas.defaultCursor = t === 'del' ? 'not-allowed' : t === 'select' ? 'default' : 'crosshair';
    document.querySelectorAll('.bd-tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === t);
    });
  }

  /* ── Gestion des planches ─────────────────────────────────────────────────── */
  function _addPage() {
    _save();
    _pages.push(null);
    const newIdx = _pages.length - 1;
    localStorage.setItem(_storageKey(), JSON.stringify(_pages));
    _loadPage(newIdx);
  }

  function _deletePage() {
    if (_pages.length <= 1) { Toast.error('Impossible de supprimer la seule planche.'); return; }
    _pages.splice(_pageIdx, 1);
    const newIdx = Math.min(_pageIdx, _pages.length - 1);
    localStorage.setItem(_storageKey(), JSON.stringify(_pages));
    _pageIdx = newIdx;
    _loadPage(_pageIdx);
  }

  function _updatePageBar() {
    const bar = document.getElementById('bd-pages-bar');
    if (!bar) return;
    bar.innerHTML = _pages.map((_, i) => `
      <button class="bd-page-thumb ${i === _pageIdx ? 'active' : ''}"
              onclick="BDEditorView.goToPage(${i})" title="Planche ${i + 1}">
        <span class="bd-page-num">${i + 1}</span>
      </button>
    `).join('') + `
      <button class="bd-page-add" onclick="BDEditorView.addPage()" title="Nouvelle planche">+</button>
    `;
  }

  /* ── Export PNG ──────────────────────────────────────────────────────────── */
  function _exportPNG() {
    _save();
    const dataURL = _canvas.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `planche-${_pageIdx + 1}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    Toast.success(`Planche ${_pageIdx + 1} exportée !`);
  }

  /* ── Propriétés sélection ─────────────────────────────────────────────────── */
  function _updatePropsFromSelection() {
    const obj = _canvas.getActiveObject();
    if (!obj) return;
    const fillEl     = document.getElementById('bd-fill');
    const strokeEl   = document.getElementById('bd-stroke');
    const strokeWEl  = document.getElementById('bd-stroke-w');
    const fontSzEl   = document.getElementById('bd-font-size');
    const fontEl     = document.getElementById('bd-font');
    const boldEl     = document.getElementById('bd-bold');
    const italicEl   = document.getElementById('bd-italic');
    if (fillEl   && obj.fill   && typeof obj.fill === 'string' && obj.fill.startsWith('#')) fillEl.value = obj.fill;
    if (strokeEl && obj.stroke && typeof obj.stroke === 'string' && obj.stroke.startsWith('#')) strokeEl.value = obj.stroke;
    if (strokeWEl) strokeWEl.value = obj.strokeWidth ?? 2;
    if (obj.type === 'i-text' || obj.type === 'text') {
      if (fontSzEl)  fontSzEl.value  = obj.fontSize  || 18;
      if (fontEl)    fontEl.value    = obj.fontFamily || 'Comic Sans MS';
      if (boldEl)    boldEl.checked  = obj.fontWeight === 'bold';
      if (italicEl)  italicEl.checked = obj.fontStyle === 'italic';
    }
  }

  function _applyPropsToSelection() {
    const obj = _canvas.getActiveObject();
    if (!obj) return;
    const p = _getProps();
    if (obj.type === 'i-text' || obj.type === 'text') {
      obj.set({
        fontSize:   p.fontSize,
        fontFamily: p.fontFamily,
        fontWeight: p.bold   ? 'bold'   : 'normal',
        fontStyle:  p.italic ? 'italic' : 'normal',
        fill:       p.stroke,
      });
    } else {
      obj.set({ fill: p.fill, stroke: p.stroke, strokeWidth: p.strokeWidth });
    }
    _canvas.renderAll();
  }

  /* ── Ordre des objets ────────────────────────────────────────────────────── */
  function _bringForward() {
    const obj = _canvas.getActiveObject();
    if (obj) { _canvas.bringForward(obj); _canvas.renderAll(); }
  }
  function _sendBackward() {
    const obj = _canvas.getActiveObject();
    if (obj) { _canvas.sendBackwards(obj); _canvas.renderAll(); }
  }

  /* ── Rendu de la vue ─────────────────────────────────────────────────────── */
  async function render(projectId) {
    _projectId = projectId;
    _history = [];
    _historyIdx = -1;
    _tool = 'select';
    _historyEnabled = true;

    let project = State.project;
    if (!project || String(project.id) !== String(projectId)) {
      try { project = await API.projects.get(projectId); State.setProject(project); } catch {}
    }

    const topbar = document.getElementById('topbar');
    const view   = document.getElementById('view');

    topbar.innerHTML = `
      <div class="topbar-title">
        <i class="fa-solid fa-palette" style="color:var(--accent);margin-right:8px;"></i>
        BD / Collage
        <span style="font-weight:400;color:var(--text-muted);margin-left:8px;font-size:13px;">— ${project?.title || ''}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span id="bd-page-info" style="font-size:12px;color:var(--text-muted);"></span>
        <button class="btn btn-secondary" onclick="BDEditorView.exportPNG()" style="font-size:12px;padding:5px 12px;">
          <i class="fa-solid fa-download"></i> PNG
        </button>
        <button class="btn btn-secondary" onclick="BDEditorView.deletePage()" style="font-size:12px;padding:5px 12px;color:var(--danger);">
          <i class="fa-solid fa-trash"></i> Planche
        </button>
      </div>
    `;

    view.innerHTML = `
      <div class="bd-editor-view" id="bd-editor-root">

        <!-- Toolbar gauche -->
        <div class="bd-toolbar-left">
          <div class="bd-tool-group">
            <button class="bd-tool-btn active" data-tool="select"
                    onclick="BDEditorView.setTool('select')" title="Sélection (V)">
              <i class="fa-solid fa-arrow-pointer"></i>
            </button>
          </div>
          <div class="bd-tool-sep"></div>

          <div class="bd-tool-label">Texte</div>
          <div class="bd-tool-group">
            <button class="bd-tool-btn" data-tool="text"
                    onclick="BDEditorView.setTool('text')" title="Texte libre (T)">
              <i class="fa-solid fa-t"></i>
            </button>
          </div>
          <div class="bd-tool-sep"></div>

          <div class="bd-tool-label">Bulles</div>
          <div class="bd-tool-group">
            <button class="bd-tool-btn" data-tool="dialogue"
                    onclick="BDEditorView.setTool('dialogue')" title="Bulle dialogue">
              <i class="fa-solid fa-comment"></i>
            </button>
            <button class="bd-tool-btn" data-tool="pensee"
                    onclick="BDEditorView.setTool('pensee')" title="Bulle pensée">
              <i class="fa-solid fa-cloud"></i>
            </button>
            <button class="bd-tool-btn" data-tool="action"
                    onclick="BDEditorView.setTool('action')" title="Onomatopée / Action">
              <i class="fa-solid fa-star"></i>
            </button>
          </div>
          <div class="bd-tool-sep"></div>

          <div class="bd-tool-label">Formes</div>
          <div class="bd-tool-group">
            <button class="bd-tool-btn" data-tool="rect"
                    onclick="BDEditorView.setTool('rect')" title="Case BD (R)">
              <i class="fa-regular fa-square"></i>
            </button>
            <button class="bd-tool-btn" data-tool="ellipse"
                    onclick="BDEditorView.setTool('ellipse')" title="Ellipse (E)">
              <i class="fa-regular fa-circle"></i>
            </button>
            <button class="bd-tool-btn" data-tool="line"
                    onclick="BDEditorView.setTool('line')" title="Ligne">
              <i class="fa-solid fa-minus"></i>
            </button>
          </div>
          <div class="bd-tool-sep"></div>

          <div class="bd-tool-label">Médias</div>
          <div class="bd-tool-group">
            <button class="bd-tool-btn" data-tool="highlight"
                    onclick="BDEditorView.setTool('highlight')" title="Surligneur">
              <i class="fa-solid fa-highlighter"></i>
            </button>
            <button class="bd-tool-btn" data-tool="image"
                    onclick="BDEditorView.triggerImage()" title="Insérer image">
              <i class="fa-regular fa-image"></i>
            </button>
          </div>
          <div class="bd-tool-sep"></div>

          <div class="bd-tool-group">
            <button class="bd-tool-btn bd-undo-btn" onclick="BDEditorView.undo()" title="Annuler (Ctrl+Z)">
              <i class="fa-solid fa-rotate-left"></i>
            </button>
            <button class="bd-tool-btn bd-redo-btn" onclick="BDEditorView.redo()" title="Rétablir (Ctrl+Y)">
              <i class="fa-solid fa-rotate-right"></i>
            </button>
          </div>
          <div class="bd-tool-sep"></div>

          <div class="bd-tool-group">
            <button class="bd-tool-btn bd-del-btn" data-tool="del"
                    onclick="BDEditorView.setTool('del')" title="Supprimer objet (Suppr)">
              <i class="fa-solid fa-eraser"></i>
            </button>
          </div>
        </div>

        <!-- Zone principale -->
        <div class="bd-main-area">

          <!-- Barre de propriétés -->
          <div class="bd-props-bar">
            <label class="bd-prop-label" title="Remplissage">
              <span>Fond</span>
              <input type="color" id="bd-fill" value="#ffffff" onchange="BDEditorView.applyProps()">
            </label>
            <label class="bd-prop-label" title="Couleur trait">
              <span>Trait</span>
              <input type="color" id="bd-stroke" value="#000000" onchange="BDEditorView.applyProps()">
            </label>
            <label class="bd-prop-label" title="Épaisseur trait">
              <span>Px</span>
              <input type="number" id="bd-stroke-w" value="2" min="0" max="20"
                     class="bd-prop-input" style="width:46px;" onchange="BDEditorView.applyProps()">
            </label>
            <div class="bd-props-sep"></div>
            <label class="bd-prop-label" title="Taille police">
              <span>Taille</span>
              <input type="number" id="bd-font-size" value="18" min="6" max="120"
                     class="bd-prop-input" style="width:52px;" onchange="BDEditorView.applyProps()">
            </label>
            <label class="bd-prop-label" title="Police">
              <span>Police</span>
              <select id="bd-font" class="bd-prop-input" onchange="BDEditorView.applyProps()">
                <option value="Comic Sans MS">Comic Sans MS</option>
                <option value="Arial">Arial</option>
                <option value="Impact">Impact</option>
                <option value="Georgia">Georgia</option>
                <option value="Courier New">Courier New</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Verdana">Verdana</option>
              </select>
            </label>
            <label class="bd-prop-label bd-prop-checkbox" title="Gras">
              <input type="checkbox" id="bd-bold" onchange="BDEditorView.applyProps()">
              <b style="font-size:13px;">G</b>
            </label>
            <label class="bd-prop-label bd-prop-checkbox" title="Italique">
              <input type="checkbox" id="bd-italic" onchange="BDEditorView.applyProps()">
              <i style="font-size:13px;">I</i>
            </label>
            <div class="bd-props-sep"></div>
            <button class="bd-prop-btn" onclick="BDEditorView.bringForward()" title="Mettre au premier plan">
              ▲ Avant
            </button>
            <button class="bd-prop-btn" onclick="BDEditorView.sendBackward()" title="Mettre en arrière-plan">
              ▼ Arrière
            </button>
            <div class="bd-props-sep"></div>
            <button class="bd-prop-btn" onclick="BDEditorView.deleteSelected()" title="Supprimer la sélection (Suppr)" style="color:var(--danger);">
              <i class="fa-solid fa-trash"></i> Supprimer
            </button>
          </div>

          <!-- Zone de défilement du canvas -->
          <div class="bd-canvas-scroll">
            <div class="bd-canvas-wrap">
              <canvas id="bd-canvas"></canvas>
            </div>
          </div>

          <!-- Barre des planches -->
          <div class="bd-pages-bar" id="bd-pages-bar"></div>
        </div>

        <!-- Input fichier image caché -->
        <input type="file" id="bd-image-input" accept="image/*" style="display:none"
               onchange="BDEditorView.handleImageInput(this.files[0])">
      </div>
    `;

    /* ── Initialisation Fabric.js ── */
    _canvas = new fabric.Canvas('bd-canvas', {
      width:           CANVAS_W,
      height:          CANVAS_H,
      backgroundColor: '#ffffff',
      selection:       true,
    });

    // Charger les pages et afficher la première
    _load();
    _loadPage(0);

    // Événements canvas
    _canvas.on('mouse:down',        _canvasClick);
    _canvas.on('object:modified',   () => _pushHistory());
    _canvas.on('selection:created', _updatePropsFromSelection);
    _canvas.on('selection:updated', _updatePropsFromSelection);

    // Autosave toutes les 30s
    _saveTimer = setInterval(() => _save(), 30000);

    // Raccourcis clavier
    _keyHandler = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Ctrl+Z / Ctrl+Y
      if (e.ctrlKey && e.key === 'z') { _undo(); e.preventDefault(); return; }
      if (e.ctrlKey && e.key === 'y') { _redo(); e.preventDefault(); return; }
      // Outils rapides (sans modificateur)
      if (!e.ctrlKey && !e.altKey) {
        if (e.key === 'Delete' || e.key === 'Backspace') { _deleteSelected(); e.preventDefault(); }
        if (e.key === 'v' || e.key === 'V') _setTool('select');
        if (e.key === 't' || e.key === 'T') _setTool('text');
        if (e.key === 'r' || e.key === 'R') _setTool('rect');
        if (e.key === 'e' || e.key === 'E') _setTool('ellipse');
      }
    };
    document.addEventListener('keydown', _keyHandler);
  }

  /* ── Nettoyage ───────────────────────────────────────────────────────────── */
  function cleanup() {
    if (_saveTimer) { clearInterval(_saveTimer); _saveTimer = null; }
    if (_keyHandler) { document.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
    if (_canvas) { _save(); _canvas.dispose(); _canvas = null; }
  }

  /* ── API publique ────────────────────────────────────────────────────────── */
  return {
    render,
    cleanup,
    setTool:          _setTool,
    addPage:          _addPage,
    deletePage:       _deletePage,
    goToPage:         (i) => { _save(); _loadPage(i); },
    exportPNG:        _exportPNG,
    undo:             _undo,
    redo:             _redo,
    triggerImage:     _triggerImageUpload,
    handleImageInput: _handleImageFile,
    applyProps:       _applyPropsToSelection,
    bringForward:     _bringForward,
    sendBackward:     _sendBackward,
    deleteSelected:   _deleteSelected,
  };
})();
