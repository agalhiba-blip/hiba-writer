/**
 * settings.js — Paramètres de l'application
 */
const SettingsView = (() => {
  async function render() {
    const view = document.getElementById('view');
    const topbar = document.getElementById('topbar');

    topbar.innerHTML = `
      <div class="topbar-title">Paramètres</div>
    `;

    // Charger les paramètres
    let aiStatus = { configured: false, model: 'claude-sonnet-4-6' };
    try {
      aiStatus = await API.ai.status();
    } catch {}

    view.innerHTML = `
      <div class="settings-view">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:20px;color:var(--text-primary);">⚙️ Paramètres</h2>

        <!-- IA -->
        <div class="settings-section">
          <div class="settings-section-title">✨ Assistant IA (Claude)</div>
          <div class="form-group">
            <label class="form-label">Clé API Anthropic</label>
            <div class="api-key-input-wrap">
              <input class="form-control" type="password" id="api-key-input"
                value="${aiStatus.configured ? '••••••••••••••••••••••••' : ''}"
                placeholder="sk-ant-api03-...">
              <button class="api-key-toggle" onclick="SettingsView.toggleApiKeyVisibility()" title="Afficher/masquer">👁️</button>
            </div>
            <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">
              Obtenez votre clé sur
              <span style="color:var(--accent)">console.anthropic.com</span>.
              Elle est stockée localement, jamais envoyée en dehors de votre machine.
            </p>
          </div>
          <div class="form-group">
            <label class="form-label">Modèle Claude</label>
            <select class="form-control" id="model-select">
              <option value="claude-haiku-4-5-20251001" ${aiStatus.model === 'claude-haiku-4-5-20251001' ? 'selected' : ''}>Claude Haiku 4.5 (rapide)</option>
              <option value="claude-sonnet-4-6" ${aiStatus.model === 'claude-sonnet-4-6' ? 'selected' : ''}>Claude Sonnet 4.6 (équilibré)</option>
              <option value="claude-opus-4-6" ${aiStatus.model === 'claude-opus-4-6' ? 'selected' : ''}>Claude Opus 4.6 (puissant)</option>
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="btn btn-primary" onclick="SettingsView.saveApiConfig()">💾 Sauvegarder la clé API</button>
            <span id="api-status" style="font-size:12px;color:${aiStatus.configured ? '#4aaa6a' : 'var(--text-muted)'}">
              ${aiStatus.configured ? '✓ Configurée' : 'Non configurée'}
            </span>
          </div>
        </div>

        <!-- Apparence -->
        <div class="settings-section">
          <div class="settings-section-title">🎨 Apparence</div>
          <div class="form-group">
            <label class="form-label">Thème</label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
              <button class="btn ${State.theme === 'light' ? 'btn-primary' : 'btn-secondary'}" onclick="SettingsView.setTheme('light')"
                style="min-width:130px;${State.theme === 'light' ? 'border:2px solid var(--gold);' : ''}">
                🍂 Automne
              </button>
              <button class="btn ${State.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}" onclick="SettingsView.setTheme('dark')"
                style="min-width:130px;">
                🌙 Sombre
              </button>
              <button class="btn btn-secondary" onclick="SettingsView.setTheme('galaxy')"
                style="min-width:130px;${State.theme === 'galaxy' ? 'background:linear-gradient(135deg,#8b5cf6,#3b82f6);color:#fff;border-color:#8b5cf6;' : ''}">
                🌌 Galaxy
              </button>
            </div>
            <p style="font-size:11px;color:var(--text-muted);margin-top:10px;line-height:1.6;">
              🍂 <strong>Automne</strong> : fond crème chaud, texture feuilles, accents bordeaux et or<br>
              🌙 <strong>Sombre</strong> : fond sombre avec accents dorés<br>
              🌌 <strong>Galaxy</strong> : fond spatial animé avec accents néon violets
            </p>
          </div>
        </div>

        <!-- Éditeur -->
        <div class="settings-section">
          <div class="settings-section-title">✏️ Éditeur</div>
          <div class="form-group">
            <label class="form-label">Intervalle d'autosauvegarde (secondes)</label>
            <select class="form-control" id="autosave-select" style="max-width:200px;">
              <option value="10" ${(localStorage.getItem('autosave_interval') || '30') === '10' ? 'selected' : ''}>10 secondes</option>
              <option value="30" ${(localStorage.getItem('autosave_interval') || '30') === '30' ? 'selected' : ''}>30 secondes</option>
              <option value="60" ${(localStorage.getItem('autosave_interval') || '30') === '60' ? 'selected' : ''}>1 minute</option>
              <option value="120" ${(localStorage.getItem('autosave_interval') || '30') === '120' ? 'selected' : ''}>2 minutes</option>
            </select>
          </div>
          <button class="btn btn-secondary" onclick="SettingsView.saveEditorSettings()">💾 Enregistrer</button>
        </div>

        <!-- Info -->
        <div class="settings-section">
          <div class="settings-section-title">ℹ️ À propos</div>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.7;">
            <strong>HIBA-WRITER</strong> — Outil de rédaction de roman local<br>
            Version 1.0.0 · Backend FastAPI + SQLite · Frontend HTML/JS<br>
            Vos données sont stockées localement dans <code style="background:var(--bg-tertiary);padding:1px 4px;border-radius:3px;">data/roman_writer.db</code>
          </p>
        </div>
      </div>
    `;
  }

  function toggleApiKeyVisibility() {
    const input = document.getElementById('api-key-input');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  }

  async function saveApiConfig() {
    const key = document.getElementById('api-key-input')?.value;
    const model = document.getElementById('model-select')?.value;
    if (!key || key.includes('•')) {
      Toast.error('Entrez votre clé API Anthropic');
      return;
    }
    try {
      await API.ai.updateConfig({ anthropic_api_key: key, claude_model: model });
      State.setAiConfigured(true);
      const status = document.getElementById('api-status');
      if (status) { status.textContent = '✓ Configurée'; status.style.color = '#4aaa6a'; }
      Toast.success('Clé API sauvegardée !');
    } catch (err) {
      Toast.error(err.message);
    }
  }

  function setTheme(theme) {
    State.setTheme(theme);
    render(); // Re-render pour mettre à jour les boutons
  }

  function saveEditorSettings() {
    const interval = document.getElementById('autosave-select')?.value;
    if (interval) localStorage.setItem('autosave_interval', interval);
    Toast.success('Paramètres enregistrés !');
  }

  return { render, toggleApiKeyVisibility, saveApiConfig, setTheme, saveEditorSettings };
})();
