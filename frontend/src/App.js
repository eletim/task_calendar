// frontend/src/App.js
import React, { useState, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin  from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import './index.css';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useTasks } from './hooks/useTasks';
import TodoSidebar from './components/TodoSidebar';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <label className="theme-switch">
      <input
        type="checkbox"
        checked={theme === 'dark'}
        onChange={toggleTheme}
      />
      {theme === 'light' ? '🌞' : '🌙'}
    </label>
  );
}

function InnerApp() {
  // useTasks フックで tasks と CRUD 関数を取得
  const { tasks, create, update, remove } = useTasks();

  const [routines, setRoutines]          = useState({}); // { 'YYYY-MM-DD': { flags:[bool,bool,bool], value:number } }
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const calendarRef                      = useRef(null);

  // サイドバー判定用
  const dropInsideSidebar = jsEvent => {
    const sidebar = document.querySelector('.sidebar');
    const rect    = sidebar.getBoundingClientRect();
    const { clientX: x, clientY: y } = jsEvent;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  // ルーチンの初期データ取得
  useEffect(() => {
    fetch('/api/routines')
      .then(res => res.json())
      .then(data => setRoutines(data));
  }, []);

  // FullCalendar 用に tasks を変換
  const events = tasks.map(t => ({
    id:      t.id,
    title:   t.title,
    start:   t.date,
    done:    t.done,
    backgroundColor: t.color,
    borderColor:     t.color,
  }));

  const toYmd = (d) => {
    const y    = d.getFullYear();
    const m    = String(d.getMonth() + 1).padStart(2, '0');
    const day  = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // ─── 日付クリック ──────────────────────────────────
  const handleDateClick = (arg) => {
    // habit 系のクリックなら無視する
    if (
      arg.jsEvent?.target?.closest('.habit-row') ||
      arg.jsEvent?.target?.closest('.habit-input') ||
      arg.jsEvent?.target?.closest('.habit-box')
    ) {
      return;
    }

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

  // ─── ルーチン ○ クリック ───────────────────────────
  const handleBoxClick = dateStr => {
    const rec         = routines[dateStr] || { flags:[false,false,false], value:0 };
    const filledCount = rec.flags.filter(v => v).length;
    toggleCircle(dateStr, filledCount < rec.flags.length ? filledCount : -1);
  };

  const toggleCircle = (dateStr, idx) => {
    fetch('/api/routines/flags', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ date: dateStr, index: idx })
    })
    .then(r => r.json())
    .then(res => {
      setRoutines(prev => ({
        ...prev,
        [res.date]: { flags: res.state, value: res.value }
      }));
    });
  };

  const postValue = (dateStr, value) => {
    fetch('/api/routines/value', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ date: dateStr, value })
    })
    .then(r => r.json())
    .then(res => {
      setRoutines(prev => ({
        ...prev,
        [res.date]: { flags: res.state, value: res.value }
      }));
    });
  };

  const renderDayCell = arg => {
    const dateStr = toYmd(arg.date);
    const rec     = routines[dateStr] || { flags:[false,false,false], value:0 };
    const arr     = rec.flags;
    const val     = rec.value;

    return (
      <div className="fc-daygrid-day-frame">
        <div className="fc-daygrid-day-top">
          <span className="fc-daygrid-day-number">{arg.dayNumberText}</span>
        </div>
        <div className="habit-row" onClick={e => e.stopPropagation()}>
          <input
            className="habit-input"
            type="number"
            min={0}
            max={100}
            value={val}
            onMouseDown={e => e.stopPropagation()}
            onChange={e => {
              const v = e.target.value === '' 
                ? '' 
                : Math.min(100, Math.max(0, Number(e.target.value)));
              setRoutines(prev => ({
                ...prev,
                [dateStr]: { flags: prev[dateStr]?.flags || [false,false,false], value: v }
              }));
            }}
            onBlur={e => postValue(dateStr, e.target.value === '' ? 0 : Number(e.target.value))}
            onClick={e => e.stopPropagation()}
          />
          <div className="habit-box" onClick={e => { e.stopPropagation(); handleBoxClick(dateStr); }}>
            <div className="habit-circles">
              {arr.map((on, i) => (
                <span key={i} className={on ? 'circle filled' : 'circle'} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
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

  return (
    <div className="app-container">
      <div className="calendar-container">
        <h1 className="calendar-title">タスクカレンダーv0.1</h1>
        <ThemeToggle />

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

        <FullCalendar
          ref={calendarRef}
          plugins={[ dayGridPlugin, interactionPlugin ]}
          timeZone="local"
          initialView="dayGridMonth"
          editable={true}
          droppable={true}
          eventReceive={info => {
            // サイドバー → カレンダー
            update(info.event.id, { date: info.event.startStr });
          }}
          eventDragStop={info => {
            // カレンダー → サイドバー
            if (dropInsideSidebar(info.jsEvent)) {
              update(info.event.id, { date: null });
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
          dayCellContent={renderDayCell}
          height="auto"
        />
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
      <InnerApp />
    </ThemeProvider>
  );
}
