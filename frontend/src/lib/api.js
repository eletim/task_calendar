// frontend/src/lib/api.js
const API_BASE = ''; // 絶対URLは付けない（相対パスで /api/... を叩く）

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function redirectToLogin() {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
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
  // refreshクッキーで新しいaccessクッキーをもらう
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.ok;
}

export async function apiFetch(path, opts = {}) {
  const url = `${API_BASE}${path}`;
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
    credentials: 'same-origin', // 同一オリジンならこれでCookieが自動送信
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
