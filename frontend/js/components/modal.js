/**
 * modal.js — Modale générique
 */
const Modal = (() => {
  function open({ title, body, onConfirm, confirmText = 'Valider', cancelText = 'Annuler', danger = false }) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal">
          <div class="modal-title">${title}</div>
          <div id="modal-body">${body}</div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="modal-cancel">${cancelText}</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm">${confirmText}</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-cancel').onclick = close;
    document.getElementById('modal-overlay').onclick = (e) => {
      if (e.target === e.currentTarget) close();
    };
    document.getElementById('modal-confirm').onclick = () => {
      if (onConfirm) onConfirm(getFormData());
    };
  }

  function getFormData() {
    const data = {};
    document.querySelectorAll('#modal-body [data-field]').forEach(el => {
      const key = el.dataset.field;
      if (el.type === 'checkbox') data[key] = el.checked;
      else data[key] = el.value;
    });
    return data;
  }

  function close() {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
  }

  function confirm({ title, message, onConfirm, danger = false }) {
    open({
      title,
      body: `<p style="color:var(--text-secondary);font-size:14px;">${message}</p>`,
      onConfirm,
      confirmText: danger ? 'Supprimer' : 'Confirmer',
      danger,
    });
  }

  return { open, close, confirm };
})();
