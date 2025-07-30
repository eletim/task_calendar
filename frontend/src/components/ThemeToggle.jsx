// frontend/src/components/ThemeToggle.jsx
import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="theme-toggle">
      {/* Light アイコン */}
      <button
        type="button"
        aria-pressed={theme === 'light'}
        className={`theme-toggle-button ${theme === 'light' ? 'active' : ''}`}
        onClick={() => {
          if (theme !== 'light') toggleTheme();
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
          if (theme !== 'dark') toggleTheme();
        }}
      >
        <Moon size={20} />
      </button>
    </div>
  );
}
