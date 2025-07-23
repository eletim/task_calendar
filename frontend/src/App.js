// frontend/src/App.js
import React, { useEffect, useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin  from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import './index.css';

export default function App() {
  const [events, setEvents]             = useState([]);
  const [routines,setRoutines]          = useState({}); // { 'YYYY-MM-DD': { flags:[bool,bool,bool], value:number } }
  const [selectedDate, setSelectedDate] = useState(null);
  const [newTitle, setNewTitle]         = useState('');
  const [editingEvent, setEditingEvent]   = useState(null);
  const [editingTitle, setEditingTitle]   = useState('');
  const calendarRef                     = useRef(null);

  // 初期データ取得
  useEffect(() => {
    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => {
        const fcEvents = data.map(t => ({
          id: t.id,
          title: t.title,
          start: t.date,
          done: t.done,
        }));
        setEvents(fcEvents);
      });
    fetch('/api/routines').then(r => r.json()).then(setRoutines);
  }, []);


  ///////////////////////
  // 日付クリック時の処理 //
  ///////////////////////
  
  // 日付クリック時のハンドラ
  const handleDateClick = (arg) => {
    const calendarApi = calendarRef.current.getApi();
    // Month表示ならカスタムウィークビューに切り替え
    if (calendarApi.view.type === 'dayGridMonth') {
      // クリック日を中心に前3日を startDate にする
      const startDate = new Date(arg.date);
      startDate.setDate(startDate.getDate() - 3);
      // weekCentered ビューを startDate で表示
      calendarApi.changeView('weekCentered', startDate);
    }
    // 追加フォーム用に日付だけセット
    setSelectedDate(arg.dateStr);
    setNewTitle('');
  };

  // 追加フォームの送信
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newTitle || !selectedDate) return;

    const newEvent = { title: newTitle, date: selectedDate };
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEvent),
    })
    .then(res => res.json())
    .then(created => {
      setEvents(prev => [...prev, created]);
      setSelectedDate(null);
    });
  };

  // フォームを閉じる
  const handleCancel = () => {
    setSelectedDate(null);
  };


  ///////////////////////////
  // ルーチン○クリック時の処理 //
  ///////////////////////////

  // 次に埋めるインデックスを計算して toggleCircle を呼び出す
  const handleBoxClick = (dateStr) => {
    const rec = routines[dateStr] || { flags:[false,false,false], value:0 };
    const arr = rec.flags;
    const filledCount = arr.filter(v => v).length;
    if (filledCount < arr.length) {
      // 次の丸を埋める
      toggleCircle(dateStr, filledCount);
    } else {
      // すべて埋まっている → idx=-1 でリセット
      toggleCircle(dateStr, -1);
    }
  };

  // ルーチン○をクリックしたとき
  const toggleCircle = (dateStr, idx) => {
    fetch('/api/routines/flags', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ date:dateStr, index:idx })
    })
    .then(r=>r.json())
    .then(res => {
      setRoutines(prev => ({
        ...prev,
        [res.date]: { flags: res.state, value: res.value }
      }));
    });
  };

  const postValue = (dateStr, value) => {
    fetch('/api/routines/value', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ date: dateStr, value })
    })
    .then(r=>r.json())
    .then(res=>{
      setRoutines(prev => ({
        ...prev,
        [res.date]: { flags: res.state, value: res.value }
      }));
    });
  };

  // 日セルをカスタム描画
  const renderDayCell = (arg) => {
    const dateStr = arg.date.toISOString().slice(0,10);
    const rec = routines[dateStr] || { flags:[false,false,false], value:50 };
    const arr = rec.flags;
    const val = rec.value;

    return (
      <div className="fc-daygrid-day-frame">
        <div className="fc-daygrid-day-top">
          <span className="fc-daygrid-day-number">{arg.dayNumberText}</span>
        </div>
      {/* ←ここを追加：数値入力 + 円 */}
      <div className="habit-row" onClick={(e)=>e.stopPropagation()}>
        {/* 暫定で固定50表示、送信処理なし */}
        <input
          className="habit-input"
          type="number"
          min={0}
          max={100}
          value={val}
          onMouseDown={(e)=> e.stopPropagation()}
          onChange={(e)=>{
            const v = e.target.value === '' ? '' : Math.min(100, Math.max(0, Number(e.target.value)));
            setRoutines(prev => ({
              ...prev,
              [dateStr]: { flags: (prev[dateStr]?.flags ?? [false,false,false]), value: v }
            }));
            console.log('value changed', dateStr, v);
          }}
          onBlur={(e)=> {
            const n = e.target.value === '' ? 0 : Number(e.target.value);
            postValue(dateStr, n);
          }}
          onClick={(e)=>e.stopPropagation()}
        />
        {/* 四角いボックスをクリックすると左から順に埋まる */}
        <div
          className="habit-box"
          onClick={e => {
            e.stopPropagation();
            handleBoxClick(dateStr);
          }}
        >
          <div className="habit-circles">
            {arr.map((on, i) => (
              <span
                key={i}
                className={on ? 'circle filled' : 'circle'}
              />
            ))}
          </div>
        </div>
      </div>
      </div>
    );
  };


  ////////////////////////
  // イベント編集・削除処理 //
  ////////////////////////

  // イベントをクリックしたときのハンドラ
  const handleEventClick = (clickInfo) => {
    const ev = clickInfo.event;
    setEditingEvent({
      id: ev.id,
      title: ev.title,
      date: ev.startStr
    });
    setEditingTitle(ev.title);
  };

  // 編集フォームのキャンセル
  const handleCancelEdit = () => {
    setEditingEvent(null);
    setEditingTitle('');
  };

  // タイトル更新
  const handleUpdateEvent = (e) => {
    e.preventDefault();
    fetch(`/api/tasks/${editingEvent.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editingTitle })
    })
    .then(r => r.json())
    .then(updated => {
      setEvents(evt =>
        evt.map(ev => ev.id === updated.id ? updated : ev)
      );
      handleCancelEdit();
    });
  };

  // イベント削除
  const handleDeleteEvent = () => {
    fetch(`/api/tasks/${editingEvent.id}`, {
      method: 'DELETE'
    })
    .then(() => {
      setEvents(evt =>
        evt.filter(ev => ev.id !== editingEvent.id)
      );
      handleCancelEdit();
    });
  };


  //////////////////////////
  // イベント描画カスタマイズ //
  //////////////////////////

  // イベント描画カスタマイズ
  const renderEventContent = (arg) => {
    const id   = arg.event.id;  
    const done = arg.event.extendedProps.done;
    return (
      <div className="task-item" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input
          type="checkbox"
          checked={!!done}
          onChange={(e) => {
            e.stopPropagation();
            toggleTaskDone(id);
          }}
        />
        <span style={{ textDecoration: done ? 'line-through' : 'none' }}>
          {arg.event.title}
        </span>
      </div>
    );
  };

  // チェック切り替え処理
  const toggleTaskDone = (taskId) => {
    fetch(`/api/tasks/${taskId}/toggle`, { method: 'PATCH' })
      .then(r => r.json())
      .then(updated => {
        // state の events を差し替え
        setEvents(prev =>
          prev.map(ev => ev.id === updated.id ? { ...ev, done: updated.done } : ev)
        );
      });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto' }}>
      {/* 週／日ビューでセル高さ調整 & 土日着色 */}
      <style>{`
        /* 週表示、日表示、カスタム7日表示のセル高さを調整 */
        .fc-dayGridWeek-view .fc-daygrid-day-frame,
        .fc-dayGridDay-view .fc-daygrid-day-frame,
        .fc-weekCentered-view .fc-daygrid-day-frame {
          min-height: 250px !important;
        }

        /* イベントエリアの高さも調整 */
        .fc-dayGridWeek-view .fc-daygrid-day-events,
        .fc-dayGridDay-view .fc-daygrid-day-events,
        .fc-weekCentered-view .fc-daygrid-day-events {
          min-height: 200px !important;
        }

        /* 月表示は元のサイズを維持 */
        .fc-dayGridMonth-view .fc-daygrid-day-frame {
          min-height: auto !important;
          background-color: transparent !important;
        }
        /* --------------------------------------------
          ここから追加：曜日ヘッダーと日付のみ色変更
          -------------------------------------------- */
        /* カラムヘッダー（土曜／日曜） */
        .fc-col-header-cell.fc-day-sat .fc-col-header-cell-cushion {
          color: #007bff !important; /* お好きな青色に */
        }
        .fc-col-header-cell.fc-day-sun .fc-col-header-cell-cushion {
          color: #dc3545 !important; /* お好きな赤色に */
        }

        /* 各セルの日付数字 */
        .fc-daygrid-day.fc-day-sat .fc-daygrid-day-top .fc-daygrid-day-number {
          color: #007bff !important;
        }
        .fc-daygrid-day.fc-day-sun .fc-daygrid-day-top .fc-daygrid-day-number {
          color: #dc3545 !important;
        }
      `}</style>
      <h1 style={{ textAlign: 'center' }}>タスクカレンダーv0.1</h1>

      {/* ─── 編集フォーム ───────────────────── */}
      {editingEvent && (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          border: '1px solid #f00',
          borderRadius: '4px',
          background: '#fff0f0'
        }}>
          <form onSubmit={handleUpdateEvent} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span>{editingEvent.date}</span>
            <input
              type="text"
              value={editingTitle}
              onChange={e => setEditingTitle(e.target.value)}
              required
            />
            <button type="submit">更新</button>
            <button type="button" onClick={handleDeleteEvent}>削除</button>
            <button type="button" onClick={handleCancelEdit}>キャンセル</button>
          </form>
        </div>
      )}

      {/* クリックした日付にだけ表示される追加フォーム */}
      {selectedDate && (
        <div style={{
          padding: '10px', marginBottom: '20px',
          border: '1px solid #ccc', borderRadius: '4px',
          background: '#f9f9f9'
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span>{selectedDate}</span>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="イベントタイトル"
              required
            />
            <button type="submit">追加</button>
            <button type="button" onClick={handleCancel}>キャンセル</button>
          </form>
        </div>
      )}

      {/* カレンダー本体 */}
      <FullCalendar
        ref={calendarRef}
        plugins={[ dayGridPlugin, interactionPlugin ]}
        initialView="dayGridMonth"
        eventClick={handleEventClick}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek,dayGridDay'
        }}
        // カスタムウィークビュー定義
        views={{
          weekCentered: {
            type: 'dayGrid',
            // 期間だけ duration で指定
            duration: { days: 7 },
            buttonText: '７日表示'
          }
        }}
        events={events}
        eventContent={renderEventContent}
        dateClick={handleDateClick}
        dayCellContent={renderDayCell}
        height="auto"
      />
    </div>
  );
}
