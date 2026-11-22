// M1 홈 : 통계 + 이번 주 일정 (고른 날의 리스트 수정은 components/WeekPlan.tsx)
import { useEffect } from 'react';
import type { WorkStatus } from '../data/types';
import { useStore } from '../store/AppStore';
import { StatusDot, TabBar } from '../components/ui';
import WeekPlan from '../components/WeekPlan';
import './Home.css';
 
export default function Home() {
  const { state, act } = useStore();
  useEffect(() => { act.refresh(); }, [act]);           // 웹에서 바꾼 리스트까지 다시 읽기
 
  const all = state.groups.flatMap((g) => g.buildingIds.map((id) => state.buildings[id]).filter(Boolean));
  const count = (s?: WorkStatus) => (s ? all.filter((b) => b.status === s).length : all.length);
  const totalVisit = state.groups.reduce((n, g) => n + (g.buildingIds.length || g.size || 0), 0);
  const stats: { label: string; value: number; status: WorkStatus | 'all' }[] = [
    { label: '방문 시설', value: totalVisit, status: 'all' },
    { label: '조사 전', value: totalVisit - count('done'), status: 'before' },
    { label: '확인 완료', value: count('done'), status: 'done' },
  ];
 
  return (
    <div className="screen screen--tabs home">
      <div className="home__top">
        <p className="home__logo">
          <b>W</b>ell<b>FAIR</b>
        </p>
        <span className="home__me">
          {state.member?.name}{state.mode === 'demo' && ' · 시연'}
          <button onClick={act.logout}>{state.mode === 'demo' ? '나가기' : '로그아웃'}</button>
        </span>
      </div>
 
      <div className="home__stats">
        {stats.map((s) => (
          <div key={s.label} className="home__stat">
            <p className="home__stat-label">
              <StatusDot status={s.status} />
              {s.label}
            </p>
            <p className="home__stat-value">{s.value}</p>
          </div>
        ))}
      </div>
 
      {/* 이번 주 일정 + 고른 날의 현장확인 리스트 (수정 · 순서 · 추가 · 삭제) */}
      <WeekPlan />
 
      <TabBar />
    </div>
  );
}
 