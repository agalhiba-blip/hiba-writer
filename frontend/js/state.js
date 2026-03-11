/**
 * state.js — État global de l'application
 */
const State = (() => {
  let _currentProject = null;
  let _currentChapter = null;
  let _aiConfigured = false;
  let _theme = localStorage.getItem('hiba-theme') || 'light'; // 'light' = thème Automne

  const listeners = {};

  function emit(event, data) {
    (listeners[event] || []).forEach(fn => fn(data));
  }

  function on(event, fn) {
    listeners[event] = listeners[event] || [];
    listeners[event].push(fn);
  }

  function setProject(project) {
    _currentProject = project;
    emit('project-changed', project);
    if (typeof Sidebar !== 'undefined') Sidebar.update();
  }

  function setChapter(chapter) {
    _currentChapter = chapter;
    emit('chapter-changed', chapter);
  }

  function setAiConfigured(val) {
    _aiConfigured = val;
    emit('ai-status-changed', val);
  }

  function setTheme(theme) {
    _theme = theme;
    localStorage.setItem('hiba-theme', theme);
    document.body.className = theme !== 'light' ? `theme-${theme}` : '';
    emit('theme-changed', theme);
    if (typeof Sidebar !== 'undefined') Sidebar.render();
  }

  // Appliquer le thème sauvegardé (light = Automne, dark = Sombre, galaxy = Galaxy)
  document.body.className = _theme !== 'light' ? `theme-${_theme}` : '';

  return {
    get project() { return _currentProject; },
    get chapter() { return _currentChapter; },
    get aiConfigured() { return _aiConfigured; },
    get theme() { return _theme; },
    setProject,
    setChapter,
    setAiConfigured,
    setTheme,
    on,
  };
})();
