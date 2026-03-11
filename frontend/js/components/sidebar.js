/**
 * sidebar.js — Barre de navigation latérale avec icônes Font Awesome
 */
const Sidebar = (() => {
  function getLinks() {
    const project = State.project;
    if (!project) {
      return [
        { icon: 'fa-house', label: 'Mes romans', hash: '#/' },
        { icon: 'fa-gear', label: 'Paramètres', hash: '#/settings' },
      ];
    }

    const id = project.id;
    return [
      { icon: 'fa-house', label: 'Mes romans', hash: '#/' },
      null,
      { icon: 'fa-layer-group', label: 'Vue d\'ensemble', hash: `#/project/${id}/hub` },
      { icon: 'fa-book-open', label: 'Chapitres', hash: `#/project/${id}` },
      { icon: 'fa-users', label: 'Personnages', hash: `#/project/${id}/characters` },
      { icon: 'fa-map-location-dot', label: 'Lieux', hash: `#/project/${id}/locations` },
      { icon: 'fa-lightbulb', label: 'Idées', hash: `#/project/${id}/ideas` },
      { icon: 'fa-note-sticky', label: 'Notes & Dossiers', hash: `#/project/${id}/notes` },
      { icon: 'fa-diagram-project', label: 'Brainstorming', hash: `#/project/${id}/brainstorm` },
      { icon: 'fa-folder-open', label: 'Bibliothèque', hash: `#/project/${id}/library` },
      { icon: 'fa-palette',    label: 'BD / Collage', hash: `#/project/${id}/bd` },
      null,
      { icon: 'fa-gear', label: 'Paramètres', hash: '#/settings' },
    ];
  }

  function update() { render(); }

  function render() {
    const sidebar = document.getElementById('sidebar');
    const current = window.location.hash || '#/';
    const project = State.project;
    const links = getLinks();

    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">H</div>
        <div class="sidebar-logo-text">HIBA<span>-WRITER</span></div>
      </div>
      ${project ? `
        <div class="sidebar-project-name" title="${escHtml(project.title)}" onclick="window.location.hash='#/project/${project.id}/hub'" style="cursor:pointer">
          <i class="fa-solid fa-book" style="color:var(--accent);margin-right:6px;font-size:11px"></i>
          ${escHtml(project.title)}
        </div>` : ''}
      <nav class="sidebar-nav">
        ${links.map(link => {
          if (!link) return '<div class="sidebar-sep"></div>';
          const isActive = current === link.hash ||
            (link.hash !== '#/' && link.hash !== '#/settings' && current.startsWith(link.hash));
          return `
            <button class="sidebar-link ${isActive ? 'active' : ''}" onclick="window.location.hash='${link.hash}'">
              <i class="fa-solid ${link.icon} icon"></i>
              <span>${link.label}</span>
            </button>
          `;
        }).join('')}
      </nav>
      <div class="sidebar-footer">
        <button class="sidebar-footer-btn" onclick="IdeasView && window.location.hash.includes('/project/') ? window.location.hash = '#/project/'+State.project.id+'/ideas' : null" title="Idées rapides" style="flex:0;padding:7px 10px;">
          <i class="fa-solid fa-lightbulb" style="color:var(--sidebar-logo-color);"></i>
        </button>
        <button class="sidebar-footer-btn" onclick="State.setTheme(State.theme==='light'?'dark':State.theme==='dark'?'galaxy':'light')" title="Changer le thème" style="flex:1;">
          ${State.theme === 'light'
            ? '<i class="fa-solid fa-leaf" style="color:#C9A84C;"></i> Automne'
            : State.theme === 'dark'
            ? '<i class="fa-solid fa-moon" style="color:#C9A84C;"></i> Sombre'
            : '<i class="fa-solid fa-star" style="color:#a78bfa;"></i> Galaxy'}
        </button>
        <button class="sidebar-footer-btn" onclick="window.location.hash='#/settings'" title="Paramètres" style="flex:0;padding:7px 10px;">
          <i class="fa-solid fa-gear"></i>
        </button>
      </div>
    `;
  }

  function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return { render, update };
})();
