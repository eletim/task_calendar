// frontend/src/components/TodoSidebar.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Draggable } from '@fullcalendar/interaction';

export default function TodoSidebar({ tasks, create, update, remove }) {
  const [isAdding, setIsAdding]         = useState(false);
  const [inputValue, setInputValue]     = useState('');
  const [editingId, setEditingId]       = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const listRef                         = useRef(null);
  const editInputRef                    = useRef(null);

  // ドラッグ初期化: カード要素だけをドラッグ対象にする
  useEffect(() => {
    const draggable = new Draggable(listRef.current, {
      // ここを .sidebar-task-content に変更
      itemSelector: '.sidebar-task-content',
      eventData: contentEl =>
        JSON.parse(contentEl.parentElement.getAttribute('data-event')),
    });
    return () => draggable.destroy();
  }, [tasks]);

  // 編集モード時に必ずフォーカス
  useEffect(() => {
    if (editingId !== null && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  // 新規追加フォーム
  const handleAddClick   = () => setIsAdding(true);
  const handleAddCancel  = () => { setIsAdding(false); setInputValue(''); };
  const handleAddSubmit  = e => {
    e.preventDefault();
    const title = inputValue.trim();
    if (!title) return;
    create(title);
    setInputValue(''); setIsAdding(false);
  };

  // 編集開始／フォーム操作
  const startEdit        = t => {
    if (editingId === t.id) {
      editInputRef.current?.focus();
    } else {
      setEditingId(t.id);
      setEditingTitle(t.title);
      setIsAdding(false);
    }
  };
  const handleEditSubmit = e => {
    e.preventDefault();
    update(editingId, { title: editingTitle });
    setEditingId(null);
  };
  const handleDuplicate  = () => { create(editingTitle); setEditingId(null); };
  const handleDelete     = () => { remove(editingId); setEditingId(null); };
  const handleEditCancel = () => setEditingId(null);

  return (
    <div className="sidebar">
      <h2>To Do リスト</h2>

      {!isAdding && editingId === null && (
        <button onClick={handleAddClick}>+ タスクを追加</button>
      )}
      {isAdding && (
        <form className="sidebar-form" onSubmit={handleAddSubmit}>
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="新しいタスクを入力"
            required
          />
          <div className="sidebar-button-group">
            <button type="submit">追加</button>
            <button type="button" onClick={handleAddCancel}>キャンセル</button>
          </div>
        </form>
      )}

      <ul ref={listRef} className="sidebar-task-list">
        {tasks.filter(t => t.date === null).map(t => (
          <li
            key={t.id}
            className="sidebar-task-item"
            data-event={JSON.stringify({ id: t.id, title: t.title })}
          >
            <div
              className="sidebar-task-content"
              onClick={() => startEdit(t)}
            >
              {t.title}
            </div>

            {editingId === t.id && (
              <form className="sidebar-edit-form" onSubmit={handleEditSubmit}>
                <input
                  ref={editInputRef}
                  type="text"
                  value={editingTitle}
                  onChange={e => setEditingTitle(e.target.value)}
                  required
                />
                <div className="sidebar-button-group">
                  <button type="submit">更新</button>
                  <button type="button" onClick={handleDuplicate}>複製</button>
                  <button type="button" onClick={handleDelete}>削除</button>
                  <button type="button" onClick={handleEditCancel}>キャンセル</button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
