// frontend/src/components/TodoSidebar.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Draggable } from '@fullcalendar/interaction';

export default function TodoSidebar({ tasks, create }) {
  const [isAdding, setIsAdding]     = useState(false);
  const [inputValue, setInputValue] = useState('');
  const listRef                     = useRef(null);

  // サイドバーの <ul> を“外部ドラッガブル”に初期化
  useEffect(() => {
    const draggable = new Draggable(listRef.current, {
      itemSelector: 'li',
      eventData: el => JSON.parse(el.getAttribute('data-event')),
    });
    return () => draggable.destroy();
  }, [tasks]);

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
        <button onClick={handleAddClick}>+ タスクを追加</button>
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
          <button type="button" onClick={handleCancel}>キャンセル</button>
        </form>
      )}

      <ul ref={listRef}>
        {tasks
          .filter(t => t.date === null)
          .map(t => (
            <li
              key={t.id}
              data-event={JSON.stringify({ id: t.id, title: t.title })}
            >
              {t.title}
            </li>
          ))
        }
      </ul>
    </div>
  );
}
