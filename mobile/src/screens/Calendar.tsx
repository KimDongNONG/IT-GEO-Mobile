// 확인 탭 : 월간 달력 + 오늘(고른 날) 일정 카드
//   달력 데이터 = 웹 현장확인 리스트 달력과 같은 survey_schedule (api/mobile/schedule.do)
//   날짜 칸 : 그날 넣은 현장확인 리스트 이름 · 건물 수
//   떠 있는 카드 : 고른 날의 시간대별 현장조사 시설 (수정 버튼 없음), 우측 상단에 완료 · 예정 · 부재 · 종료
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { usePullRefresh } from '../lib/pullRefresh';
import { TabBar } from '../components/ui';
import { WEEKDAYS, dayRows, dayStats, monthGrid, nowHm, shortDate, STATUS_CLASS, ymd, type DayRow } from '../lib/schedule';
import type { ScheduleItem } from '../data/types';
import { IconDown } from '../components/icons';
import './Calendar.css';

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path d={dir === 'left' ? 'M12.5 4.5 7 10l5.5 5.5' : 'M7.5 4.5 13 10l-5.5 5.5'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** 1분마다 바뀌는 오늘 날짜 · 지금 시각 (자정이 지나면 오늘도 바뀜) */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Calendar() {
  const { state, act } = useStore();
  const navigate = useNavigate();
  const now = useNow();
  const today = ymd(now);
  const [view, setView] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() }));
  const [selected, setSelected] = useState(today);
  const [open, setOpen] = useState(false);
  
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 260);
    return () => clearTimeout(t);
  }, [open, selected]);

  const grid = useMemo(() => monthGrid(view.y, view.m), [view]);
  const items = state.schedule[grid.key];

  // 달을 열 때마다 다시 읽기 (웹 달력에서 옮기거나 뺀 일정까지 반영)
  useEffect(() => {
    act.loadSchedule(grid.key, grid.start, grid.end);
  }, [act, grid, state.mode]);
  usePullRefresh(() => act.loadSchedule(grid.key, grid.start, grid.end));

  // 날짜별로 묶기 : 칸에는 리스트 이름(중복 제거)과 건물 수
  const byDate = useMemo(() => {
    const m: Record<string, { titles: string[]; count: number }> = {};
    for (const it of items ?? []) {
      const d = (m[it.date] ??= { titles: [], count: 0 });
      d.count++;
      if (!d.titles.includes(it.title)) d.titles.push(it.title);
    }
    return m;
  }, [items]);

  const rows = useMemo(() => dayRows(items ?? [], selected, today), [items, selected, today]);
  const stats = dayStats(rows);

  const moveMonth = (n: number) => {
    const d = new Date(view.y, view.m + n, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
    const isThisMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    setSelected(isThisMonth ? today : ymd(d));
  };
  const goToday = () => {
    setView({ y: now.getFullYear(), m: now.getMonth() });
    setSelected(today);
    setOpen(true);
  };
  const pick = (d: string) => { setSelected(d); setOpen(true); };

  
  // 줄을 누르면 : 기록이 있으면 결과 상세, 없으면 현장 기록 (그 건물이 방문그룹에 있을 때만)
  const openRow = (it: ScheduleItem) => {
    if (!state.buildings[it.bldId]) return;
    navigate(it.recordId != null ? `/result/${it.bldId}` : `/record/${it.bldId}?group=${it.groupId}`);
  };
  
  const isToday = selected === today;

  return (
    <div className={`screen screen--tabs cal`}>
      <div className="screen__head screen__head--noback">
        <h1 className="screen__title">확인</h1>
        {!isToday || view.y !== now.getFullYear() || view.m !== now.getMonth() ? (
          <button className="cal__today-btn" onClick={goToday}>오늘</button>
        ) : null}
      </div>

      <div className="cal__month">
        <button aria-label="이전 달" onClick={() => moveMonth(-1)}><Chevron dir="left" /></button>
        <h2>{view.y}년 {view.m + 1}월</h2>
        <button aria-label="다음 달" onClick={() => moveMonth(1)}><Chevron dir="right" /></button>
      </div>

      <div className="cal__grid" role="grid" aria-label={`${view.y}년 ${view.m + 1}월 달력`}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`cal__wd ${i === 0 ? 'is-sun' : i === 6 ? 'is-sat' : ''}`}>{w}</div>
        ))}
        {grid.days.map((d) => {
          const key = ymd(d);
          const info = byDate[key];
          const out = d.getMonth() !== view.m;
          const cls = [
            'cal__day',
            out && 'is-out',
            key === today && 'is-today',
            key === selected && 'is-sel',
            d.getDay() === 0 && 'is-sun',
            d.getDay() === 6 && 'is-sat',
          ].filter(Boolean).join(' ');
          return (
            <button key={key} role="gridcell" className={cls} onClick={() => pick(key)} aria-pressed={key === selected}
              aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일${info ? `, 현장방문 ${info.count}곳` : ''}`}>
              <span className="cal__num">{d.getDate()}</span>
              {info && (
                <span className="cal__lists">
                  {info.titles.slice(0, 2).map((t) => <span key={t} className="cal__list">{t}</span>)}
                  {info.titles.length > 2 && <span className="cal__more">+{info.titles.length - 2}</span>}
                  <span className="cal__cnt">{info.count}곳</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {items === undefined && <p className="cal__loading">일정을 불러오는 중…</p>}

      {/* 떠 있는 일정 카드 */}
	  <section ref={panelRef} className={`dpanel ${open ? 'is-open' : ''}`}>
	  <button className="dpanel__head" onClick={() => setOpen(!open)} aria-expanded={open}>
	    <span className="dpanel__title">
	      <b>{isToday ? '오늘 일정' : '일정'}</b>
	      <span>{shortDate(selected)} · {stats.remaining}건 남음</span>
	    </span>
	    <span className="dpanel__stats">
	      완료 {stats.완료} · 예정 {stats.예정} · 부재 {stats.부재} · 종료 {stats.종료}
	    </span>
	    <span className="dpanel__chev" aria-hidden><IconDown /></span>
	  </button>

	    {/* 높이 0 ↔ 내용 높이로 슬라이드 */}
	    <div className="dpanel__slide" aria-hidden={!open}>
	      <div className="dpanel__inner">
	        {rows.length === 0 ? (
	          <p className="dpanel__empty">이 날 넣은 현장확인 리스트가 없어요.</p>
	        ) : (
	          <ol className="tl">
	            {rows.map((r) => (
	              <Row key={r.item.key} row={r} showNow={isToday && r.status === '다음'} nowText={nowHm(now)} onOpen={() => openRow(r.item)} />
	            ))}
	          </ol>
	        )}
	      </div>
	    </div>
	  </section>

      <TabBar />
    </div>
  );
}

/** 한 줄 : 시각 | 세로 막대 | 시설 · 리스트 | 상태. 오늘의 '다음' 줄 위에는 지금 시각 선 */
function Row({ row, showNow, nowText, onOpen }: { row: DayRow; showNow: boolean; nowText: string; onOpen: () => void }) {
  const { item, status, seq } = row;
  const past = item.recordId != null || status === '종료';
  return (
    <>
      {showNow && (
        <li className="tl__now" aria-label={`지금 ${nowText}`}><span>지금 {nowText}</span><i /></li>
      )}
      <li className={`tl__row vrow--${STATUS_CLASS[status]} ${past ? 'is-past' : ''}`}>
        <button className="tl__btn" onClick={onOpen}>
          <span className="tl__time">{item.time ?? <small>{seq}번째</small>}</span>
          <span className="tl__bar" />
          <span className="tl__text">
            <span className="tl__place">{item.place}</span>
            <span className="tl__sub">{item.title}{item.supports.length ? ` · ${item.supports.join(' · ')}` : ''}</span>
          </span>
          <span className={`vst vst--${STATUS_CLASS[status]}`}>{status}</span>
        </button>
      </li>
    </>
  );
}
