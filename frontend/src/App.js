import React from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';

function App() {
  return (
    <div style={{ maxWidth: '900px', margin: '40px auto' }}>
      <h1 style={{ textAlign: 'center' }}>タスクカレンダー</h1>
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek,dayGridDay'
        }}
        height="auto"
        // サンプルイベント
        events={[
          { title: 'サンプルタスクA', date: '2025-07-19' },
          { title: 'サンプルタスクB', date: '2025-07-22' }
        ]}
        weekNumbers={true}
      />
    </div>
  );
}

export default App;