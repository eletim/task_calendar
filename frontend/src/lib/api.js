// frontend/src/lib/api.js
export function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('token');
  const headers = new Headers(opts.headers || {});
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(path, { ...opts, headers }).then(async (res) => {
    if (res.status === 401) {
      // 認証切れ：トークン破棄してログインへ
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    // JSON なら JSON を返す（204 などはそのまま）
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);
      return data;
    }
    if (!res.ok) throw new Error(res.statusText);
    return res; // テキストや空レスポンス
  });
}
