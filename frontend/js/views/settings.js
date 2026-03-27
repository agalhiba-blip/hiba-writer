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

          <!-- Bandeau info fournisseur -->
          <div id="provider-banner" style="
            padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:12px;line-height:1.6;
            background:var(--bg-tertiary);border:1px solid var(--border);
          ">
            <strong>🔑 Deux types de clés acceptés :</strong><br>
            &bull; <span style="color:var(--accent)">Anthropic</span> — commence par <code>sk-ant-...</code> — obtenez-la sur <span style="color:var(--accent)">console.anthropic.com</span><br>
            &bull; <span style="color:#7c6fd4">OpenRouter</span> — commence par <code>sk-or-v1-...</code> — obtenez-la sur <span style="color:#7c6fd4">openrouter.ai/keys</span> (gratuit avec crédits offerts)
          </div>

          <div class="form-group">
            <label class="form-label">Clé API <span id="provider-label" style="font-weight:400;color:var(--text-muted)">(Anthropic ou OpenRouter)</span></label>
            <div class="api-key-input-wrap">
              <input class="form-control" type="password" id="api-key-input"
                value="${aiStatus.configured ? '••••••••••••••••••••••••' : ''}"
                placeholder="sk-ant-... ou sk-or-v1-..."
                oninput="SettingsView.onKeyInput(this)">
              <button class="api-key-toggle" onclick="SettingsView.toggleApiKeyVisibility()" title="Afficher/masquer">👁️</button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Modèle</label>
            <select class="form-control" id="model-select">
              <option value="claude-haiku-4-5-20251001" ${aiStatus.model === 'claude-haiku-4-5-20251001' ? 'selected' : ''}>Claude Haiku 4.5 — rapide &amp; léger</option>
              <option value="claude-sonnet-4-6" ${(!aiStatus.model || aiStatus.model === 'claude-sonnet-4-6') ? 'selected' : ''}>Claude Sonnet 4.6 — équilibré ✓ recommandé</option>
              <option value="claude-opus-4-6" ${aiStatus.model === 'claude-opus-4-6' ? 'selected' : ''}>Claude Opus 4.6 — le plus puissant</option>
            </select>
            <p id="model-note" style="font-size:11px;color:var(--text-muted);margin-top:4px;"></p>
          </div>

          <div style="display:flex;align-items:center;gap:8px;">
            <button class="btn btn-primary" onclick="SettingsView.saveApiConfig()">💾 Sauvegarder</button>
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
              <option value="5" ${(localStorage.getItem('autosave_interval') || '30') === '5' ? 'selected' : ''}>5 secondes</option>
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

  function onKeyInput(input) {
    const val = input.value.trim();
    const label = document.getElementById('provider-label');
    const note = document.getElementById('model-note');
    if (val.startsWith('sk-or-')) {
      if (label) { label.textContent = '— OpenRouter détecté'; label.style.color = '#7c6fd4'; }
      if (note) note.textContent = 'OpenRouter : les modèles sont automatiquement convertis (ex: Sonnet 4.6 → claude-sonnet-4-5 sur OR).';
    } else if (val.startsWith('sk-ant-')) {
      if (label) { label.textContent = '— Anthropic détecté'; label.style.color = 'var(--accent)'; }
      if (note) note.textContent = '';
    } else {
      if (label) { label.textContent = '(Anthropic ou OpenRouter)'; label.style.color = 'var(--text-muted)'; }
      if (note) note.textContent = '';
    }
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
      Toast.error('Entrez votre clé API (Anthropic ou OpenRouter)');
      return;
    }
    if (!key.startsWith('sk-ant-') && !key.startsWith('sk-or-')) {
      Toast.error('Clé invalide — doit commencer par sk-ant-... (Anthropic) ou sk-or-v1-... (OpenRouter)');
      return;
    }
    try {
      await API.ai.updateConfig({ anthropic_api_key: key, claude_model: model });
      State.setAiConfigured(true);
      const status = document.getElementById('api-status');
      if (status) { status.textContent = '✓ Configurée'; status.style.color = '#4aaa6a'; }
      const provider = key.startsWith('sk-or-') ? 'OpenRouter' : 'Anthropic';
      Toast.success(`Clé ${provider} sauvegardée !`);
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

  return { render, toggleApiKeyVisibility, saveApiConfig, setTheme, saveEditorSettings, onKeyInput };
})();
