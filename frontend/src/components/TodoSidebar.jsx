/* Fixed TodoSidebar.jsx - 全体ドラッグ対応 */
import React, { useState, useEffect, useRef } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripHorizontal as DragHandleIcon } from 'lucide-react';
import { Draggable } from '@fullcalendar/interaction';

// Sortable item wrapper
function SortableItem({ id, disabled, children, dataEvent, task, onEdit }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id,
    disabled,
    data: { task }
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto'
  };

  return (
    <li 
      ref={setNodeRef}
      style={style}
      className="sidebar-task-item"
      data-event={dataEvent}
      {...attributes}
      {...listeners}
    >
      <div className="sidebar-task-wrapper">
        {/* ドラッグハンドル - 見た目用 */}
        <div 
          className="drag-handle" 
          style={{ cursor: disabled ? 'default' : 'grab' }}
        >
          <DragHandleIcon size={16} />
        </div>
        
        {/* タスクコンテンツ - クリックのみ */}
        <div
          className="sidebar-task-content"
          style={{ 
            backgroundColor: task.color || '#3788d8', 
            borderColor: task.color || '#3788d8',
            flex: 1
          }}
          onClick={() => onEdit(task)}
        >
          {task.title}
        </div>
      </div>
      {children}
    </li>
  );
}

export default function TodoSidebar({ tasks, create, update, remove, updateOrder }) {
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputColor, setInputColor] = useState('#3788d8');
  const [inputCategory, setInputCategory] = useState('normal');
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingColor, setEditingColor] = useState('#3788d8');
  const [editingCategory, setEditingCategory] = useState('normal');
  const [normalOpen, setNormalOpen] = useState(true);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [lowOpen, setLowOpen] = useState(false);
  const editInputRef = useRef(null);
  const COLORS = ['#3788d8', '#d81b60', '#388e3c', '#f57c00', '#7b1fa2', '#607d8b'];

  // dnd-kit 用センサー
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  // FullCalendar Draggable 初期化
  useEffect(() => {
    const lists = document.querySelectorAll('.sidebar-task-list');
    const draggables = Array.from(lists).map(listEl =>
      new Draggable(listEl, {
        itemSelector: '.sidebar-task-item',
        eventData: contentEl => {
          const taskItem = contentEl.closest('.sidebar-task-item');
          return JSON.parse(taskItem.getAttribute('data-event'));
        },
        ignore: '.drag-handle'
      })
    );
    return () => draggables.forEach(d => d.destroy());
  }, [tasks, normalOpen, lowOpen, recurringOpen]);

  // 編集モードでフォーカス
  useEffect(() => {
    if (editingId !== null && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  // フォームハンドラ
  const handleAddClick = () => setIsAdding(true);
  const handleAddCancel = () => {
    setIsAdding(false);
    setInputValue('');
    setInputCategory('normal');
  };
  const handleAddSubmit = e => {
    e.preventDefault();
    const title = inputValue.trim();
    if (!title) return;
    create(title, null, inputColor, inputCategory);
    setInputValue('');
    setInputColor('#3788d8');
    setInputCategory('normal');
    setIsAdding(false);
  };

  // 編集ハンドラ
  const startEdit = t => {
    if (editingId === t.id) {
      editInputRef.current?.focus();
    } else {
      setEditingId(t.id);
      setEditingTitle(t.title);
      setEditingColor(t.color || '#3788d8');
      setEditingCategory(t.category || 'normal');
      setIsAdding(false);
    }
  };
  const handleEditSubmit = e => {
    e.preventDefault();
    update(editingId, { title: editingTitle, color: editingColor, category: editingCategory });
    setEditingId(null);
  };
  const handleDuplicate = () => {
    create(editingTitle, null, editingColor, editingCategory);
    setEditingId(null);
  };
  const handleDelete = () => { remove(editingId); setEditingId(null); };
  const handleEditCancel = () => setEditingId(null);

  // dnd-kit ドラッグ終了
  const handleDragEnd = event => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = active.id;
    const overId = over.id;
    const activeTask = tasks.find(t => String(t.id) === activeId);
    const overTask = tasks.find(t => String(t.id) === overId);
    if (!activeTask || !overTask) return;

    if (activeTask.category === overTask.category) {
      const categoryTasks = tasks
        .filter(t => t.category === activeTask.category && t.date === null)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      const oldIndex = categoryTasks.findIndex(t => String(t.id) === activeId);
      const newIndex = categoryTasks.findIndex(t => String(t.id) === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(categoryTasks, oldIndex, newIndex);
        newOrder.forEach((task, index) => updateOrder?.(task.id, index, task.category));
      }
    } else {
      const targetCategory = overTask.category;
      const targetTasks = tasks
        .filter(t => t.category === targetCategory && t.date === null)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      const newIndex = targetTasks.findIndex(t => String(t.id) === overId);
      const newOrder = [...targetTasks];
      newOrder.splice(newIndex, 0, { ...activeTask, category: targetCategory });
      update(activeId, { category: targetCategory });
      newOrder.forEach((task, index) => updateOrder?.(task.id, index, targetCategory));
    }
  };

  // タスクアイテム表示
  const renderTaskItem = t => (
    <SortableItem
      key={t.id}
      id={String(t.id)}
      disabled={editingId === t.id || isAdding}
      task={t}
      onEdit={startEdit}
      dataEvent={JSON.stringify({ id: t.id, title: t.title, color: t.color, category: t.category })}
    >
      {editingId === t.id && (
        <form className="sidebar-edit-form" onSubmit={handleEditSubmit}>
          <input
            ref={editInputRef}
            type="text"
            value={editingTitle}
            onChange={e => setEditingTitle(e.target.value)}
            required
          />
          <select value={editingCategory} onChange={e => setEditingCategory(e.target.value)}>
            <option value="normal">通常</option>
            <option value="recurring">繰り返し</option>
            <option value="low">低優先度</option>
          </select>
          <div className="color-picker">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`color-swatch${editingColor === c ? ' selected' : ''}`}
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
    </SortableItem>
  );

  // セクションレンダリング
  const renderSection = ({ label, isOpen, setOpen, filterFn }) => {
    const items = tasks
      .filter(t => t.date === null)
      .filter(filterFn)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    return (
      <div className="sidebar-category">
        <h3 className="category-header" onClick={() => setOpen(!isOpen)}>
          {label} {isOpen ? '▾' : '▸'}
        </h3>
        {isOpen && items.length > 0 && (
          <SortableContext items={items.map(t => String(t.id))} strategy={verticalListSortingStrategy}>
            <ul className="sidebar-task-list">
              {items.map(renderTaskItem)}
            </ul>
          </SortableContext>
        )}
      </div>
    );
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="sidebar">
        <h2>To Do リスト</h2>
        {!isAdding && editingId === null && <button onClick={handleAddClick}>+ タスクを追加</button>}
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
                  className={`color-swatch${inputColor === c ? ' selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setInputColor(c)}
                />
              ))}
            </div>
            <select value={inputCategory} onChange={e => setInputCategory(e.target.value)}>
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
        {renderSection({ label: '通常のタスク', isOpen: normalOpen, setOpen: setNormalOpen, filterFn: t => t.category === 'normal' })}
        {renderSection({ label: '低優先度のタスク', isOpen: lowOpen, setOpen: setLowOpen, filterFn: t => t.category !== 'normal' && t.category !== 'recurring' })}
        {renderSection({ label: '繰り返しのタスク', isOpen: recurringOpen, setOpen: setRecurringOpen, filterFn: t => t.category === 'recurring' })}
      </div>
    </DndContext>
  );
}
