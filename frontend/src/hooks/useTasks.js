// src/hooks/useTasks.js
import { useState, useEffect } from 'react';
export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const API = '/api/tasks';

  useEffect(() => { fetchAll() }, []);

  const fetchAll = async () => {
    const res = await fetch(API);
    if (res.ok) {
      const data = await res.json();
      // order が無ければ 0 を補完し、order 順にソートして保存
      setTasks(
        data
          .map(t => ({ ...t, order: t.order ?? 0 }))
          .sort((a, b) => a.order - b.order)
      );
    }
  };

  const create  = async (title, date=null, color='#3788d8', category='normal') => {
    const nextOrder = tasks.length;
    await fetch(API, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ title, date, color, category, order: nextOrder }),
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

  // ─────────── 並び替え用 API 呼び出し ───────────
  const updateOrder = async (id, order, category) => {
    await fetch(`${API}/${id}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order, category }),
    });
    fetchAll();
  };

  const remove  = async id => {
    await fetch(`${API}/${id}`, { method:'DELETE' });
    fetchAll();
  };

  return { tasks, create, update, remove, updateOrder };
}
