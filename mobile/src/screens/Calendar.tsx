// M8 업무 캘린더 : 달력에는 점만 찍고, 고른 날짜의 현장확인 리스트는 아래 목록으로
//   달력 데이터 = 웹 현장확인 리스트 달력과 같은 survey_schedule (api/mobile/schedule.do)
//   점 = 그날 넣은 리스트 하나에 하나 (조사 전 초록 · 조사 중 주황 · 확인 완료 파랑, 최대 3개)
//   리스트 카드를 누르면 그 리스트의 동선 화면
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { usePullRefresh } from '../lib/pullRefresh';
import { Ico } from '../components/figma';
import { StatusBadge, TabBar } from '../components/ui';
import { WEEKDAYS, fromYmd, listsOfDay, monthGrid, ymd } from '../lib/schedule';
import type { WorkStatus } from '../data/types';
import './Calendar.css';

/** 1분마다 바뀌는 오늘 날짜 (자정이 지나면 오늘도 바뀜) */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

interface DayList { groupId: string; title: string; total: number; visited: number; status: WorkStatus }

export default function Calendar() {
  const { state, act } = useStore();
  const navigate = useNavigate();
  const now = useNow();
  const today = ymd(now);
  const [view, setView] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() }));
  const [selected, setSelected] = useState(today);

  const grid = useMemo(() => monthGrid(view.y, view.m), [view]);
  const items = state.schedule[grid.key];
  // 6주 칸 중 마지막 주가 모두 다음 달이면 뺀다
  const days = useMemo(() => (grid.days[35].getMonth() !== view.m ? grid.days.slice(0, 35) : grid.days), [grid, view.m]);

  // 달을 열 때마다 다시 읽기 (웹 달력에서 옮기거나 뺀 일정까지 반영)
  useEffect(() => {
    act.loadSchedule(grid.key, grid.start, grid.end);
  }, [act, grid, state.mode]);
  usePullRefresh(() => act.loadSchedule(grid.key, grid.start, grid.end));

  // 날짜별 리스트 (리스트 안 건물 수 · 확인한 수 · 상태)
  const byDate = useMemo(() => {
    const m: Record<string, DayList[]> = {};
    const dates = [...new Set((items ?? []).map((it) => it.date))];
    for (const d of dates) {
      m[d] = listsOfDay((items ?? []).filter((it) => it.date === d)).map((l) => {
        const visited = l.items.filter((it) => it.recordId != null).length;
        const total = l.items.length;
        return { groupId: l.groupId, title: l.title, total, visited, status: total && visited === total ? 'done' : visited ? 'doing' : 'before' };
      });
    }
    return m;
  }, [items]);
  const monthLists = Object.entries(byDate).filter(([d]) => fromYmd(d).getMonth() === view.m).reduce((n, [, ls]) => n + ls.length, 0);

  const moveMonth = (n: number) => {
    const d = new Date(view.y, view.m + n, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
    const isThisMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    setSelected(isThisMonth ? today : ymd(d));
  };
  const goToday = () => { setView({ y: now.getFullYear(), m: now.getMonth() }); setSelected(today); };

  const sel = fromYmd(selected);
  const lists = byDate[selected] ?? [];
  const openList = (l: DayList) => {
    if (state.groups.some((g) => g.id === l.groupId)) navigate(`/route/${l.groupId}`);
    else act.toast('이 리스트는 앱에 받은 현장확인 리스트가 아니에요.');
  };

  return (
    <div className="screen screen--tabs cal">
      <header className="cal__head">
        <h1>{view.y}년 {view.m + 1}월</h1>
        <button className="cal__nav" aria-label="이전 달" onClick={() => moveMonth(-1)}><Ico name="chevLeftDark" size={20} /></button>
        <button className="cal__nav" aria-label="다음 달" onClick={() => moveMonth(1)}><Ico name="chevRightDark" size={20} /></button>
        <button className="cal__today" onClick={goToday}>오늘</button>
      </header>

      <div className="cal__legend">
        <span><i className="is-before" />조사 전</span>
        <span><i className="is-doing" />조사 중</span>
        <span><i className="is-done" />확인 완료</span>
        <small>이번 달 리스트 {monthLists}개</small>
      </div>

      <div className="cal__grid card" role="grid" aria-label={`${view.y}년 ${view.m + 1}월 달력`}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`cal__wd ${i === 0 ? 'is-sun' : i === 6 ? 'is-sat' : ''}`}>{w}</div>
        ))}
        {days.map((d) => {
          const key = ymd(d);
          const ls = byDate[key] ?? [];
          const cls = [
            'cal__day',
            d.getMonth() !== view.m && 'is-out',
            key === today && 'is-today',
            key === selected && 'is-sel',
            d.getDay() === 0 && 'is-sun',
            d.getDay() === 6 && 'is-sat',
          ].filter(Boolean).join(' ');
          return (
            <button key={key} role="gridcell" className={cls} onClick={() => setSelected(key)} aria-pressed={key === selected}
              aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일${ls.length ? `, 현장확인 리스트 ${ls.length}개` : ''}`}>
              <span className="cal__num">{d.getDate()}</span>
              <span className="cal__dots">{ls.slice(0, 3).map((l) => <i key={l.groupId} className={`is-${l.status}`} />)}</span>
            </button>
          );
        })}
      </div>
      {items === undefined && <p className="cal__loading">일정을 불러오는 중…</p>}

      <div className="cal__dayhead">
        <p><b>{sel.getMonth() + 1}월 {sel.getDate()}일 {WEEKDAYS[sel.getDay()]}요일</b><span>리스트 {lists.length}개</span></p>
      </div>
      {lists.length === 0 && <p className="cal__empty">이 날 나가기로 한 현장확인 리스트가 없어요.</p>}
      {lists.map((l) => (
        <button key={l.groupId} className="cal__list card" onClick={() => openList(l)}>
          <i className={`cal__stripe is-${l.status}`} />
          <span className="cal__ltx">
            <b>{l.title}</b>
            <small>건물 {l.total}곳 · {l.visited}곳 완료</small>
          </span>
          <StatusBadge status={l.status} />
          <Ico name="chevRightSub" size={20} />
        </button>
      ))}

      <TabBar />
    </div>
  );
}
