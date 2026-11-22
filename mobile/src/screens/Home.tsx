// M1 홈 : 인사 · 전체 현장 확인(접고 펼치는 카드) · 이번 주 일정 + 고른 날의 진행중 / 완료됨 리스트(components/WeekPlan.tsx)
import { useEffect, useMemo, useState } from 'react';
import type { Building, WorkStatus } from '../data/types';
import { useStore } from '../store/AppStore';
import { IconDown, IconUp } from '../components/icons';
import { TabBar } from '../components/ui';
import WeekPlan from '../components/WeekPlan';
import { WEEKDAYS, fromYmd, weekOf, ymd } from '../lib/schedule';
import './Home.css';

const STATUS_OPEN_KEY = 'itgeo.mobile.home.statusOpen';   // 전체 현장 확인 카드를 펼쳐 두었는지 (폰에만 저장)

function groupStatus(bs: Building[]): WorkStatus {
  if (bs.length && bs.every((b) => b.status === 'done')) return 'done';
  if (bs.some((b) => b.status !== 'before')) return 'doing';
  return 'before';
}

export default function Home() {
  const { state, act } = useStore();
  useEffect(() => { act.refresh(); }, [act]);           // 웹에서 바꾼 리스트까지 다시 읽기

  const now = new Date();
  const today = ymd(now);
  const week = useMemo(() => weekOf(fromYmd(today)), [today]);

  // 리스트별 건물 · 상태 (전체 현장 확인 카드의 통계)
  const groups = useMemo(() => state.groups.map((g) => {
    const bs = g.buildingIds.map((id) => state.buildings[id]).filter(Boolean);
    const size = bs.length || g.size || 0;
    const done = bs.filter((b) => b.status === 'done').length;
    return { g, bs, size, done, status: groupStatus(bs) };
  }), [state.groups, state.buildings]);

  const total = groups.reduce((n, x) => n + x.size, 0);
  const done = groups.reduce((n, x) => n + x.done, 0);
  const doingLists = groups.filter((x) => x.status !== 'done');
  // 오늘 방문 = 이번 주 일정(WeekPlan 이 불러옴) 중 오늘 날짜에 넣은 건물 수
  const todayVisit = (state.schedule[week.key] ?? []).filter((it) => it.date === today).length;

  const [statusOpen, setStatusOpen] = useState(() => {
    try { return localStorage.getItem(STATUS_OPEN_KEY) !== '0'; } catch { return true; }
  });
  const toggleStatus = () => {
    const next = !statusOpen;
    setStatusOpen(next);
    try { localStorage.setItem(STATUS_OPEN_KEY, next ? '1' : '0'); } catch { /* 무시 */ }
  };

  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="screen screen--tabs home">
      <div className="home__top">
        <div>
          <p className="home__date">{now.getMonth() + 1}월 {now.getDate()}일 {WEEKDAYS[now.getDay()]}요일</p>
          <h1 className="home__hello">안녕하세요, {state.member?.name ?? ''} 님{state.mode === 'demo' && <small> · 시연</small>}</h1>
        </div>
        <button className="home__out" onClick={act.logout}>{state.mode === 'demo' ? '나가기' : '로그아웃'}</button>
      </div>

      {/* 전체 현장 확인 : 머리 줄을 누르면 접고 펼친다 */}
      <section className={`hstat ${statusOpen ? 'is-open' : ''}`}>
        <button className="hstat__head" onClick={toggleStatus} aria-expanded={statusOpen}>
          <span className="hstat__title">전체 현장 확인</span>
          {!statusOpen && <span className="hstat__mini"><b>{done}</b> / {total}동</span>}
          <span className="hstat__badge">진행중 리스트 {doingLists.length}개</span>
          {statusOpen ? <IconUp /> : <IconDown />}
        </button>
        {statusOpen && (
          <div className="hstat__body">
            <p className="hstat__big"><b>{done}</b> / {total}동 완료</p>
            <div className="hstat__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <i style={{ width: `${pct}%` }} />
            </div>
            <dl className="hstat__nums">
              <div><dt>남은 건물</dt><dd>{total - done}동</dd></div>
              <div><dt>확인 완료</dt><dd>{done}동</dd></div>
              <div><dt>오늘 방문</dt><dd>{todayVisit}동</dd></div>
            </dl>
          </div>
        )}
      </section>

      {/* 이번 주 일정 + 바로 아래 고른 날(처음엔 오늘)의 진행중 / 완료됨 리스트 (펼치면 순서 · 빼기 · 넣기 수정) */}
      <WeekPlan />

      <TabBar />
    </div>
  );
}
