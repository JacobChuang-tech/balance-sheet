let activeModal = null;

export function openModal({ title, body, onClose }) {
  closeModal();

  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">${typeof body === 'string' ? body : ''}</div>
    </div>
  `;

  if (body instanceof HTMLElement) {
    overlay.querySelector('.modal-body').innerHTML = '';
    overlay.querySelector('.modal-body').appendChild(body);
  }

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Close button
  overlay.querySelector('.modal-close').addEventListener('click', closeModal);

  // Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', escHandler);

  root.appendChild(overlay);
  activeModal = { overlay, escHandler, onClose };

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));
}

export function closeModal() {
  if (!activeModal) return;
  const { overlay, escHandler, onClose } = activeModal;
  document.removeEventListener('keydown', escHandler);
  overlay.classList.remove('modal-overlay--visible');
  setTimeout(() => overlay.remove(), 200);
  if (onClose) onClose();
  activeModal = null;
}
