// src/pages/SettingsPage.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [saved,   setSaved]   = useState(false);

  // 設定値
  const [theme, setTheme]                 = useState('default'); // 'light' | 'dark' | 'default'
  // display（新）
  const [valueDisplay, setValueDisplay]   = useState(true);
  const [flagsDisplay, setFlagsDisplay]   = useState(true);
  const [itrDisplay,   setItrDisplay]     = useState(true); // if_then_rules.display

  // length
  const [flagsLength, setFlagsLength]     = useState(3);
  const [ifThenLength, setIfThenLength]   = useState(1); // 既定 1（サーバと合わせる）

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error();
        const data = await res.json();

        if (data?.theme) setTheme(data.theme);

        const r = data?.routine ?? {};
        const v = r.value ?? {};
        const f = r.flags ?? {};
        const i = r.if_then_rules ?? {};

        // display
        if (typeof v.display === 'boolean') setValueDisplay(v.display);
        if (typeof f.display === 'boolean') setFlagsDisplay(f.display);
        if (typeof i.display === 'boolean') setItrDisplay(i.display);

        // length
        if (typeof f.length === 'number') setFlagsLength(f.length);
        if (typeof i.length === 'number') setIfThenLength(i.length);
      } catch {
        setError('設定の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');

    try {
      const payload = {
        theme,
        routine: {
          value: { display: Boolean(valueDisplay) },
          flags: { display: Boolean(flagsDisplay), length: Number(flagsLength) },
          if_then_rules: { display: Boolean(itrDisplay), length: Number(ifThenLength) },
        },
      };

      const res = await fetch('/api/settings', {
        method: 'POST', // サーバで POST/PUT 両対応ならどちらでもOK
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();

      setSaved(true);
    } catch {
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
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        {error && <div className="error">{error}</div>}
        {saved && !error && <div className="success">保存しました</div>}

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

          {/* value */}
          <label className="row">
            <span>Value を表示</span>
            <input
              type="checkbox"
              checked={valueDisplay}
              onChange={(e) => setValueDisplay(e.target.checked)}
            />
          </label>

          {/* flags */}
          <label className="row">
            <span>Flags を表示</span>
            <input
              type="checkbox"
              checked={flagsDisplay}
              onChange={(e) => setFlagsDisplay(e.target.checked)}
            />
          </label>
          <label className="row">
            <span>フラグ数</span>
            <input
              type="number"
              min={1}
              max={12}
              value={flagsLength}
              onChange={(e) => setFlagsLength(Number(e.target.value))}
            />
          </label>

          {/* if_then_rules */}
          <label className="row">
            <span>If-Then を表示</span>
            <input
              type="checkbox"
              checked={itrDisplay}
              onChange={(e) => setItrDisplay(e.target.checked)}
            />
          </label>
          <label className="row">
            <span>If-Then ルール数</span>
            <input
              type="number"
              min={0}
              max={12}
              value={ifThenLength}
              onChange={(e) => setIfThenLength(Number(e.target.value))}
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
