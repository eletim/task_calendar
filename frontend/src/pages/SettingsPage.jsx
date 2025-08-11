// src/pages/SettingsPage.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
// 既に lucide-react を使っているなら戻るアイコンもどうぞ
// import { ArrowLeft } from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  // 設定値（必要に応じて項目を増やす）
  const [theme, setTheme]                 = useState('default'); // 'light' | 'dark' | 'default'
  const [flagsLength, setFlagsLength]     = useState(3);
  const [ifThenLength, setIfThenLength]   = useState(3);
  const [showIfThen, setShowIfThen]       = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/api/settings');
        const data = await res.json();
        // 既存の構造に合わせて取り出し
        if (data?.theme) setTheme(data.theme);
        const r = data?.routine || {};
        const f = r.flags || {};
        const i = r.if_then_rules || {};
        if (typeof f.length === 'number') setFlagsLength(f.length);
        if (typeof i.length === 'number') setIfThenLength(i.length);
        if (typeof i.show === 'boolean')  setShowIfThen(i.show);
      } catch (e) {
        setError('設定の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        theme,
        routine: {
          flags: { length: Number(flagsLength) },
          if_then_rules: { length: Number(ifThenLength), show: Boolean(showIfThen) },
        },
      };
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('保存に失敗');
    } catch (e) {
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="settings-page"><p>読み込み中…</p></div>;

  return (
    <div className="settings-page">
      <div className="header">
        <h1 className="calendar-title">設定</h1>
        <Link to="/" className="icon-btn" aria-label="カレンダーに戻る" title="戻る">←</Link>
        {/* 例：<Link to="/" className="icon-btn" aria-label="戻る"><ArrowLeft size={18} /></Link> */}
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        {error && <div className="error">{error}</div>}

        <fieldset>
          <legend>テーマ</legend>
          <label className="row">
            <span>テーマモード</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="default">システムに追従</option>
              <option value="light">ライト</option>
              <option value="dark">ダーク</option>
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>習慣トラッカー</legend>
          <label className="row">
            <span>フラグ数</span>
            <input
              type="number"
              min={1}
              max={12}
              value={flagsLength}
              onChange={(e) => setFlagsLength(e.target.value)}
            />
          </label>
          <label className="row">
            <span>If-Then ルール数</span>
            <input
              type="number"
              min={0}
              max={12}
              value={ifThenLength}
              onChange={(e) => setIfThenLength(e.target.value)}
            />
          </label>
          <label className="row">
            <span>If-Then を表示</span>
            <input
              type="checkbox"
              checked={showIfThen}
              onChange={(e) => setShowIfThen(e.target.checked)}
            />
          </label>
        </fieldset>

        <div className="actions">
          <button type="submit" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
          <Link to="/" className="btn-link">キャンセル</Link>
        </div>
      </form>
    </div>
  );
}
