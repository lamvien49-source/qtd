import * as S from './state.js';
import { buildShell, updateActiveNav } from './components/shell.js';
import { closeAllModals } from './components/modal.js';
import { renderLogin } from './views/login.js';
import { renderChangePassword } from './views/changePassword.js';

import * as Dashboard from './views/dashboard.js';
import * as ContractDetail from './views/contractDetail.js';
import * as RequestForm from './views/requestForm.js';
import * as Account from './views/account.js';
import * as AdminOverview from './views/admin/overview.js';
import * as AdminCustomers from './views/admin/customers.js';
import * as AdminRequests from './views/admin/requests.js';
import * as AdminSettings from './views/admin/settings.js';

const customerRoutes = [
  { re: /^#\/$/, view: Dashboard },
  { re: /^#\/hop-dong\/([^/]+)$/, view: ContractDetail, params: ['id'] },
  { re: /^#\/yeu-cau-tu-van$/, view: RequestForm },
  { re: /^#\/tai-khoan$/, view: Account },
];
const adminRoutes = [
  { re: /^#\/admin$/, view: AdminOverview },
  { re: /^#\/admin\/khach-hang$/, view: AdminCustomers },
  { re: /^#\/admin\/yeu-cau$/, view: AdminRequests },
  { re: /^#\/admin\/cai-dat$/, view: AdminSettings },
];

let root;
let shellRole = null;

function splitHash() {
  const raw = location.hash || '#/';
  const [path, qs] = raw.split('?');
  return { path: path || '#/', query: new URLSearchParams(qs || '') };
}

function matchRoute(path, routes) {
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = {};
      (r.params || []).forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]); });
      return { view: r.view, params };
    }
  }
  return null;
}

function clearFabs() { document.querySelectorAll('.fab').forEach((el) => el.remove()); }

function renderApp() {
  const session = S.getSession();

  if (!session) {
    shellRole = null;
    renderLogin(root, () => renderApp());
    return;
  }

  if (session.role === 'customer') {
    const customer = S.getCustomer(session.id);
    if (!customer) { S.logout(); renderApp(); return; }
    if (customer.mustChangePassword) {
      shellRole = null;
      renderChangePassword(root, customer.id, () => renderApp(), { forced: true });
      return;
    }
  }

  const { path, query } = splitHash();
  const routes = session.role === 'admin' ? adminRoutes : customerRoutes;
  const defaultPath = session.role === 'admin' ? '#/admin' : '#/';
  let match = matchRoute(path, routes);
  if (!match) {
    // Trang không hợp lệ với vai trò hiện tại -> về trang mặc định
    if (location.hash !== defaultPath) { location.hash = defaultPath; return; }
    match = matchRoute(defaultPath, routes);
  }

  if (shellRole !== session.role) {
    buildShell(root, session.role);
    shellRole = session.role;
  }
  document.getElementById('brand-name').textContent = S.getOrg().shortName;

  const headerEl = document.getElementById('app-header');
  const filterEl = document.getElementById('filter-slot');
  const contentEl = document.getElementById('app-content');
  clearFabs();
  filterEl.innerHTML = '';
  window.scrollTo(0, 0);

  if (match.view.renderHeader) match.view.renderHeader(headerEl, match.params);
  match.view.render(contentEl, filterEl, match.params, query);
  updateActiveNav(path);
}

window.addEventListener('hashchange', () => { closeAllModals(); renderApp(); });
window.addEventListener('qtd:logout', () => { closeAllModals(); S.logout(); location.hash = '#/'; renderApp(); });

window.addEventListener('DOMContentLoaded', async () => {
  root = document.getElementById('root');
  await S.init();
  renderApp();
});

S.subscribe(() => {
  if (root) renderApp();
});
