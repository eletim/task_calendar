// frontend/src/App.js
import React, { useEffect, useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin  from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

export default function App() {
  const [events, setEvents]             = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [newTitle, setNewTitle]         = useState('');
  const calendarRef                     = useRef(null);

  // 初期データ取得
  useEffect(() => {
    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => setEvents(data));
  }, []);

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

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto' }}>
      {/* 週表示と日表示のセル高さ調整用CSS */}
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
        }
      `}</style>
      <h1 style={{ textAlign: 'center' }}>タスクカレンダーv0.1</h1>

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
        dateClick={handleDateClick}
        height="auto"
      />
    </div>
  );
}
