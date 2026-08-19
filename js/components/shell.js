import { icon } from '../icons.js';
import { openModal } from './modal.js';

export const CUSTOMER_NAV = [
  { path: '#/', label: 'Trang chủ', icon: 'landmark' },
  { path: '#/yeu-cau-tu-van', label: 'Yêu cầu tư vấn', icon: 'clipboard' },
  { path: '#/tai-khoan', label: 'Tài khoản', icon: 'idCard' },
];

export const ADMIN_NAV = [
  { path: '#/admin', label: 'Tổng quan', icon: 'chart' },
  { path: '#/admin/khach-hang', label: 'Khách hàng & Hợp đồng', icon: 'users' },
  { path: '#/admin/yeu-cau', label: 'Yêu cầu tư vấn', icon: 'clipboard' },
  { path: '#/admin/cai-dat', label: 'Cài đặt', icon: 'settings' },
];

function matchPath(navPath, current) {
  if (navPath === '#/') return current === '#/' || current === '' || current === '#';
  return current === navPath || current.startsWith(navPath + '/');
}

export function buildShell(root, role) {
  const nav = role === 'admin' ? ADMIN_NAV : CUSTOMER_NAV;
  root.innerHTML = `
    <div class="demo-ribbon">BẢN DEMO — dữ liệu giả, chưa kết nối hệ thống thật, không dùng để giao dịch thật</div>
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="logo-mark">${icon('landmark', 'icon-sm')}</div>
          <div>
            <strong id="brand-name">Quỹ Tín Dụng</strong>
            <span>${role === 'admin' ? 'Trang quản trị' : 'Cổng khách hàng'}</span>
          </div>
        </div>
        <nav class="sidebar-nav" id="sidebar-nav"></nav>
        <button class="btn btn-outline btn-block" id="btn-logout-side" style="margin-top:16px">${icon('logout', 'icon-sm')} Đăng xuất</button>
      </aside>
      <div class="main-col">
        <header class="app-header" id="app-header"></header>
        <div id="filter-slot"></div>
        <main class="app-content" id="app-content"></main>
      </div>
      <nav class="bottom-nav" id="bottom-nav"></nav>
    </div>
  `;
  renderSidebarNav(nav);
  renderBottomNav(nav);
  document.getElementById('btn-logout-side').addEventListener('click', onLogoutClick);
}

function renderSidebarNav(nav) {
  const el = document.getElementById('sidebar-nav');
  el.innerHTML = nav.map((item) => `<a href="${item.path}" data-path="${item.path}">${icon(item.icon)}<span>${item.label}</span></a>`).join('');
}

function renderBottomNav(nav) {
  const el = document.getElementById('bottom-nav');
  el.innerHTML = nav.map((item) => `<a href="${item.path}" data-path="${item.path}">${icon(item.icon)}<span>${item.label}</span></a>`).join('')
    + `<button class="more-btn" id="btn-logout-bottom">${icon('logout')}<span>Đăng xuất</span></button>`;
  document.getElementById('btn-logout-bottom').addEventListener('click', onLogoutClick);
}

function onLogoutClick() {
  openModal({
    title: 'Đăng xuất?',
    bodyHtml: `<p style="font-size:14px;color:var(--text-muted)">Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng.</p>`,
    footHtml: `
      <button class="btn btn-outline btn-block" data-cancel>Hủy</button>
      <button class="btn btn-primary btn-block" data-ok>Đăng xuất</button>
    `,
    onMount(root, close) {
      root.querySelector('[data-cancel]').addEventListener('click', close);
      root.querySelector('[data-ok]').addEventListener('click', () => {
        close();
        window.dispatchEvent(new CustomEvent('qtd:logout'));
      });
    },
  });
}

export function updateActiveNav(hash) {
  document.querySelectorAll('.sidebar-nav a, .bottom-nav a').forEach((a) => {
    a.classList.toggle('active', matchPath(a.dataset.path, hash));
  });
}

export function pageHeader({ title, back, actions = [] }) {
  return `
    <div class="flex items-center gap-8" style="width:100%">
      ${back ? `<button class="icon-btn back-btn" id="btn-back">${icon('arrowLeft')}</button>` : `<div class="avatar">${icon('landmark', 'icon-sm')}</div>`}
      <h1>${title}</h1>
      <div class="header-actions">
        ${actions.map((a) => `<button class="icon-btn" data-action="${a.action}">${icon(a.icon)}</button>`).join('')}
      </div>
    </div>
  `;
}
export function bindHeaderActions(headerEl, handlers) {
  const backBtn = headerEl.querySelector('#btn-back');
  if (backBtn && handlers.back) backBtn.addEventListener('click', handlers.back);
  headerEl.querySelectorAll('[data-action]').forEach((btn) => {
    const act = btn.dataset.action;
    if (handlers[act]) btn.addEventListener('click', handlers[act]);
  });
}
