// frontend/src/components/ThemeToggle.jsx
import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeToggle.css';
import { apiFetch } from '../lib/api';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const saveThemeSetting = (newTheme) => {
    apiFetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ theme: newTheme })
    }).catch((err) => {
      console.error('テーマ設定の保存に失敗しました', err);
    });
  };

  return (
    <div className="theme-toggle">
      {/* Light アイコン */}
      <button
        type="button"
        aria-pressed={theme === 'light'}
        className={`theme-toggle-button ${theme === 'light' ? 'active' : ''}`}
        onClick={() => {
          // 既に light なら何もしない
          if (theme !== 'light') {
            toggleTheme();
            saveThemeSetting('light');
          }
        }}
      >
        <Sun size={20} />
      </button>

      {/* Dark アイコン */}
      <button
        type="button"
        aria-pressed={theme === 'dark'}
        className={`theme-toggle-button ${theme === 'dark' ? 'active' : ''}`}
        onClick={() => {
          // 既に dark なら何もしない
          if (theme !== 'dark') {
            toggleTheme();
            saveThemeSetting('dark');
          }
        }}
      >
        <Moon size={20} />
      </button>
    </div>
  );
}
