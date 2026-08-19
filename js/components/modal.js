import { icon } from '../icons.js';

const openOverlays = new Set();

/** Đóng toàn bộ modal/bottom-sheet đang mở (dùng khi chuyển trang). */
export function closeAllModals() {
  [...openOverlays].forEach((close) => close());
}

/**
 * Mở một modal/bottom-sheet.
 * opts: { title, bodyHtml, footHtml, onMount(root), onClose }
 * Trả về hàm close().
 */
export function openModal(opts) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h3>${opts.title || ''}</h3>
        <button class="icon-btn" data-close>${icon('x')}</button>
      </div>
      <div class="modal-body">${opts.bodyHtml || ''}</div>
      ${opts.footHtml ? `<div class="modal-foot">${opts.footHtml}</div>` : ''}
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function close() {
    if (!openOverlays.has(close)) return;
    openOverlays.delete(close);
    document.body.style.overflow = openOverlays.size ? document.body.style.overflow : '';
    overlay.remove();
    if (opts.onClose) opts.onClose();
  }
  openOverlays.add(close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('[data-close]').addEventListener('click', close);

  const sheet = overlay.querySelector('.modal-sheet');
  if (opts.onMount) opts.onMount(sheet, close);
  return close;
}

export function confirmDialog({ title, message, confirmLabel = 'Xác nhận', danger = false, onConfirm }) {
  const close = openModal({
    title,
    bodyHtml: `<p style="font-size:14px;color:var(--text-muted);line-height:1.5">${message}</p>`,
    footHtml: `
      <button class="btn btn-outline btn-block" data-cancel>Hủy</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-block" data-ok>${confirmLabel}</button>
    `,
    onMount(root, closeFn) {
      root.querySelector('[data-cancel]').addEventListener('click', closeFn);
      root.querySelector('[data-ok]').addEventListener('click', () => {
        closeFn();
        onConfirm && onConfirm();
      });
    },
  });
  return close;
}
