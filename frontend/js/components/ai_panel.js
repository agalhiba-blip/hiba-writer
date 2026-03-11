/**
 * ai_panel.js — Panneau IA coulissant avec relecture complète
 */
const AIPanel = (() => {
  let _panel = null;
  let _open = false;
  let _getEditorContent = null;
  let _getProjectContext = null;
  let _currentProjectId = null;
  let _currentChapterId = null;

  function init(opts = {}) {
    _getEditorContent = opts.getContent || (() => '');
    _getProjectContext = opts.getContext || (() => '');
    _currentProjectId = opts.projectId || null;
    _currentChapterId = opts.chapterId || null;
  }

  function render() {
    const configured = State.aiConfigured;
    return `
      <div class="ai-panel" id="ai-panel">
        <div class="ai-panel-header">
          <div class="ai-panel-title">
            <i class="fa-solid fa-wand-magic-sparkles" style="color:var(--accent)"></i>
            Assistant IA
            <span class="ai-badge">Claude</span>
          </div>
          <button class="btn-icon" onclick="AIPanel.toggle()" title="Fermer">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        ${!configured ? `
          <div class="ai-no-key">
            <i class="fa-solid fa-key" style="font-size:20px;opacity:0.4;display:block;margin-bottom:8px"></i>
            Clé API non configurée.<br>
            <a href="#" onclick="window.location.hash='#/settings';AIPanel.toggle();">
              Allez dans Paramètres
            </a> pour activer l'IA.
          </div>
        ` : ''}

        <div class="ai-panel-actions">

          <!-- Relecture complète — bouton principal -->
          <button class="ai-btn ai-btn-featured" onclick="AIPanel.run('review')" ${!configured ? 'disabled' : ''}>
            <span class="ai-btn-icon"><i class="fa-solid fa-glasses"></i></span>
            <div>
              <div class="ai-btn-label">Relecture complète</div>
              <div class="ai-btn-desc">Syntaxe · Cohérence · Tournures de phrases</div>
            </div>
          </button>

          <button class="ai-btn" onclick="AIPanel.run('improve')" ${!configured ? 'disabled' : ''}>
            <span class="ai-btn-icon"><i class="fa-solid fa-pen-fancy"></i></span>
            <div>
              <div class="ai-btn-label">Améliorer le style</div>
              <div class="ai-btn-desc">Rythme, fluidité, vocabulaire</div>
            </div>
          </button>

          <button class="ai-btn" onclick="AIPanel.run('proofread')" ${!configured ? 'disabled' : ''}>
            <span class="ai-btn-icon"><i class="fa-solid fa-spell-check"></i></span>
            <div>
              <div class="ai-btn-label">Orthographe &amp; Grammaire</div>
              <div class="ai-btn-desc">Correction des fautes</div>
            </div>
          </button>

          <button class="ai-btn" onclick="AIPanel.run('continue')" ${!configured ? 'disabled' : ''}>
            <span class="ai-btn-icon"><i class="fa-solid fa-forward"></i></span>
            <div>
              <div class="ai-btn-label">Continuer l'écriture</div>
              <div class="ai-btn-desc">Suggestion de suite</div>
            </div>
          </button>

          <button class="ai-btn" onclick="AIPanel.run('summarize')" ${!configured ? 'disabled' : ''}>
            <span class="ai-btn-icon"><i class="fa-solid fa-list-check"></i></span>
            <div>
              <div class="ai-btn-label">Résumer le chapitre</div>
              <div class="ai-btn-desc">2-3 phrases clés</div>
            </div>
          </button>
        </div>

        <div class="ai-panel-result" id="ai-result">
          <div style="color:var(--text-muted);font-size:12px;text-align:center;padding:20px;line-height:1.6">
            <i class="fa-solid fa-lightbulb" style="font-size:20px;opacity:0.3;display:block;margin-bottom:8px"></i>
            Sélectionnez du texte ou utilisez le contenu complet du chapitre.
          </div>
        </div>
      </div>
    `;
  }

  function inject(container) {
    container.insertAdjacentHTML('beforeend', render());
    _panel = document.getElementById('ai-panel');
  }

  function toggle() {
    if (!_panel) return;
    _open = !_open;
    _panel.classList.toggle('open', _open);
  }

  function open() {
    if (!_panel) return;
    _open = true;
    _panel.classList.add('open');
  }

  // Appelé depuis le bouton Relecture de l'éditeur
  async function runRelecture(text, context) {
    const resultDiv = document.getElementById('ai-result');
    if (!resultDiv) return;
    await _executeAI('review', text, context, resultDiv);
  }

  async function run(action) {
    const resultDiv = document.getElementById('ai-result');
    if (!resultDiv) return;

    const selection = window.getSelection();
    let text = '';
    if (selection && selection.toString().trim()) {
      text = selection.toString().trim();
    } else {
      text = _getEditorContent ? _getEditorContent() : '';
    }

    if (!text) {
      Toast.error('Aucun texte à analyser. Écrivez quelque chose ou sélectionnez du texte.');
      return;
    }
    const context = _getProjectContext ? _getProjectContext() : '';
    await _executeAI(action, text, context, resultDiv);
  }

  async function _executeAI(action, text, context, resultDiv) {
    resultDiv.innerHTML = `
      <div class="ai-loading">
        <div class="spinner"></div>
        <span>Claude analyse votre texte...</span>
      </div>
    `;

    const labels = {
      review: 'Relecture complète',
      improve: 'Style amélioré',
      proofread: 'Orthographe corrigée',
      continue: 'Continuation',
      summarize: 'Résumé',
    };

    try {
      const payload = { text, context, project_id: _currentProjectId, chapter_id: _currentChapterId };
      const fnMap = {
        review: API.ai.review,
        improve: API.ai.improve,
        proofread: API.ai.proofread,
        summarize: API.ai.summarize,
        continue: API.ai.continue,
      };

      const res = await fnMap[action](payload);
      resultDiv.innerHTML = `
        <div style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">
            ${labels[action] || action}
          </span>
          <button class="btn btn-sm btn-secondary" onclick="AIPanel.copyResult()">
            <i class="fa-regular fa-copy"></i> Copier
          </button>
        </div>
        <div class="ai-result-text">${escapeHtml(res.result)}</div>
      `;
    } catch (err) {
      resultDiv.innerHTML = `
        <div style="color:#aa4a4a;font-size:13px;padding:8px;display:flex;align-items:center;gap:8px">
          <i class="fa-solid fa-circle-exclamation"></i>
          ${err.message}
        </div>
      `;
    }
  }

  function copyResult() {
    const el = document.querySelector('.ai-result-text');
    if (el) {
      navigator.clipboard.writeText(el.textContent);
      Toast.success('Texte copié !');
    }
  }

  function escapeHtml(text) {
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  return { init, inject, toggle, open, run, runRelecture, copyResult };
})();
