/**
 * api.js — Wrapper fetch vers le backend FastAPI
 */
const API = (() => {
  const BASE = '';

  // Clé API stockée localement pour résister aux resets Vercel
  function getLocalApiKey()   { return localStorage.getItem('hiba-api-key')   || ''; }
  function getLocalModel()    { return localStorage.getItem('hiba-claude-model') || 'claude-sonnet-4-6'; }

  async function request(method, path, body = null, isFormData = false) {
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };

    // Toujours joindre la clé API locale aux requêtes IA pour bypasser la DB Vercel
    if (path.startsWith('/api/ai')) {
      const key = getLocalApiKey();
      if (key) {
        headers['X-API-Key']  = key;
        headers['X-AI-Model'] = getLocalModel();
      }
    }

    const opts = { method, headers };
    if (body !== null) {
      opts.body = isFormData ? body : JSON.stringify(body);
    }
    const res = await fetch(BASE + path, opts);
    if (!res.ok) {
      let detail = `Erreur ${res.status}`;
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch {}
      throw new Error(detail);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // ── Projects ────────────────────────────────────────────────────────────
  const projects = {
    list: () => request('GET', '/api/projects'),
    create: (data) => request('POST', '/api/projects', data),
    get: (id) => request('GET', `/api/projects/${id}`),
    update: (id, data) => request('PUT', `/api/projects/${id}`, data),
    delete: (id) => request('DELETE', `/api/projects/${id}`),
  };

  // ── Chapters ─────────────────────────────────────────────────────────────
  const chapters = {
    list: (projectId) => request('GET', `/api/chapters?project_id=${projectId}`),
    create: (data) => request('POST', '/api/chapters', data),
    get: (id) => request('GET', `/api/chapters/${id}`),
    update: (id, data) => request('PUT', `/api/chapters/${id}`, data),
    delete: (id) => request('DELETE', `/api/chapters/${id}`),
    reorder: (items) => request('PATCH', '/api/chapters/reorder', { items }),
  };

  // ── Characters ───────────────────────────────────────────────────────────
  const characters = {
    list: (projectId) => request('GET', `/api/characters?project_id=${projectId}`),
    create: (data) => request('POST', '/api/characters', data),
    get: (id) => request('GET', `/api/characters/${id}`),
    update: (id, data) => request('PUT', `/api/characters/${id}`, data),
    delete: (id) => request('DELETE', `/api/characters/${id}`),
    uploadImage: (id, file) => {
      const fd = new FormData();
      fd.append('file', file);
      return request('POST', `/api/characters/${id}/image`, fd, true);
    },
  };

  // ── Locations ────────────────────────────────────────────────────────────
  const locations = {
    list: (projectId) => request('GET', `/api/locations?project_id=${projectId}`),
    create: (data) => request('POST', '/api/locations', data),
    get: (id) => request('GET', `/api/locations/${id}`),
    update: (id, data) => request('PUT', `/api/locations/${id}`, data),
    delete: (id) => request('DELETE', `/api/locations/${id}`),
  };

  // ── Notes ────────────────────────────────────────────────────────────────
  const notes = {
    list: (projectId) => request('GET', `/api/notes?project_id=${projectId}`),
    create: (data) => request('POST', '/api/notes', data),
    get: (id) => request('GET', `/api/notes/${id}`),
    update: (id, data) => request('PUT', `/api/notes/${id}`, data),
    delete: (id) => request('DELETE', `/api/notes/${id}`),
  };

  // ── AI ───────────────────────────────────────────────────────────────────
  const ai = {
    status: () => request('GET', '/api/ai/status'),
    updateConfig: (data) => request('PUT', '/api/ai/config', data),
    improve: (data) => request('POST', '/api/ai/improve', data),
    proofread: (data) => request('POST', '/api/ai/proofread', data),
    summarize: (data) => request('POST', '/api/ai/summarize', data),
    continue: (data) => request('POST', '/api/ai/continue', data),
    review: (data) => request('POST', '/api/ai/review', data),
    translate: (data) => request('POST', '/api/ai/translate', data),
  };

  // ── Import Word ──────────────────────────────────────────────────────────
  const importWord = {
    upload: (file, projectId, mode = 'auto', projectTitle = '') => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('project_id', String(projectId || 0));
      fd.append('mode', mode);
      fd.append('project_title', projectTitle);
      return request('POST', '/api/import/word', fd, true);
    },
  };

  // ── Export ───────────────────────────────────────────────────────────────
  async function exportBinary(path, projectId) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    });
    if (!res.ok) {
      let detail = `Erreur ${res.status}`;
      try { const err = await res.json(); detail = err.detail || detail; } catch {}
      throw new Error(detail);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    const filename = match ? match[1] : 'export';
    return { blob, filename };
  }

  const exportApi = {
    generatePdf:      (id) => exportBinary('/api/export/pdf',      id),
    generateDocx:     (id) => exportBinary('/api/export/docx',     id),
    generateMarkdown: (id) => exportBinary('/api/export/markdown',  id),
    generateTxt:      (id) => exportBinary('/api/export/txt',       id),
  };

  return { projects, chapters, characters, locations, notes, ai, export: exportApi, importWord };
})();
