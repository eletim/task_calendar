// frontend/src/components/TodoSidebar.jsx

import React, { useState, useEffect, useRef } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Draggable } from '@fullcalendar/interaction';
import './TodoSidebar.css';

// --- SortableItem は変更なし ---
function SortableItem({ id, disabled, children, dataEvent, task, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled, data: { task } });
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
        <div
          className="sidebar-task-content"
          style={{
            backgroundColor: task.color || '#3788d8',
            borderColor: task.color || '#3788d8',
            flex: 1,
            cursor: disabled ? 'default' : 'grab'
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

function CategoryDropZone({ id, children, className }) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'category', category: id.replace('cat:', '') },
  });
  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{
        outline: isOver ? '2px dashed var(--primary)' : 'none',
        borderRadius: 6,
      }}
    >
      {children}
    </div>
  );
}

export default function TodoSidebar({ tasks, create, update, remove, updateOrder }) {
  // --- add 用ステートをカテゴリ単位に ---
  const [addingCategory, setAddingCategory] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [inputColor, setInputColor] = useState('#3788d8');

  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingColor, setEditingColor] = useState('#3788d8');
  const [editingCategory, setEditingCategory] = useState('normal');

  const [normalOpen, setNormalOpen] = useState(true);
  const [lowOpen, setLowOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);

  const editInputRef = useRef(null);
  const COLORS = ['#3788d8', '#d81b60', '#388e3c', '#f57c00', '#7b1fa2', '#607d8b'];

  // dnd-kit 用センサー
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // FullCalendar Draggable 初期化（変更なし）
  useEffect(() => {
    const lists = document.querySelectorAll('.sidebar-task-list');
    const draggables = Array.from(lists).map(listEl =>
      new Draggable(listEl, {
        itemSelector: '.sidebar-task-item',
        eventData: contentEl => {
          const taskItem = contentEl.closest('.sidebar-task-item');
          return JSON.parse(taskItem.getAttribute('data-event'));
        }
      })
    );
    return () => draggables.forEach(d => d.destroy());
  }, [tasks, normalOpen, lowOpen, recurringOpen]);

  // 編集モードフォーカス（変更なし）
  useEffect(() => {
    if (editingId !== null && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  // --- add フォーム制御関数 ---
  const resetAdd = () => {
    setAddingCategory(null);
    setInputValue('');
    setInputColor('#3788d8');
  };
  const handleAddClick = category => {
    resetAdd();
    setAddingCategory(category);
    setEditingId(null);
  };
  const handleAddCancel = () => resetAdd();
  const handleAddSubmit = (e, category) => {
    e.preventDefault();
    const title = inputValue.trim();
    if (!title) return;
    create(title, null, inputColor, category);
    resetAdd();
  };

  // 編集ハンドラ（変更なし）
  const startEdit = t => {
    if (editingId === t.id) {
      editInputRef.current?.focus();
    } else {
      setEditingId(t.id);
      setEditingTitle(t.title);
      setEditingColor(t.color || '#3788d8');
      setEditingCategory(t.category || 'normal');
      resetAdd();
    }
  };
  const handleEditSubmit = e => {
    e.preventDefault();
    update(editingId, {
      title: editingTitle,
      color: editingColor,
      category: editingCategory
    });
    setEditingId(null);
  };
  const handleDuplicate = () => {
    create(editingTitle, null, editingColor, editingCategory);
    setEditingId(null);
  };
  const handleDelete = () => {
    remove(editingId);
    setEditingId(null);
  };
  const handleEditCancel = () => setEditingId(null);

  // ドラッグ終了（変更なし）
  const handleDragEnd = event => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeTask = tasks.find(t => String(t.id) === active.id);
    const overTask = tasks.find(t => String(t.id) === over.id);

    // --- カテゴリヘッダー/ドロップラインに落ちた場合（閉じていてもOK）
    const overData = over.data?.current;
    if (overData?.type === 'category') {
      const targetCategory = overData.category;
      // そのカテゴリの末尾に並べ替え
      const target = tasks
        .filter(t => t.category === targetCategory && t.date === null)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      // カテゴリ変更
      if (activeTask && activeTask.category !== targetCategory) {
        update(active.id, { category: targetCategory });
      }
      // 末尾に置かれた前提で order を振り直し
      const newList = [...target, { ...activeTask, category: targetCategory }];
      newList.forEach((task, i) => updateOrder?.(task.id, i, targetCategory));
      return;
    }
    if (!activeTask || !overTask) return;

    if (activeTask.category === overTask.category) {
      const same = tasks
        .filter(t => t.category === activeTask.category && t.date === null)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      const oldIndex = same.findIndex(t => String(t.id) === active.id);
      const newIndex = same.findIndex(t => String(t.id) === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(same, oldIndex, newIndex);
        newOrder.forEach((task, i) => updateOrder?.(task.id, i, task.category));
      }
    } else {
      const target = tasks
        .filter(t => t.category === overTask.category && t.date === null)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      const idx = target.findIndex(t => String(t.id) === over.id);
      const newList = [...target];
      newList.splice(idx, 0, { ...activeTask, category: overTask.category });
      update(active.id, { category: overTask.category });
      newList.forEach((task, i) => updateOrder?.(task.id, i, task.category));
    }
  };

  // タスクアイテム描画（変更なし）
  const renderTaskItem = t => (
    <SortableItem
      key={t.id}
      id={String(t.id)}
      disabled={editingId === t.id || addingCategory !== null}
      task={t}
      onEdit={startEdit}
      dataEvent={JSON.stringify({
        id: t.id,
        title: t.title,
        color: t.color,
        category: t.category
      })}
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

  // --- カテゴリごとのセクション描画 + インライン追加フォーム ---
  const renderSection = (category, label, isOpen, setOpen, filterFn) => {
    const items = tasks
      .filter(t => t.date === null)
      .filter(filterFn)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    return (
      <div className="sidebar-category" data-category={category}>
        <CategoryDropZone id={`cat:${category}`} className="category-header-wrap">
          <h3 className="category-header" onClick={() => setOpen(!isOpen)}>
            {label} {isOpen ? '▾' : '▸'}
          </h3>
          {isOpen && (
            <button
              className="category-add-btn"
              onClick={() => handleAddClick(category)}
            >
              ＋
            </button>
          )}
        </CategoryDropZone>

        {addingCategory === category && (
          <form
            className="sidebar-form"
            onSubmit={e => handleAddSubmit(e, category)}
          >
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
                  className={`color-swatch${
                    inputColor === c ? ' selected' : ''
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setInputColor(c)}
                />
              ))}
            </div>
            <div className="sidebar-button-group">
              <button type="submit">追加</button>
              <button type="button" onClick={handleAddCancel}>
                キャンセル
              </button>
            </div>
          </form>
        )}

        {isOpen && items.length > 0 && (
          <SortableContext
            items={items.map(t => String(t.id))}
            strategy={verticalListSortingStrategy}
          >
            <ul className="sidebar-task-list">
              {items.map(renderTaskItem)}
            </ul>
          </SortableContext>
        )}
      </div>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="sidebar">

        {renderSection(
          'normal',
          '通常のタスク',
          normalOpen,
          setNormalOpen,
          t => t.category === 'normal'
        )}
        {renderSection(
          'low',
          '低優先度のタスク',
          lowOpen,
          setLowOpen,
          t => t.category !== 'normal' && t.category !== 'recurring'
        )}
        {renderSection(
          'recurring',
          '繰り返しのタスク',
          recurringOpen,
          setRecurringOpen,
          t => t.category === 'recurring'
        )}
      </div>
    </DndContext>
  );
}
