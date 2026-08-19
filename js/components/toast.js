let wrap = null;
function ensureWrap() {
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  return wrap;
}

export function toast(message, type = 'default') {
  const w = ensureWrap();
  const el = document.createElement('div');
  el.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
  el.textContent = message;
  w.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .2s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }, 2200);
}
