// M1 홈 · 오늘의 현장 확인
//   위 = 날짜 · 인사, 이번 주 현장 확인(진행률 카드 : 완료 / 전체 동 · 남은 건물 · 확인 완료 · 오늘 방문)
//   아래 = 현장 확인 리스트 (진행중 | 완료됨). 리스트 카드를 누르면 펼쳐져서 동선 순서 · 동선 보기 · 현장 확인 시작
//   건물 줄을 누르면 그 줄이 선택(강조)되고, 아래 버튼이 '동선 보기' → '지도에서 보기'로 바뀐다. '현장 확인 시작'은 고른 건물로 (안 고르면 지금 갈 곳)
//   지도에서 보기 = 동선 화면을 그 건물로 확대해서 연다 (/route/:groupId?open=건물). 길찾기는 거기 목록의 '길찾기'로
//   리스트 머리의 + = 보관함 건물을 리스트에 추가 (/archive?add=리스트 : 펼친 리스트, 없으면 첫 진행중 리스트)
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Building, Group, WorkStatus } from '../data/types';
import { useStore } from '../store/AppStore';
import { usePullRefresh } from '../lib/pullRefresh';
import { Ico } from '../components/figma';
import { Bar, Chip, Segment, StatusBadge, TabBar } from '../components/ui';
import { WEEKDAYS, fromYmd, weekOf, ymd } from '../lib/schedule';
import './Home.css';

function groupStatus(bs: Building[]): WorkStatus {
  if (bs.length && bs.every((b) => b.status === 'done')) return 'done';
  if (bs.some((b) => b.status !== 'before')) return 'doing';
  return 'before';
}

interface Row { g: Group; no: number; bs: Building[]; size: number; done: number; status: WorkStatus }

export default function Home() {
  const { state, act } = useStore();
  const navigate = useNavigate();
  useEffect(() => { act.refresh(); }, [act]);           // 웹에서 바꾼 리스트까지 다시 읽기

  const now = new Date();
  const today = ymd(now);
  const week = useMemo(() => weekOf(fromYmd(today)), [today]);
  // 오늘 방문 = 이번 주 일정(현장확인 리스트 달력) 중 오늘 날짜에 넣은 건물 수
  useEffect(() => { act.loadSchedule(week.key, week.start, week.end); }, [act, week, state.mode]);
  usePullRefresh(() => act.loadSchedule(week.key, week.start, week.end));   // 당겨서 새로고침 : 오늘 방문 수 다시 읽기
  const todayVisit = (state.schedule[week.key] ?? []).filter((it) => it.date === today).length;

  const rows = useMemo<Row[]>(() => state.groups.map((g, i) => {
    const bs = g.buildingIds.map((id) => state.buildings[id]).filter(Boolean);
    return { g, no: i + 1, bs, size: bs.length || g.size || 0, done: bs.filter((b) => b.status === 'done').length, status: groupStatus(bs) };
  }), [state.groups, state.buildings]);

  const total = rows.reduce((n, x) => n + x.size, 0);
  const done = rows.reduce((n, x) => n + x.done, 0);
  const doing = rows.filter((x) => x.status !== 'done');
  const finished = rows.filter((x) => x.status === 'done');

  const [tab, setTab] = useState<'doing' | 'done'>('doing');
  const shown = tab === 'doing' ? doing : finished;
  const [openId, setOpenId] = useState<string | null>(null);   // 펼친 리스트 (처음엔 모두 접힘)

  return (
    <div className="screen screen--tabs home">
      <header className="home__head">
        <p className="home__date">
          {now.getMonth() + 1}월 {now.getDate()}일 {WEEKDAYS[now.getDay()]}요일{state.mode === 'demo' && ' · 시연'}
          <button className="home__out" onClick={act.logout}>{state.mode === 'demo' ? '나가기' : '로그아웃'}</button>
        </p>
        <h1 className="home__hello">안녕하세요, {state.member?.name ?? ''} 님</h1>
      </header>

      {/* 오늘 진행률 */}
      <section className="hprog" aria-label="이번 주 현장 확인">
        <div className="hprog__top">
          <span className="hprog__title">이번 주 현장 확인</span>
          <span className="hprog__badge">진행중 리스트 {doing.length}개</span>
        </div>
        <p className="hprog__big"><b>{done}</b><span>/ {total}동 완료</span></p>
        <Bar value={done} total={total} className="hprog__bar" />
        <dl className="hprog__nums">
          <div><dt>남은 건물</dt><dd>{total - done}동</dd></div>
          <div><dt>확인 완료</dt><dd>{done}동</dd></div>
          <div><dt>오늘 방문</dt><dd>{todayVisit}동</dd></div>
        </dl>
      </section>

      <div className="home__lh">
        <h2 className="section-title">현장 확인 리스트</h2>
        <button
          className="home__add"
          aria-label="보관함 건물 추가"
          onClick={() => {
            const to = openId ?? doing[0]?.g.id ?? rows[0]?.g.id;
            if (!to) { act.toast('건물을 담을 현장확인 리스트가 없어요.'); return; }
            navigate(`/archive?add=${to}`);
          }}
        ><Ico name="plus" size={22} /></button>
      </div>
      <Segment
        value={tab}
        onChange={(v) => { setTab(v); setOpenId(null); }}
        options={[{ key: 'doing', label: `진행중 ${doing.length}` }, { key: 'done', label: `완료됨 ${finished.length}` }]}
      />

      {shown.length === 0 && (
        <p className="home__empty">{rows.length === 0 ? '받은 현장확인 리스트가 없어요.\n웹에서 "현장 확인 앱으로 보내기"를 누르면 여기에 생겨요.' : tab === 'doing' ? '진행 중인 리스트가 없어요.' : '아직 다 확인한 리스트가 없어요.'}</p>
      )}
      {shown.map((x) => (
        <ListCard
          key={x.g.id}
          row={x}
          open={openId === x.g.id}
          onToggle={() => setOpenId(openId === x.g.id ? null : x.g.id)}
          onOpenBuilding={(b) => navigate(b.status === 'done' ? `/result/${b.id}` : `/record/${b.id}?group=${x.g.id}`)}
          onRoute={() => navigate(`/route/${x.g.id}`)}
          onMap={(b) => navigate(`/route/${x.g.id}?open=${b.id}`)}
        />
      ))}

      <TabBar />
    </div>
  );
}

