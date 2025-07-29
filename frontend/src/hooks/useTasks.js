// src/hooks/useTasks.js
import { useState, useEffect } from 'react';
export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const API = '/api/tasks';

  useEffect(() => { fetchAll() }, []);

  const fetchAll = async () => {
    const res = await fetch(API);
    if (res.ok) setTasks(await res.json());
  };

  const create  = async (title, date=null, color='#3788d8') => {
    await fetch(API, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ title, date, color }),
    });
    fetchAll();
  };

  const update  = async (id, fields) => {
    await fetch(`${API}/${id}`, {
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(fields),
    });
    fetchAll();
  };

  const remove  = async id => {
    await fetch(`${API}/${id}`, { method:'DELETE' });
    fetchAll();
  };

  return { tasks, create, update, remove };
}
