/**
 * app.js — Routeur SPA hash-based
 */
(async () => {
  try {
    const status = await API.ai.status();
    State.setAiConfigured(status.configured);
  } catch {}

  function route() {
    const hash = window.location.hash || '#/';

    if (typeof EditorView !== 'undefined' && EditorView.cleanup) {
      EditorView.cleanup();
    }
    if (typeof BDEditorView !== 'undefined' && BDEditorView.cleanup) {
      BDEditorView.cleanup();
    }

    const patterns = [
      { re: /^#\/project\/(\d+)\/chapter\/(\d+)$/,  fn: (m) => EditorView.render(m[1], m[2]) },
      { re: /^#\/project\/(\d+)\/characters$/,       fn: (m) => CharactersView.render(m[1]) },
      { re: /^#\/project\/(\d+)\/locations$/,        fn: (m) => LocationsView.render(m[1]) },
      { re: /^#\/project\/(\d+)\/notes$/,              fn: (m) => NotesView.render(m[1]) },
      { re: /^#\/project\/(\d+)\/ideas$/,              fn: (m) => IdeasView.render(m[1]) },
      { re: /^#\/project\/(\d+)\/brainstorm$/,        fn: (m) => BrainstormView.render(m[1]) },
      { re: /^#\/project\/(\d+)\/library$/,           fn: (m) => LibraryView.render(m[1]) },
      { re: /^#\/project\/(\d+)\/hub$/,               fn: (m) => ProjectHubView.render(m[1]) },
      { re: /^#\/project\/(\d+)\/bd$/,                fn: (m) => BDEditorView.render(m[1]) },
      { re: /^#\/project\/(\d+)$/,                   fn: (m) => ChaptersListView.render(m[1]) },
      { re: /^#\/settings$/,                         fn: () => SettingsView.render() },
      { re: /^#\/$/,                                 fn: () => DashboardView.render() },
    ];

    for (const { re, fn } of patterns) {
      const match = hash.match(re);
      if (match) { fn(match); Sidebar.render(); return; }
    }

    DashboardView.render();
    Sidebar.render();
  }

  window.addEventListener('hashchange', route);
  Sidebar.render();
  route();
})();
