// frontend/src/components/TodoSidebar.jsx
import React, { useState } from 'react';

export default function TodoSidebar({ tasks, create }) {
  const [isAdding, setIsAdding]     = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleAddClick = () => setIsAdding(true);
  const handleCancel   = () => {
    setIsAdding(false);
    setInputValue('');
  };

  const handleSubmit = e => {
    e.preventDefault();
    const title = inputValue.trim();
    if (!title) return;
    create(title);
    setInputValue('');
    setIsAdding(false);
  };

  return (
    <div className="sidebar">
      <h2>To Do リスト</h2>

      {!isAdding && (
        <button onClick={handleAddClick}>
          + タスクを追加
        </button>
      )}

      {isAdding && (
        <form className="sidebar-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="新しいタスクを入力"
            required
          />
          <button type="submit">追加</button>
          <button type="button" onClick={handleCancel}>
            キャンセル
          </button>
        </form>
      )}

      <ul>
        {tasks.filter(t => !t.done).map(t => (
          <li key={t.id}>{t.title}</li>
        ))}
      </ul>
    </div>
  );
}
