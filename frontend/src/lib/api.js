// frontend/src/lib/api.js

// 環境に応じて自動切替（Web=相対、Capacitor同梱=絶対）
const IS_CAPACITOR = typeof window !== 'undefined' &&
  (window.Capacitor || window.location.protocol === 'capacitor:');
// 環境変数があれば最優先（例：VITE_API_BASE=https://eletim.jp/api）
const ENV_API_BASE = (import.meta?.env && import.meta.env.VITE_API_BASE) || '';
const AUTO_API_BASE = IS_CAPACITOR
  ? 'https://eletim.jp/api'
  : (window.location.pathname.startsWith('/calendar') ? '/calendar/api' : '/api');
const API_BASE = ENV_API_BASE || AUTO_API_BASE;

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function redirectToLogin() {
  const prefix = window.location.pathname.startsWith('/calendar') ? '/calendar' : '';
  const loginPath = `${prefix}/login`;
  if (window.location.pathname !== loginPath) {
    window.location.href = loginPath;
  }
}

function normalizePath(path) {
  // 先頭スラッシュを保証
  let p = path.startsWith('/') ? path : `/${path}`;
  // API_BASE が /api で終わっていて、呼び出しも /api/... なら /api を一度だけ削る
  const baseEndsWithApi = /\/api\/?$/.test(API_BASE);
  if (baseEndsWithApi && p.startsWith('/api/')) {
    p = p.slice(4); // '/api' を削除 → '/tasks/...'
  }
  return p;
}

async function parseResponse(res) {
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data?.error || res.statusText);
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data;
  }
  if (!res.ok) {
    const err = new Error(res.statusText);
    err.status = res.status;
    throw err;
  }
  return res.text();
}

async function tryRefresh() {
  const refreshUrl = `${API_BASE}${normalizePath('/auth/refresh')}`;
  const apiOrigin = new URL(API_BASE, window.location.origin).origin;
  const isSameOrigin = apiOrigin === window.location.origin;
  const res = await fetch(refreshUrl, {
    method: 'POST',
    credentials: isSameOrigin ? 'same-origin' : 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.ok;
}

export async function apiFetch(path, opts = {}) {
  const url = `${API_BASE}${normalizePath(path)}`;
  const method = (opts.method || 'GET').toUpperCase();

  const headers = new Headers(opts.headers || {});

  // ボディがある場合は、文字列かどうかに関係なく Content-Type を補う
  const hasBody = opts.body !== undefined && opts.body !== null;
  let body = opts.body;
  if (hasBody) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (typeof body !== 'string') {
      body = JSON.stringify(body);
    }
  }

  // 将来 JWT_COOKIE_CSRF_PROTECT=True にしたとき用（今OFFでも害なし）
  const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const csrf = getCookie('csrf_access_token'); // flask-jwt-extended のデフォ名
  if (needsCsrf && csrf) headers.set('X-CSRF-TOKEN', csrf);

  const init = {
    method,
    credentials: 'include',  // ← 常に include に固定（Capacitor対応）
    ...opts,
    headers,
    body,
  };

  let res = await fetch(url, init);

  if (res.status === 401) {
    // アクセスCookieの期限切れ → refreshで更新して1回だけ再試行
    const ok = await tryRefresh();
    if (ok) {
      // CSRFクッキーが更新されることもあるので再取得して付け直す
      const headers2 = new Headers(headers);
      const csrf2 = getCookie('csrf_access_token');
      if (needsCsrf && csrf2) headers2.set('X-CSRF-TOKEN', csrf2);

      res = await fetch(url, { ...init, headers: headers2 });
      if (res.status === 401) {
        redirectToLogin();
        throw new Error('Unauthorized');
      }
    } else {
      redirectToLogin();
      throw new Error('Unauthorized');
    }
  }

  return parseResponse(res);
}
