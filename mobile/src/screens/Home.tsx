// M1 홈 : 인사 · 오늘 현장업무 진행 상태(접고 펼치는 카드) · 오늘의 진행중 / 완료됨 리스트(components/WeekPlan.tsx)
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/AppStore';
import { IconDown, IconUp } from '../components/icons';
import { TabBar } from '../components/ui';
import WeekPlan from '../components/WeekPlan';
import { WEEKDAYS, listsOfDay, ymd } from '../lib/schedule';
import './Home.css';

const STATUS_OPEN_KEY = 'itgeo.mobile.home.statusOpen';   // 오늘 현장업무 카드를 펼쳐 두었는지 (폰에만 저장)

export default function Home() {
  const { state, act } = useStore();
  useEffect(() => { act.refresh(); }, [act]);           // 웹에서 바꾼 리스트까지 다시 읽기

  const now = new Date();
  const today = ymd(now);

  // 오늘 현장업무 = 오늘 날짜에 나가기로 한 현장확인 리스트 (WeekPlan 이 api/mobile/schedule/day.do 로 불러옴)
  //   확인 = 오늘 확인 기록이 있는 건물 (recordId). 리스트 안 건물을 다 기록하면 완료 리스트
  const dayItems = state.days[today];
  const todayStat = useMemo(() => {
    const items = dayItems ?? [];
    const lists = listsOfDay(items);
    const doneLists = lists.filter((l) => l.items.length > 0 && l.items.every((it) => it.recordId != null)).length;
    return { total: items.length, done: items.filter((it) => it.recordId != null).length, lists: lists.length, doneLists };
  }, [dayItems]);
  const { total, done } = todayStat;
  const doingLists = todayStat.lists - todayStat.doneLists;

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
        <p className="home__date">
          {now.getMonth() + 1}월 {now.getDate()}일 {WEEKDAYS[now.getDay()]}요일{state.mode === 'demo' && ' · 시연'}
          <button className="home__out" onClick={act.logout}>{state.mode === 'demo' ? '나가기' : '로그아웃'}</button>
        </p>
        <h1 className="home__hello">안녕하세요, {state.member?.name ?? ''} 님</h1>
      </div>

      {/* 오늘 현장업무 진행 상태 : 머리 줄을 누르면 접고 펼친다 */}
      <section className={`hstat ${statusOpen ? 'is-open' : ''}`}>
        <button className="hstat__head" onClick={toggleStatus} aria-expanded={statusOpen}>
          <span className="hstat__title">오늘 현장업무</span>
          {!statusOpen && <span className="hstat__mini"><b>{done}</b> / {total}곳</span>}
          <span className="hstat__badge">진행중 리스트 {doingLists}개</span>
          {statusOpen ? <IconUp /> : <IconDown />}
        </button>
        {statusOpen && (
          <div className="hstat__body">
            {dayItems === undefined ? <p className="hstat__big">불러오는 중…</p>
              : total === 0 ? <p className="hstat__big">오늘 나가기로 한 현장이 없어요</p>
              : <p className="hstat__big"><b>{done}</b> / {total}곳 확인 완료</p>}
            <div className="hstat__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <i style={{ width: `${pct}%` }} />
            </div>
            <dl className="hstat__nums">
              <div><dt>남은 곳</dt><dd>{total - done}곳</dd></div>
              <div><dt>확인 완료</dt><dd>{done}곳</dd></div>
              <div><dt>완료 리스트</dt><dd>{todayStat.doneLists} / {todayStat.lists}개</dd></div>
            </dl>
          </div>
        )}
      </section>

      {/* 오늘의 진행중 / 완료됨 리스트 (펼치면 순서 · 빼기 · 넣기 수정) */}
      <WeekPlan />

      <TabBar />
    </div>
  );
}
