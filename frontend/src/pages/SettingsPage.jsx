// src/pages/SettingsPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './SettingsPage.css';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../contexts/ThemeContext';
import { apiFetch } from '../lib/api';

function SettingsPreview({
  valueDisplay,
  flagsDisplay,
  itrDisplay,
  flagsLength,
  ifThenLength
}) {
  const today = new Date();
  const dayNumberText = String(today.getDate());
  const flags = Array.from({ length: Math.max(0, flagsLength) }, (_, i) => i < Math.ceil(flagsLength / 2));
  const ifthen = Array.from({ length: Math.max(0, ifThenLength) }, (_, i) => i < Math.ceil(ifThenLength / 2));
  const value = 42;

  return (
    <div className="preview-card">
      <div className="preview-title">プレビュー</div>
      <div className="fc-daygrid-day-frame preview-cell">
        <div className="fc-daygrid-day-top">
          <span className="fc-daygrid-day-number">{dayNumberText}</span>
        </div>
        <div className="habit-row" onClick={(e) => e.stopPropagation()}>
          {valueDisplay && (
            <input
              className="habit-input"
              type="number"
              min={0}
              max={100}
              value={value}
              readOnly
              onClick={(e) => e.stopPropagation()}
              title="Value（プレビュー）"
            />
          )}
          {flagsDisplay && (
            <div className="habit-box" title="Flags（プレビュー）">
              <div className="habit-circles">
                {flags.map((on, i) => (
                  <span key={i} className={on ? 'circle filled' : 'circle'} />
                ))}
              </div>
            </div>
          )}
          {itrDisplay && (
            <div className="habit-box ifthen-box" title="If-Then（プレビュー）">
              <div className="habit-circles ifthen-circles">
                {ifthen.map((on, i) => (
                  <span key={i} className={on ? 'circle ifthen-filled' : 'circle ifthen'} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="preview-hint">設定を変更するとここに即時反映・自動保存されます</div>
    </div>
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [savedAt, setSavedAt] = useState(0); // 成功時刻（トースト用）

  // ThemeContext
  const { theme: currentTheme, toggleTheme } = useTheme(); // 'light' | 'dark'

  // 設定（保存候補）
  const [prefTheme, setPrefTheme]           = useState('default'); // 'default' | 'light' | 'dark'
  const [valueDisplay, setValueDisplay]     = useState(true);
  const [flagsDisplay, setFlagsDisplay]     = useState(true);
  const [itrDisplay,   setItrDisplay]       = useState(true);
  const [flagsLength,  setFlagsLength]      = useState(3);
  const [ifThenLength, setIfThenLength]     = useState(1);

  // 初回ロード完了フラグ & 直近送信済みペイロード
  const readyRef = useRef(false);
  const lastSentRef = useRef('');

  // 初期読み込み
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch('/api/settings');

        const savedTheme = data?.theme ?? 'default';
        setPrefTheme(savedTheme);

        // 表示テーマを保存値に必要時のみ合わせる
        if (savedTheme === 'light' && currentTheme !== 'light') toggleTheme();
        if (savedTheme === 'dark'  && currentTheme !== 'dark')  toggleTheme();

        const r = data?.routine ?? {};
        const v = r.value ?? {};
        const f = r.flags ?? {};
        const i = r.if_then_rules ?? {};

        if (typeof v.display === 'boolean') setValueDisplay(v.display);
        if (typeof f.display === 'boolean') setFlagsDisplay(f.display);
        if (typeof i.display === 'boolean') setItrDisplay(i.display);

        if (typeof f.length === 'number') setFlagsLength(f.length);
        if (typeof i.length === 'number') setIfThenLength(i.length);
      } catch {
        setError('設定の読み込みに失敗しました');
      } finally {
        setLoading(false);
        readyRef.current = true; // ここから自動保存を有効化
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 固定モード中は ThemeToggle 操作に追従して保存候補も更新
  useEffect(() => {
    if (prefTheme !== 'default' && currentTheme !== prefTheme) {
      setPrefTheme(currentTheme);
    }
  }, [currentTheme, prefTheme]);

  // 送信するペイロードをメモ化
  const payload = useMemo(() => ({
    theme: prefTheme,
    routine: {
      value: { display: Boolean(valueDisplay) },
      flags: { display: Boolean(flagsDisplay), length: Number(flagsLength) },
      if_then_rules: { display: Boolean(itrDisplay), length: Number(ifThenLength) },
    },
  }), [prefTheme, valueDisplay, flagsDisplay, itrDisplay, flagsLength, ifThenLength]);

  // 変更を自動保存（500msデバウンス）
  useEffect(() => {
    if (!readyRef.current) return; // 初期ロード中は送らない

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const json = JSON.stringify(payload);
      if (json === lastSentRef.current) return; // 同一内容は送らない

      try {
        setSaving(true);
        setError('');
        await apiFetch('/api/settings', {
          method: 'POST',
          body: json,
          signal: controller.signal,
        });
        lastSentRef.current = json;
        setSavedAt(Date.now());
      } catch (e) {
        if (e.name !== 'AbortError') {
          setError('保存に失敗しました');
        }
      } finally {
        setSaving(false);
      }
    }, 500);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [payload]);

  if (loading) return <div className="settings-page"><p>読み込み中…</p></div>;

  return (
    <div className="settings-page">
      <div className="header">
        <h1 className="calendar-title">設定</h1>
        <div className="header-right">
          {/* 保存状態の軽いインジケータ */}
          {saving && <span className="muted">保存中…</span>}
          {!saving && savedAt > 0 && <span className="muted">保存しました</span>}
          <Link to="/" className="icon-btn" aria-label="カレンダーに戻る" title="戻る">←</Link>
        </div>
      </div>

      <div className="settings-layout">
        <aside className="preview-pane">
          <SettingsPreview
            valueDisplay={valueDisplay}
            flagsDisplay={flagsDisplay}
            itrDisplay={itrDisplay}
            flagsLength={flagsLength}
            ifThenLength={ifThenLength}
          />
        </aside>

        <section className="form-pane">
          {error && <div className="error">{error}</div>}

          {/* ===== テーマ設定（ThemeToggle連携・即時保存） ===== */}
          <fieldset className="settings-form">
            <legend>テーマ</legend>

            {/* モード選択 */}
            <div className="settings-group">
              <label className="row">
                <span>モード</span>
                <div>
                  <label style={{ marginRight: 12 }}>
                    <input
                      type="radio"
                      name="themeMode"
                      value="default"
                      checked={prefTheme === 'default'}
                      onChange={() => setPrefTheme('default')}
                    />
                    システムに追従
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="themeMode"
                      value={currentTheme}
                      checked={prefTheme !== 'default'}
                      onChange={() => setPrefTheme(currentTheme)}
                    />
                    固定（下のトグルで指定）
                  </label>
                </div>
              </label>
            </div>

            {/* 固定時だけ ThemeToggle を表示 */}
            {prefTheme !== 'default' && (
              <div className="settings-group">
                <label className="row">
                  <span>固定テーマ</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ThemeToggle />
                    <span className="muted">
                      現在の表示: <strong>{currentTheme}</strong>（この値を保存）
                    </span>
                  </div>
                </label>
              </div>
            )}
          </fieldset>

          {/* ===== 習慣トラッカー（即時保存） ===== */}
          <fieldset className="settings-form">
            <legend>習慣トラッカー</legend>

            {/* value */}
            <div className="settings-group">
              <label className="row">
                <span>Value を表示</span>
                <input
                  type="checkbox"
                  checked={valueDisplay}
                  onChange={(e) => setValueDisplay(e.target.checked)}
                />
              </label>
            </div>

            {/* flags */}
            <div className="settings-group">
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
                  min={0}
                  max={12}
                  value={flagsLength}
                  onChange={(e) => setFlagsLength(Number(e.target.value))}
                />
              </label>
            </div>

            {/* if_then_rules */}
            <div className="settings-group">
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
            </div>
          </fieldset>
        </section>
      </div>
    </div>
  );
}
