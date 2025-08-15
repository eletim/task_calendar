// frontend/src/components/Habit.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';

const HabitContext = createContext(null);

export function HabitProvider({ children }) {
  const [routines, setRoutines] = useState({}); // { 'YYYY-MM-DD': { flags:[bool,bool,bool], value:number, if_then_rules:[...] } }

  // 設定値（display/length）
  const [valueDisplay, setValueDisplay] = useState(true);
  const [flagsDisplay, setFlagsDisplay] = useState(true);
  const [itrDisplay,   setItrDisplay]   = useState(false);

  const [flagsLength,   setFlagsLength]   = useState(null); // 数が未取得の間は null
  const [ifThenLength,  setIfThenLength]  = useState(null);

  useEffect(() => {
    // 設定読み込み
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const r = data?.routine || {};
        const v = r.value || {};
        const f = r.flags || {};
        const i = r.if_then_rules || {};

        if (typeof v.display === 'boolean') setValueDisplay(v.display);
        if (typeof f.display === 'boolean') setFlagsDisplay(f.display);
        if (typeof i.display === 'boolean') setItrDisplay(i.display);

        if (typeof f.length === 'number' && f.length >= 0) setFlagsLength(f.length);
        if (typeof i.length === 'number' && i.length >= 0) setIfThenLength(i.length);
      })
      .catch(err => {
        console.warn('settings の読み込みに失敗しました', err);
      });

    // routines データの読み込み
    fetch('/api/routines')
      .then(r => r.json())
      .then(setRoutines)
      .catch(console.error);
  }, []);

  // 数値ガード（未取得時は 0 扱いで安全に）
  const safeLen = (n) => (Number.isInteger(n) && n >= 0 ? n : 0);

  // 既存配列の長さを優先しつつ、サーバー配列で上書きする
  const preferExistingLen = (serverArr, prevArr, fallbackLenRaw) => {
    const fallbackLen = safeLen(fallbackLenRaw);
    const isArr = Array.isArray;
    if (isArr(prevArr)) {
      if (!isArr(serverArr)) return prevArr.slice();
      if (serverArr.length >= prevArr.length) return serverArr.slice();
      const merged = serverArr.slice();
      for (let i = serverArr.length; i < prevArr.length; i++) merged.push(!!prevArr[i]);
      return merged;
    }
    if (isArr(serverArr)) {
      const base = serverArr.slice(0, fallbackLen);
      if (base.length < fallbackLen) base.push(...Array(fallbackLen - base.length).fill(false));
      return base;
    }
    return Array(fallbackLen).fill(false);
  };

  const toYmd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getRecord = (dateStr) => {
    const rec = routines[dateStr];
    const fLen  = safeLen(flagsLength);
    const iLen  = safeLen(ifThenLength);
    if (rec) {
      return {
        flags: Array.isArray(rec.flags) ? rec.flags : Array(fLen).fill(false),
        if_then_rules: Array.isArray(rec.if_then_rules) ? rec.if_then_rules : Array(iLen).fill(false),
        value: typeof rec.value === 'number' ? rec.value : 0
      };
    }
    return {
      flags: Array(fLen).fill(false),
      if_then_rules: Array(iLen).fill(false),
      value: 0
    };
  };

  const setLocalValue = (dateStr, v) => {
    const fLen = safeLen(flagsLength);
    const iLen = safeLen(ifThenLength);
    setRoutines(prev => ({
      ...prev,
      [dateStr]: {
        flags: prev[dateStr]?.flags || Array(fLen).fill(false),
        if_then_rules: prev[dateStr]?.if_then_rules || Array(iLen).fill(false),
        value: v
      }
    }));
  };

  const postValue = async (dateStr, value) => {
    const r = await fetch('/api/routines/value', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ date: dateStr, value })
    });
    const res = await r.json();
    setRoutines(prev => ({
      ...prev,
      [res.date]: {
        flags: preferExistingLen(res.state, prev[res.date]?.flags, flagsLength),
        if_then_rules: preferExistingLen(res.if_then_rules, prev[res.date]?.if_then_rules, ifThenLength),
        value: res.value
      }
    }));
  };

  const toggleCircle = async (dateStr, idx) => {
    const r = await fetch('/api/routines/flags', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ date: dateStr, index: idx })
    });
    const res = await r.json();
    setRoutines(prev => ({
      ...prev,
      [res.date]: {
        flags: preferExistingLen(res.state, prev[res.date]?.flags, flagsLength),
        if_then_rules: preferExistingLen(undefined, prev[res.date]?.if_then_rules, ifThenLength),
        value: res.value
      }
    }));
  };

  const cycleFill = (dateStr) => {
    const rec = getRecord(dateStr);
    const filledCount = rec.flags.filter(Boolean).length;
    toggleCircle(dateStr, filledCount < rec.flags.length ? filledCount : -1);
  };

  const toggleIfThen = async (dateStr, idx) => {
    const r = await fetch('/api/routines/if_then_rules', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ date: dateStr, index: idx })
    });
    const res = await r.json();
    setRoutines(prev => ({
      ...prev,
      [res.date]: {
        flags: preferExistingLen(res.state, prev[res.date]?.flags, flagsLength),
        if_then_rules: preferExistingLen(res.if_then_rules, prev[res.date]?.if_then_rules, ifThenLength),
        value: res.value
      }
    }));
  };

  const cycleIfThen = (dateStr) => {
    const rec = getRecord(dateStr);
    const arr = rec.if_then_rules;
    const filledCount = arr.filter(Boolean).length;
    toggleIfThen(dateStr, filledCount < arr.length ? filledCount : -1);
  };

  return (
    <HabitContext.Provider
      value={{
        toYmd,
        getRecord,
        setLocalValue,
        postValue,
        cycleFill,
        cycleIfThen,
        // display フラグも公開
        valueDisplay,
        flagsDisplay,
        itrDisplay,
      }}
    >
      {children}
    </HabitContext.Provider>
  );
}

