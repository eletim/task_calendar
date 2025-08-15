// frontend/src/App.js
import React, { useState, useRef, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react';
import jaLocale from '@fullcalendar/core/locales/ja';
import dayGridPlugin  from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import './index.css';
import ThemeToggle from './components/ThemeToggle';
import { ThemeProvider } from './contexts/ThemeContext';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import SettingsPage from './pages/SettingsPage';
import { useTasks } from './hooks/useTasks';
import TodoSidebar from './components/TodoSidebar';
import { HabitProvider, HabitCell, isHabitTarget } from './components/Habit';
import { useTheme } from './contexts/ThemeContext';


function InnerApp() {
  // useTasks フックで tasks と CRUD 関数を取得
  const { tasks, create, update, remove } = useTasks();
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const calendarRef                      = useRef(null);
  const { theme, toggleTheme }           = useTheme();  // 現在のテーマとトグル関数を取得

  // 起動時に保存されたテーマを適用
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        const saved = data?.theme;
        if (saved === 'dark' && theme !== 'dark') {
          toggleTheme(); // 現在が light なら dark に切り替え
        } else if (saved === 'light' && theme !== 'light') {
          toggleTheme(); // 現在が dark なら light に切り替え
        }
        // saved が 'default' または undefined の場合は何もしない。
        // 既存の ThemeProvider がブラウザのカラースキームを使います。
      })
      .catch((err) => {
        console.error('設定の読み込みに失敗しました', err);
      });
  }, []); // 初回マウント時に一度だけ実行

  // サイドバー判定用
  const dropInsideSidebar = jsEvent => {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return false;
    const rect    = sidebar.getBoundingClientRect();
    const { clientX: x, clientY: y } = jsEvent;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  // FullCalendar 用に tasks を変換
  const events = tasks.map(t => ({
    id:      t.id,
    title:   t.title,
    start:   t.date,
    done:    t.done,
    backgroundColor: t.color,
    borderColor:     t.color,
    category:         t.category, 
    color:            t.color     
  }));

  // ─── 日付クリック ──────────────────────────────────
  const handleDateClick = (arg) => {
    // habit 系のクリックなら無視する
    if (isHabitTarget(arg.jsEvent?.target)) return;

    const api = calendarRef.current.getApi();

    if (api.view.type === 'dayGridWeek') {
      api.changeView('dayGridDay', arg.date);  // 🆕 週表示のときは1日表示に切り替える
      return;  // 🆕 フォームを開かないように return
    }

    if (api.view.type === 'dayGridDay') {
      const startDate = new Date(arg.date);
      startDate.setDate(startDate.getDate() - 3); // 中央寄せのため前に3日戻す
      api.changeView('dayGridWeek', startDate);
      return; // フォーム開かない
    }

    if (api.view.type === 'dayGridMonth') {
      const startDate = new Date(arg.date);
      startDate.setDate(startDate.getDate() - 3);
      api.changeView('dayGridWeek', startDate);
    }
  };

  // ─── イベント編集／削除／複製 ────────────────────────
  const handleEventClick = clickInfo => {
    const ev = clickInfo.event;
    setEditingEvent({ id: ev.id, title: ev.title, date: ev.startStr });
    setEditingTitle(ev.title);
  };
  const handleCancelEdit = () => {
    setEditingEvent(null);
    setEditingTitle('');
  };
  const handleUpdateEvent = e => {
    e.preventDefault();
    update(editingEvent.id, { title: editingTitle });
    handleCancelEdit();
  };
  const handleDuplicateEvent = () => {
    create(editingEvent.title, editingEvent.date);
    handleCancelEdit();
  };
  const handleDeleteEvent = () => {
    remove(editingEvent.id);
    handleCancelEdit();
  };

  // ─── チェックボックス／ドラッグ＆ドロップ ────────────
  const renderEventContent = arg => {
    const { id }   = arg.event;
    const done     = arg.event.extendedProps.done;
    return (
      <div className={`task-item${done ? ' done' : ''}`}>
        <input
          type="checkbox"
          checked={!!done}
          onChange={e => {
            e.stopPropagation();
            update(id, { done: !done });
          }}
        />
        <span> {arg.event.title} </span>
      </div>
    );
  };

  const handleEventDrop = dropInfo => {
    const ev   = dropInfo.event;
    const done = ev.extendedProps.done;
    if (done) {
      dropInfo.revert();
      return;
    }
    update(ev.id, { date: ev.startStr });
  };

  // 現在ホバー中のカテゴリに .is-hovered を付ける
  const setSidebarHoverByPoint = (clientX, clientY) => {
    // 既存ハイライトを解除
    document.querySelectorAll('.sidebar-category.is-hovered')
      .forEach(el => el.classList.remove('is-hovered'));

    // 1) 下層まで見る（対応ブラウザ）
    const stack = document.elementsFromPoint?.(clientX, clientY) || [];
    let target = null;
    for (const node of stack) {
      const sec = node.closest?.('.sidebar-category');
      if (sec) { target = sec; break; }
    }

    // 2) フォールバック：矩形ヒットテスト
    if (!target) {
      document.querySelectorAll('.sidebar-category').forEach(sec => {
        const r = sec.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
          target = sec;
        }
      });
    }

    if (target) target.classList.add('is-hovered');
  };

  // すべてのハイライトを消す
  const clearSidebarHover = () => {
    document.querySelectorAll('.sidebar-category.is-hovered')
      .forEach(el => el.classList.remove('is-hovered'));
  };

  return (
    <div className="app-container">
      <div className="calendar-container">
        <div className="header">
          <h1 className="calendar-title">タスクカレンダーv0.1</h1>
          <div className="header-actions">
            <ThemeToggle />
            <Link to="/settings" className="icon-btn" aria-label="設定を開く" title="設定">
              <Settings size={18} />
            </Link>
          </div>
        </div>

        {editingEvent && (
          <div className="edit-form">
            <form onSubmit={handleUpdateEvent} className="form-inline">
              <span>{editingEvent.date}</span>
              <input
                type="text"
                value={editingTitle}
                onChange={e => setEditingTitle(e.target.value)}
                required
              />
              <button type="submit">更新</button>
              <button type="button" onClick={handleDuplicateEvent}>複製</button>
              <button type="button" onClick={handleDeleteEvent}>削除</button>
              <button type="button" onClick={handleCancelEdit}>キャンセル</button>
            </form>
          </div>
        )}

        <HabitProvider>
        <FullCalendar
         locale={jaLocale} 
          ref={calendarRef}
          plugins={[ dayGridPlugin, interactionPlugin ]}
          timeZone="local"
          initialView="dayGridMonth"
          editable={true}
          droppable={true}
          eventReceive={async info => {
            const ev   = info.event;
            const id   = ev.id;
            const date = ev.startStr;
                   
            // ドロップされたイベントIDから、ローカルstateのtasksを検索
            const task = tasks.find(t => String(t.id) === String(id));
            if (!task) {
              console.error(`Task not found for id=${id}`, info.event);
              return;
            }
            const { title, color, category } = task;
         
            // 1) 元タスクをカレンダーに移動
            update(id, { date });
           
            // 2) 繰り返しタスクならサイドバーに複製
            if (category === 'recurring') {
              create(title, null, color, category);
            }
          }}
          eventDragStart={(info) => {
            // マウス or タッチ移動でホバー判定
            const onMove = (e) => {
              const point = 'touches' in e ? e.touches[0] : e;
              if (!point) return;
              setSidebarHoverByPoint(point.clientX, point.clientY);
            };
            const onEnd = () => {
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('touchmove', onMove);
              document.removeEventListener('mouseup', onEnd);
              document.removeEventListener('touchend', onEnd);
              clearSidebarHover();
            };

            document.addEventListener('mousemove', onMove, { passive: true });
            document.addEventListener('touchmove', onMove, { passive: true });
            document.addEventListener('mouseup', onEnd, { passive: true });
            document.addEventListener('touchend', onEnd, { passive: true });
          }}
          eventDragStop={info => {
            // カレンダー → サイドバー
            if (dropInsideSidebar(info.jsEvent)) {
              const { clientX, clientY } = info.jsEvent;
              const el = document.elementFromPoint(clientX, clientY);
              const section = el && el.closest?.('.sidebar-category');
              const category = section?.getAttribute('data-category'); // 'normal' | 'low' | 'recurring' など
              const payload = { date: null };
              if (category) payload.category = category;
              update(info.event.id, payload);
              clearSidebarHover();
            }
          }}
          eventDrop={handleEventDrop}
          eventClick={handleEventClick}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek,dayGridDay'
          }}
          views={{
            dayGridMonth: {
              buttonText: '月'
            },
            dayGridWeek: {
              type: 'dayGrid',
              duration: { days: 7 },
              buttonText: '週'
            },
            dayGridDay: {
              buttonText: '日'
            }
          }}
          events={events}
          eventContent={renderEventContent}
          dateClick={handleDateClick}
          dayCellContent={(arg) => (
            <HabitCell date={arg.date} dayNumberText={arg.dayNumberText} />
          )}
          height="auto"
        />
        </HabitProvider>
      </div>

      <TodoSidebar
         tasks={tasks}
         create={create}
         update={update}
         remove={remove}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<InnerApp />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
