// src/hooks/useTasks.js
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';

export function useTasks() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    apiFetch('/api/tasks/')
      .then(setTasks)
      .catch((e) => console.error('tasks load failed', e));
  }, []);

  const create = useCallback((title, date=null, color='#3788d8', category='normal') => {
    return apiFetch('/api/tasks/', {
      method: 'POST',
      body: { title, date, color, category }
    }).then((t) => {
      setTasks((prev) => [...prev, t]);
      return t;
    });
  }, []);

  const update = useCallback((id, patch) => {
    return apiFetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: patch
    }).then((t) => {
      setTasks((prev) => prev.map(p => (p.id === t.id ? t : p)));
      return t;
    });
  }, []);

  const remove = useCallback((id) => {
    return apiFetch(`/api/tasks/${id}`, { method: 'DELETE' })
      .then(() => setTasks((prev) => prev.filter(p => p.id !== id)));
  }, []);

  return { tasks, create, update, remove };
}