function useHabit() {
  const ctx = useContext(HabitContext);
  if (!ctx) throw new Error('HabitCell must be used within <HabitProvider>');
  return ctx;
}

export function HabitCell({ date, dayNumberText }) {
  const {
    toYmd, getRecord, setLocalValue, postValue, cycleFill, cycleIfThen,
    valueDisplay, flagsDisplay, itrDisplay
  } = useHabit();

  const dateStr = toYmd(date);
  const rec = getRecord(dateStr);
  const arr = rec.flags;
  const ifThenArr = rec.if_then_rules;
  const val = rec.value;

  return (
    <div className="fc-daygrid-day-frame">
      <div className="fc-daygrid-day-top">
        <span className="fc-daygrid-day-number">{dayNumberText}</span>
      </div>
      <div className="habit-row" onClick={(e) => e.stopPropagation()}>
        {/* value（数値入力） */}
        {valueDisplay && (
          <input
            className="habit-input"
            type="number"
            min={0}
            max={100}
            value={val}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = e.target.value === ''
                ? ''
                : Math.min(100, Math.max(0, Number(e.target.value)));
              setLocalValue(dateStr, v);
            }}
            onBlur={(e) => postValue(dateStr, e.target.value === '' ? 0 : Number(e.target.value))}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* flags（丸） */}
        {flagsDisplay && (
          <div className="habit-box" onClick={(e) => { e.stopPropagation(); cycleFill(dateStr); }}>
            <div className="habit-circles">
              {arr.map((on, i) => (
                <span key={i} className={on ? 'circle filled' : 'circle'} />
              ))}
            </div>
          </div>
        )}

        {/* if-then（丸） */}
        {itrDisplay && (
          <div className="habit-box ifthen-box" onClick={e => { e.stopPropagation(); cycleIfThen(dateStr); }}>
            <div className="habit-circles ifthen-circles">
              {ifThenArr.map((on, i) => (
                <span key={i} className={on ? 'circle ifthen-filled' : 'circle ifthen'} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// dateClickでhabit要素クリックを無視するためのヘルパー
export function isHabitTarget(el) {
  if (!el) return false;
  const closest = el.closest?.('.habit-row, .habit-input, .habit-box, .ifthen-box');
  return !!closest;
}
