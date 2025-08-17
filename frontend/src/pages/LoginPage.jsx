// frontend/src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState(localStorage.getItem('email') || '');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    try {
      await login(email, password);
      // ログイン後トップへ
      window.location.href = '/';
    } catch (e) {
      setErr(e.message || 'ログインに失敗しました');
    }
  }

  return (
    <div style={{maxWidth: 360, margin: '64px auto', padding: 24, border: '1px solid #ddd', borderRadius: 8}}>
      <h2 style={{marginBottom: 16}}>ログイン</h2>
      <form onSubmit={onSubmit}>
        <div style={{marginBottom: 12}}>
          <label style={{display:'block', marginBottom: 6}}>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required style={{width:'100%'}} />
        </div>
        <div style={{marginBottom: 12}}>
          <label style={{display:'block', marginBottom: 6}}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required style={{width:'100%'}} />
        </div>
        {err && <div style={{color:'crimson', marginBottom: 12}}>{err}</div>}
        <button type="submit" style={{width:'100%'}}>ログイン</button>
      </form>
      <p style={{fontSize:12, color:'#666', marginTop:12}}>
        まだユーザーが無ければ、バックエンドの <code>/api/auth/register</code> で作成してください。
      </p>
    </div>
  );
}
