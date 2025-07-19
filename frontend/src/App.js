// frontend/src/App.js
import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin  from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

export default function App() {
  const [events, setEvents]           = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [newTitle, setNewTitle]       = useState('');

  // 初期データ取得
  useEffect(() => {
    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => setEvents(data));
  }, []);

  // カレンダーの日付クリック
  const handleDateClick = (arg) => {
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
      <h1 style={{ textAlign: 'center' }}>タスクカレンダー</h1>

      {/* 日付クリック時のみ表示される追加フォーム */}
      {selectedDate && (
        <div
          style={{
            padding: '10px',
            marginBottom: '20px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: '#f9f9f9',
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

      {/* クリック可能なカレンダー */}
      <FullCalendar
        plugins={[ dayGridPlugin, interactionPlugin ]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek,dayGridDay'
        }}
        events={events}
        dateClick={handleDateClick}
        height="auto"
      />
    </div>
  );
}
