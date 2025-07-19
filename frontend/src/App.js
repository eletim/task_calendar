import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';

function App() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => setEvents(data));
  }, []);

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto' }}>
      <h1 style={{ textAlign: 'center' }}>タスクカレンダー</h1>
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek,dayGridDay' }}
        height="auto"
        events={events}
        weekNumbers={true}
      />
    </div>
  );
}

export default App;