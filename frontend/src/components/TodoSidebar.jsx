// frontend/src/components/TodoSidebar.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Draggable } from '@fullcalendar/interaction';

export default function TodoSidebar({ tasks, create, update, remove }) {
  const [isAdding, setIsAdding]         = useState(false);
  const [inputValue, setInputValue]     = useState('');
  const [inputColor, setInputColor]     = useState('#3788d8');
  const [inputCategory, setInputCategory]       = useState('normal');
  const [editingId, setEditingId]       = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingColor, setEditingColor] = useState('#3788d8');
  const [editingCategory, setEditingCategory]   = useState('normal');
  const [filter, setFilter]                     = useState('all');
  const listRef                         = useRef(null);
  const editInputRef                    = useRef(null);
  const COLORS = ['#3788d8', '#d81b60', '#388e3c', '#f57c00', '#7b1fa2', '#607d8b'];

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
  const handleAddCancel  = () => { setIsAdding(false); setInputValue(''); setInputCategory('normal');};
  const handleAddSubmit  = e => {
    e.preventDefault();
    const title = inputValue.trim();
    if (!title) return;
    create(title, null, inputColor, inputCategory);
    setInputColor('#3788d8'); setIsAdding(false);
  };

  // 編集開始／フォーム操作
  const startEdit        = t => {
    if (editingId === t.id) {
      editInputRef.current?.focus();
    } else {
      setEditingId(t.id);
      setEditingTitle(t.title);
      setEditingColor(t.color || '#3788d8');
      setIsAdding(false);
    }
  };
  const handleEditSubmit = e => {
    e.preventDefault();
    update(editingId, { title: editingTitle, color: editingColor, category: editingCategory });
    setEditingId(null);
  };
  const handleDuplicate  = () => {
    // 新規追加と同様に、第2引数に null、第3引数にカラーを渡す
    create(editingTitle, null, editingColor, editingCategory);
    setEditingId(null);
  };
  const handleDelete     = () => { remove(editingId); setEditingId(null); };
  const handleEditCancel = () => setEditingId(null);

  return (
    <div className="sidebar">
      <h2>To Do リスト</h2>
      {/* カテゴリーフィルター */}
      <div className="category-filter">
        <button onClick={() => setFilter('all')}>すべて</button>
        <button onClick={() => setFilter('normal')}>通常</button>
        <button onClick={() => setFilter('recurring')}>繰り返し</button>
        <button onClick={() => setFilter('low')}>低優先度</button>
      </div>

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
        <div className="color-picker">
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              className={`color-swatch${inputColor===c?' selected':''}`}
              style={{ backgroundColor: c }}
              onClick={() => setInputColor(c)}
            />
          ))}
        </div>
          {/* カテゴリー選択 */}
          <select
            value={inputCategory}
            onChange={e => setInputCategory(e.target.value)}
          >
            <option value="normal">通常</option>
            <option value="recurring">繰り返し</option>
            <option value="low">低優先度</option>
          </select>
          <div className="sidebar-button-group">
            <button type="submit">追加</button>
            <button type="button" onClick={handleAddCancel}>キャンセル</button>
          </div>
        </form>
      )}

      <ul ref={listRef} className="sidebar-task-list">
        {tasks
           .filter(t => t.date === null)
           .filter(t => filter === 'all' || t.category === filter)
           .map(t => (
          <li
            key={t.id}
            className="sidebar-task-item"
            data-event={JSON.stringify({ id: t.id, title: t.title, color: t.color, category: t.category})}
          >
            <div
              className="sidebar-task-content"
              style={{ backgroundColor: t.color || '#3788d8', borderColor: t.color || '#3788d8' }}
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
                {/* カテゴリー選択 */}
                <select
                  value={editingCategory}
                  onChange={e => setEditingCategory(e.target.value)}
                >
                  <option value="normal">通常</option>
                  <option value="recurring">繰り返し</option>
                  <option value="low">低優先度</option>
                </select>
                <div className="color-picker">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`color-swatch${editingColor===c?' selected':''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setEditingColor(c)}
                    />
                  ))}
                </div>
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
