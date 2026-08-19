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

export function openPicker({ title, options, selected, multiSelect = false, onSelect }) {
  if (!multiSelect) {
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

  // Chế độ chọn nhiều — tích chọn nhiều mục cùng lúc, bấm "Xong" mới áp dụng.
  const chosen = new Set(selected || []);
  const close = openModal({
    title,
    bodyHtml: `
      <div class="flex gap-8 mb-8">
        <button class="btn btn-outline btn-sm" data-select-all>Chọn tất cả</button>
        <button class="btn btn-outline btn-sm" data-clear-all>Bỏ chọn tất cả</button>
      </div>
      <ul class="flex-col gap-6">${options.map((o) => `
      <li>
        <button class="list-row w-full" data-val="${o.value}" style="border:none;padding:11px 4px;background:none;text-align:left;cursor:pointer;">
          <div class="row-main"><div class="row-title" style="font-weight:${chosen.has(o.value) ? 700 : 500}">${o.label}</div></div>
          <span data-check style="visibility:${chosen.has(o.value) ? 'visible' : 'hidden'}">${icon('check', 'icon-sm')}</span>
        </button>
      </li>`).join('')}</ul>`,
    footHtml: `<button class="btn btn-primary btn-block" data-done>Xong</button>`,
    onMount(sheet, closeFn) {
      function refreshRows() {
        sheet.querySelectorAll('[data-val]').forEach((b) => {
          const isChosen = chosen.has(b.dataset.val);
          b.querySelector('.row-title').style.fontWeight = isChosen ? 700 : 500;
          b.querySelector('[data-check]').style.visibility = isChosen ? 'visible' : 'hidden';
        });
      }
      sheet.querySelectorAll('[data-val]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const val = btn.dataset.val;
          if (chosen.has(val)) chosen.delete(val); else chosen.add(val);
          refreshRows();
        });
      });
      sheet.querySelector('[data-select-all]').addEventListener('click', () => {
        options.forEach((o) => chosen.add(o.value));
        refreshRows();
      });
      sheet.querySelector('[data-clear-all]').addEventListener('click', () => {
        chosen.clear();
        refreshRows();
      });
      sheet.querySelector('[data-done]').addEventListener('click', () => { closeFn(); onSelect([...chosen]); });
    },
  });
  return close;
}

export function pillSelectHtml(id, label) {
  return `<button class="pill-select" id="${id}">${label} ${icon('chevronDown', 'icon-sm')}</button>`;
}

/** Modal nhỏ để "Cấp lại mật khẩu" — admin có thể tự gõ mật khẩu cụ thể, để trống thì hệ thống tự sinh ngẫu nhiên. Dùng chung cho cả Use lẫn Quản trị viên/nhân viên. */
export function openResetPasswordModal({ title = 'Cấp lại mật khẩu', onConfirm }) {
  return openModal({
    title,
    bodyHtml: `
      <div class="field">
        <label>Mật khẩu mới</label>
        <input id="reset-pw-input" placeholder="Để trống sẽ tự sinh mật khẩu ngẫu nhiên"/>
      </div>
    `,
    footHtml: `<button class="btn btn-primary btn-block" data-confirm>Cấp lại mật khẩu</button>`,
    onMount(sheet, closeFn) {
      sheet.querySelector('[data-confirm]').addEventListener('click', () => {
        const val = sheet.querySelector('#reset-pw-input').value;
        closeFn();
        onConfirm(val);
      });
    },
  });
}