function ListCard({ row, open, onToggle, onOpenBuilding, onRoute, onMap }: {
  row: Row; open: boolean; onToggle: () => void; onOpenBuilding: (b: Building) => void; onRoute: () => void; onMap: (b: Building) => void;
}) {
  const { g, no, bs, size, done, status } = row;
  const first = bs[0];
  const area = first ? `${first.gu} ${first.dong.split(' ')[0]}` : '';
  const current = bs.find((b) => b.status !== 'done');          // 지금 갈 곳 = 아직 확인 안 한 첫 건물
  const [pickedId, setPickedId] = useState<string | null>(null);  // 누른 건물 (한 번 더 누르면 해제)
  const picked = bs.find((b) => b.id === pickedId);
  const target = picked ?? current;                              // '현장 확인 시작' 대상

  return (
    <section className={`hl card ${open ? 'is-open' : ''}`}>
      <button className="hl__head" onClick={onToggle} aria-expanded={open}>
        <span className="hl__tx">
          <span className="hl__meta">현장확인 리스트 {no} · {g.date}</span>
          <span className="hl__title">{g.title}</span>
        </span>
        <StatusBadge status={status} />
        <Ico name={open ? 'chevUp' : 'chevDown'} size={22} />
      </button>
      <div className="chips">
        {area && <Chip icon="pin">{area}</Chip>}
        <Chip icon="building">건물 {size}동</Chip>
      </div>
      <div className="hl__prog">
        <Bar value={done} total={size} className="hl__bar" />
        <b>{done}/{size}</b>
      </div>

      {open && (
        <>
          <hr className="divider" />
          <p className="hl__sub">동선 순서</p>
          <ul className="hl__rows">
            {bs.length === 0 && <li className="hl__none">건물을 불러오는 중이에요.</li>}
            {bs.map((b, i) => {
              const isDone = b.status === 'done';
              const isCur = b.id === current?.id;
              const isPicked = b.id === pickedId;
              return (
                <li key={b.id} className={isPicked ? 'is-picked' : ''}>
                  <button className={`hl__row ${isDone ? 'is-done' : ''}`} aria-pressed={isPicked} onClick={() => setPickedId(isPicked ? null : b.id)}>
                    <span className={`hl__no ${isDone ? 'is-done' : isCur ? 'is-cur' : ''}`}>
                      {isDone ? <Ico name="checkWhite" size={15} /> : i + 1}
                    </span>
                    <span className="hl__btx">
                      <span className="hl__name">{b.dong} {b.type}</span>
                      <span className="hl__addr">서울특별시 {b.gu} {b.dong}</span>
                    </span>
                    <span className="hl__right">
                      <b>{b.score}</b>
                      <StatusBadge status={b.status} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="hl__btns">
            {picked
              ? <button className="btn btn--soft" onClick={() => onMap(picked)}><Ico name="locate" size={18} />지도에서 보기</button>
              : <button className="btn btn--ghost" onClick={onRoute}><Ico name="route" size={18} />동선 보기</button>}
            {target && (target.status === 'done' ? (
              <button className="btn btn--primary hl__start" onClick={() => onOpenBuilding(target)}>결과 보기</button>
            ) : (
              <button className="btn btn--primary hl__start" onClick={() => onOpenBuilding(target)}><Ico name="editWhite" size={18} />현장 확인 시작</button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
