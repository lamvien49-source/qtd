import { icon } from '../icons.js';
import { openModal } from './modal.js';

export function emptyState({ iconName = 'box', title, message }) {
  return `
    <div class="empty-state">
      ${icon(iconName, 'icon-lg')}
      <h3>${title}</h3>
      <p>${message}</p>
    </div>`;
}

export function statusBadge(statusObj) {
  return `<span class="badge ${statusObj.badge}">${statusObj.label}</span>`;
}
// Bí danh cho các view dùng tên cũ
export const orderStatusBadge = statusBadge;

export function openPicker({ title, options, selected, onSelect }) {
  const close = openModal({
    title,
    bodyHtml: `<ul class="flex-col gap-6">${options.map((o) => `
      <li>
        <button class="list-row w-full" data-val="${o.value}" style="border:none;padding:11px 4px;background:none;text-align:left;cursor:pointer;">
          <div class="row-main"><div class="row-title" style="font-weight:${o.value === selected ? 700 : 500}">${o.label}</div></div>
          ${o.value === selected ? icon('check', 'icon-sm') : ''}
        </button>
      </li>`).join('')}</ul>`,
    onMount(sheet, closeFn) {
      sheet.querySelectorAll('[data-val]').forEach((btn) => {
        btn.addEventListener('click', () => { closeFn(); onSelect(btn.dataset.val); });
      });
    },
  });
  return close;
}

export function pillSelectHtml(id, label) {
  return `<button class="pill-select" id="${id}">${label} ${icon('chevronDown', 'icon-sm')}</button>`;
}
