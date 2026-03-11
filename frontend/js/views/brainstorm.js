/**
 * brainstorm.js — Carte mentale interactive
 */
const BrainstormView = (() => {
  let _projectId = null;
  let _nodes     = [];
  let _edges     = [];
  let _selected  = null;
  let _dragging  = null;
  let _dragOffset = { x: 0, y: 0 };
  let _connecting = null;   // null = off, -1 = attente source, id = attente cible
  let _nextId    = 1;
  let _canvas    = null;
  let _svg       = null;

  const STORAGE_KEY = () => `hiba-brainstorm-${_projectId}`;

  const NODE_TYPES = {
    character: { icon: '👤', color: '#e8d5b0', border: '#c4a96e' },
    location:  { icon: '📍', color: '#d0e8d5', border: '#6ea87a' },
    event:     { icon: '⚡', color: '#e8d0e0', border: '#a86ea0' },
    idea:      { icon: '💡', color: '#d0dce8', border: '#6e8aa8' },
    group:     { icon: '👥', color: '#e0e8d0', border: '#8aa86e' },
  };

  /* ── Vue ────────────────────────────────────────────────────────────────── */
  async function render(projectId) {
    _projectId = projectId;
    const view   = document.getElementById('view');
    const topbar = document.getElementById('topbar');

    let project = State.project;
    if (!project) try { project = await API.projects.get(projectId); State.setProject(project); } catch {}

    topbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/project/${projectId}/hub'">
        <i class="fa-solid fa-arrow-left"></i> Projet
      </button>
      <div class="topbar-title">Brainstorming — ${esc(project?.title || '')}</div>
      <div class="topbar-actions">
        <button class="btn btn-secondary btn-sm" onclick="BrainstormView.importFromProject()">
          <i class="fa-solid fa-wand-magic-sparkles"></i> Importer
        </button>
        <button class="btn btn-secondary btn-sm" onclick="BrainstormView.clearAll()">
          <i class="fa-solid fa-trash"></i> Effacer tout
        </button>
      </div>
    `;

    view.innerHTML = `
      <div class="brainstorm-view">

        <div class="brainstorm-toolbar">
          <span style="font-size:12px;color:var(--text-muted)">Ajouter :</span>
          ${Object.entries(NODE_TYPES).map(([type, cfg]) => `
            <button class="btn btn-secondary btn-sm" onclick="BrainstormView.addNode('${type}')">
              ${cfg.icon} ${type}
            </button>
          `).join('')}
          <div style="flex:1"></div>
          <button class="btn btn-secondary btn-sm" id="bs-connect-btn" onclick="BrainstormView.toggleConnect()">
            <i class="fa-solid fa-link"></i> Relier
          </button>
          <span id="bs-connect-hint" style="font-size:11px;color:var(--text-muted)"></span>
          <button class="btn btn-secondary btn-sm" onclick="BrainstormView.save()">
            <i class="fa-solid fa-floppy-disk"></i> Sauvegarder
          </button>
        </div>

        <div class="brainstorm-canvas" id="bs-canvas">
          <svg id="bs-svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1"></svg>
        </div>

        <div style="padding:5px 16px;font-size:11px;color:var(--text-muted);background:var(--bg-secondary);border-top:1px solid var(--border);">
          Glisser = déplacer · Double-clic = renommer · Bouton <b style="color:#8B1A1A">✏</b> = modifier · Bouton <b style="color:#c0392b">✕</b> = supprimer · Clic connexion = supprimer
        </div>

      </div>
    `;

    _canvas = document.getElementById('bs-canvas');
    _svg    = document.getElementById('bs-svg');

    _canvas.addEventListener('click',     onCanvasClick);
    _canvas.addEventListener('mousedown', onCanvasMouseDown);
    _canvas.addEventListener('dblclick',  onCanvasDblClick);

    load();
    Sidebar.render();
  }

  /* ── Persistance ────────────────────────────────────────────────────────── */
  function save() {
    localStorage.setItem(STORAGE_KEY(), JSON.stringify({ nodes: _nodes, edges: _edges, nextId: _nextId }));
    Toast.success('Carte sauvegardée.');
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY());
      if (raw) { const d = JSON.parse(raw); _nodes = d.nodes||[]; _edges = d.edges||[]; _nextId = d.nextId||1; }
    } catch {}
    renderAll();
  }

  function clearAll() {
    Modal.confirm({
      title: 'Effacer la carte ?', message: 'Tous les nœuds et connexions seront supprimés.', danger: true,
      onConfirm() {
        _nodes = []; _edges = []; _nextId = 1;
        Modal.close(); localStorage.removeItem(STORAGE_KEY()); renderAll(); Toast.success('Carte effacée.');
      },
    });
  }

  /* ── Import ─────────────────────────────────────────────────────────────── */
  async function importFromProject() {
    Toast.info('Import en cours...');
    try {
      const [chars, locs] = await Promise.all([API.characters.list(_projectId), API.locations.list(_projectId)]);
      let cx = 80, cy = 60;
      for (const c of chars) {
        if (!_nodes.find(n => n.src === `c${c.id}`)) {
          _nodes.push({ id: _nextId++, x: cx, y: cy, label: c.name, type: 'character',
            color: NODE_TYPES.character.color, border: NODE_TYPES.character.border, src: `c${c.id}` });
          cx += 160; if (cx > 680) { cx = 80; cy += 100; }
        }
      }
      cx = 80; cy += 120;
      for (const l of locs) {
        if (!_nodes.find(n => n.src === `l${l.id}`)) {
          _nodes.push({ id: _nextId++, x: cx, y: cy, label: l.name, type: 'location',
            color: NODE_TYPES.location.color, border: NODE_TYPES.location.border, src: `l${l.id}` });
          cx += 160; if (cx > 680) { cx = 80; cy += 100; }
        }
      }
      renderAll();
      Toast.success(`${chars.length} personnages, ${locs.length} lieux importés.`);
    } catch (err) { Toast.error(err.message); }
  }

  /* ── Ajout nœud ─────────────────────────────────────────────────────────── */
  function addNode(type) {
    const cfg  = NODE_TYPES[type] || NODE_TYPES.idea;
    const rect = _canvas ? _canvas.getBoundingClientRect() : { width: 800, height: 500 };
    const node = {
      id: _nextId++, type,
      x: 60 + Math.random() * Math.max(50, rect.width  - 180),
      y: 40 + Math.random() * Math.max(50, rect.height - 120),
      label: 'Nouveau ' + type,
      color: cfg.color, border: cfg.border,
    };
    _nodes.push(node);
    _selected = node.id;
    renderAll();
    // Ouvrir immédiatement l'édition pour taper le nom
    setTimeout(() => openEdit(node.id), 30);
  }

  /* ── Rendu ──────────────────────────────────────────────────────────────── */
  function renderAll() {
    if (!_canvas) return;
    _canvas.querySelectorAll('.bs-node').forEach(el => el.remove());

    for (const node of _nodes) {
      const cfg = NODE_TYPES[node.type] || NODE_TYPES.idea;
      const el  = document.createElement('div');
      el.className  = 'bs-node' + (_selected === node.id ? ' selected' : '');
      el.id         = 'bsn-' + node.id;
      el.dataset.id = node.id;
      el.style.cssText = `left:${node.x}px;top:${node.y}px;background:${node.color};border:2px solid ${node.border};`;

      el.innerHTML =
        `<span class="bsn-icon">${cfg.icon}</span>` +
        `<span class="bsn-label">${esc(node.label)}</span>` +
        `<button class="bsn-btn bsn-edit" data-action="edit" data-id="${node.id}" title="Modifier le nom">✏</button>` +
        `<button class="bsn-btn bsn-del"  data-action="del"  data-id="${node.id}" title="Supprimer">✕</button>`;

      _canvas.appendChild(el);
    }

    renderEdges();
  }

  /* ── Délégation de clics sur le canvas ──────────────────────────────────── */
  function onCanvasClick(e) {
    // Clic sur un bouton action (edit / del) — via data-action
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const action = btn.dataset.action;
      const id     = parseInt(btn.dataset.id);
      if (action === 'edit') { openEdit(id); }
      if (action === 'del')  { deleteNode(id); }
      return;
    }

    // Clic sur fond = désélectionner / annuler connexion
    const onNode = e.target.closest('.bs-node');
    if (!onNode) {
      _selected = null;
      if (_connecting !== null) { _connecting = null; updateConnectUI(); }
      _canvas.querySelectorAll('.bs-node').forEach(n => n.classList.remove('selected'));
    }
  }

  function onCanvasDblClick(e) {
    const nodeEl = e.target.closest('.bs-node');
    if (nodeEl && !e.target.closest('[data-action]')) {
      openEdit(parseInt(nodeEl.dataset.id));
    }
  }

  /* ── Drag & sélection (mousedown sur canvas) ────────────────────────────── */
  function onCanvasMouseDown(e) {
    // Ignorer les boutons d'action et les inputs
    if (e.target.closest('[data-action]')) return;
    if (e.target.tagName === 'INPUT')       return;

    const nodeEl = e.target.closest('.bs-node');
    if (!nodeEl) return;

    const id   = parseInt(nodeEl.dataset.id);
    const node = _nodes.find(n => n.id === id);
    if (!node) return;

    // Mode connexion
    if (_connecting !== null) {
      if (_connecting === -1) {
        // Définir la source
        _connecting = id;
        document.getElementById('bs-connect-hint').textContent = `${node.label} → cliquez la cible`;
      } else if (_connecting !== id) {
        // Définir la cible
        const lbl = prompt('Relation (ex: ami de, père de) — laisser vide pour aucune :', '') ?? '';
        _edges.push({ id: _nextId++, from: _connecting, to: id, label: lbl.trim() });
        _connecting = null;
        updateConnectUI();
        renderEdges();
      }
      return;
    }

    // Sélection + drag
    _selected = id;
    _dragging  = node;
    const cr   = _canvas.getBoundingClientRect();
    _dragOffset = { x: e.clientX - node.x - cr.left, y: e.clientY - node.y - cr.top };

    // Mettre à jour la sélection sans recréer le DOM
    _canvas.querySelectorAll('.bs-node').forEach(n => n.classList.remove('selected'));
    nodeEl.classList.add('selected');

    const onMove = (ev) => {
      if (!_dragging) return;
      const r = _canvas.getBoundingClientRect();
      _dragging.x = Math.max(0, ev.clientX - r.left - _dragOffset.x);
      _dragging.y = Math.max(0, ev.clientY - r.top  - _dragOffset.y);
      const el = document.getElementById('bsn-' + _dragging.id);
      if (el) { el.style.left = _dragging.x + 'px'; el.style.top = _dragging.y + 'px'; }
      renderEdges();
    };
    const onUp = () => {
      _dragging = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }

  /* ── Édition inline ─────────────────────────────────────────────────────── */
  function openEdit(id) {
    const node = _nodes.find(n => n.id === id);
    if (!node) return;
    const el = document.getElementById('bsn-' + id);
    if (!el) return;
    if (el.querySelector('input')) return; // déjà en cours

    const labelEl = el.querySelector('.bsn-label');
    if (!labelEl) return;

    const input = document.createElement('input');
    input.type        = 'text';
    input.value       = node.label.startsWith('Nouveau ') ? '' : node.label;
    input.placeholder = node.label;
    input.style.cssText = 'border:none;outline:2px solid #8B1A1A;border-radius:3px;background:#fff;font:inherit;color:#1A0A0A;min-width:60px;max-width:160px;padding:0 4px;';
    labelEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const confirm = () => {
      if (done) return; done = true;
      const val = input.value.trim();
      if (val) node.label = val;
      renderAll();
    };
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter')  { ev.preventDefault(); confirm(); }
      if (ev.key === 'Escape') { done = true; renderAll(); }
    });
    input.addEventListener('blur', confirm);
  }

  /* ── Suppression nœud ───────────────────────────────────────────────────── */
  function deleteNode(id) {
    _nodes  = _nodes.filter(n => n.id !== id);
    _edges  = _edges.filter(e => e.from !== id && e.to !== id);
    if (_selected === id) _selected = null;
    renderAll();
  }

  /* ── Connexions SVG ─────────────────────────────────────────────────────── */
  function renderEdges() {
    if (!_svg) return;
    _svg.innerHTML = '';
    _svg.style.pointerEvents = 'none';

    for (const edge of _edges) {
      const f = _nodes.find(n => n.id === edge.from);
      const t = _nodes.find(n => n.id === edge.to);
      if (!f || !t) continue;

      const x1 = f.x + 70, y1 = f.y + 18;
      const x2 = t.x + 70, y2 = t.y + 18;
      const cpx = (x1 + x2) / 2;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.style.pointerEvents = 'all';
      g.style.cursor = 'pointer';
      g.addEventListener('click', () => {
        _edges = _edges.filter(e => e.id !== edge.id);
        renderEdges();
      });

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1},${y1} C${cpx},${y1} ${cpx},${y2} ${x2},${y2}`);
      path.setAttribute('stroke', 'var(--border)');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      // zone de clic plus large
      const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitPath.setAttribute('d', `M${x1},${y1} C${cpx},${y1} ${cpx},${y2} ${x2},${y2}`);
      hitPath.setAttribute('stroke', 'transparent');
      hitPath.setAttribute('stroke-width', '12');
      hitPath.setAttribute('fill', 'none');
      g.appendChild(hitPath);
      g.appendChild(path);

      if (edge.label) {
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', (x1 + x2) / 2);
        txt.setAttribute('y', (y1 + y2) / 2 - 4);
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('font-size', '11');
        txt.setAttribute('fill', 'var(--text-muted)');
        txt.textContent = edge.label;
        g.appendChild(txt);
      }
      _svg.appendChild(g);
    }
  }

  /* ── Mode connexion ─────────────────────────────────────────────────────── */
  function toggleConnect() {
    _connecting = _connecting !== null ? null : -1;
    updateConnectUI();
    if (_connecting === -1) Toast.info('Cliquez sur le nœud SOURCE, puis sur le nœud CIBLE.');
  }

  function updateConnectUI() {
    const btn  = document.getElementById('bs-connect-btn');
    const hint = document.getElementById('bs-connect-hint');
    if (!btn || !hint) return;
    btn.classList.toggle('active', _connecting !== null);
    hint.textContent = _connecting === -1 ? 'Cliquez la source...' : _connecting !== null ? '→ cliquez la cible' : '';
  }

  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return { render, addNode, importFromProject, clearAll, save, toggleConnect };
})();
