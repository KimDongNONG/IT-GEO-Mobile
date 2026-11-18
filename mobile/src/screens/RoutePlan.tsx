// M2 동선 · M2-1/M2-2 순서 조정 · M2-3 건물 선택(펼침)
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Building } from '../data/types';
import { useGroup, useStore } from '../store/AppStore';
import RouteMap from '../components/RouteMap';
import { DragHandle, IconDoc, IconDown, IconNav, IconPencil, IconRoute16, IconUp } from '../components/icons';
import { Chip, Notice, Screen, StatusBadge, StatusDot, SummaryRows, TabBar } from '../components/ui';
import './RoutePlan.css';

export default function RoutePlan() {
  const { groupId } = useParams();
  const { group, buildings } = useGroup(groupId);
  const { state, act } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openId = params.get('open');
  const setOpen = (id: string | null) => setParams(id ? { open: id } : {}, { replace: true });
  // 펼친 건물은 건축물대장 · 요인 근거를 서버에서 채움
  const opened = openId ? state.buildings[openId] : undefined;
  useEffect(() => {
    if (opened && !opened.detailLoaded) act.loadBuilding(opened.id).catch(() => undefined);
  }, [opened, act]);

  // ---- 끌어서 순서 바꾸기 ----
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; startY: number } | null>(null);

  const targetIndex = (clientY: number, from: number) => {
    const items = Array.from(listRef.current?.children ?? []) as HTMLElement[];
    let to = items.length - 1;
    for (let i = 0; i < items.length; i++) {
      if (i === from) continue; // 끌고 있는 카드는 위치 계산에서 뺌
      const r = items[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) { to = i > from ? i - 1 : i; break; }
    }
    return Math.max(0, Math.min(items.length - 1, to));
  };
  const onHandleDown = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ from: index, to: index, dy: 0, startY: e.clientY });
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, dy: e.clientY - drag.startY, to: targetIndex(e.clientY, drag.from) });
  };
  const onHandleUp = () => {
    if (drag && group && drag.from !== drag.to) act.reorder(group.id, drag.from, drag.to);
    setDrag(null);
  };

  if (!group) {
    return (
      <Screen title="동선" back="/" className="route">
        <Notice>진행 중인 현장확인 리스트가 없어요.</Notice>
        <TabBar />
      </Screen>
    );
  }

  return (
    <Screen title={group.title} back="/" className="route">
      <RouteMap buildings={buildings} selectedId={openId} group={group} />

      <div className="route__bar">
        <h2>방문 건물 순서</h2>
        {drag && <span className="route__hint">끌어서 놓으세요</span>}
        <button className="route__guide" onClick={() => navigate(`/route/${group.id}/guide`)}>
          <IconRoute16 /> 경로 안내
        </button>
      </div>

      <ul className="route__list" ref={listRef}>
        {buildings.map((b, i) => (
          <li
            key={b.id}
            className={`${drag?.from === i ? 'is-dragging' : ''} ${drag && drag.to === i && drag.from !== i ? (drag.to > drag.from ? 'drop-after' : 'drop-before') : ''}`}
            style={drag?.from === i ? { transform: `translateY(${drag.dy}px)` } : undefined}
          >
            <VisitCard
              b={b}
              index={i}
              open={openId === b.id}
              onToggle={() => setOpen(openId === b.id ? null : b.id)}
              onNav={() => navigate(`/route/${group.id}/nav/${b.id}`)}
              onRecord={() => navigate(b.status === 'done' ? `/result/${b.id}` : `/record/${b.id}?group=${group.id}`)}
              handleProps={{
                onPointerDown: (e) => onHandleDown(e, i),
                onPointerMove: onHandleMove,
                onPointerUp: onHandleUp,
                onPointerCancel: onHandleUp,
              }}
            />
          </li>
        ))}
      </ul>

      <TabBar />
    </Screen>
  );
}

function VisitCard({
  b, index, open, onToggle, onNav, onRecord, handleProps,
}: {
  b: Building;
  index: number;
  open: boolean;
  onToggle: () => void;
  onNav: () => void;
  onRecord: () => void;
  handleProps: React.HTMLAttributes<HTMLSpanElement>;
}) {
  const done = b.status === 'done';
  return (
    <article className={`visit card ${open ? 'is-open' : ''} ${done ? 'is-done' : ''}`}>
      <div className="visit__top" onClick={onToggle}>
        <span className="visit__handle" {...handleProps} onClick={(e) => e.stopPropagation()} aria-label="순서 바꾸기">
          <DragHandle />
        </span>
        <span className="visit__num">{index + 1}</span>
        <div className="visit__info">
          <p className="visit__name">
            <StatusDot status={b.status} />
            <span>{b.dong}</span>
          </p>
          <p className="visit__sub">{b.type} · {b.floors}</p>
          <div className="visit__chips">
            {b.factors.map((f) => <Chip key={f}>{f}</Chip>)}
          </div>
        </div>
        <StatusBadge status={b.status} />
        <button className="visit__toggle" aria-label={open ? '접기' : '펼치기'} aria-expanded={open}>
          {open ? <IconUp /> : <IconDown />}
        </button>
      </div>

      <div className="visit__actions">
        <button className="vbtn" onClick={onNav}><IconNav /> 길찾기</button>
        {done ? (
          <button className="vbtn" onClick={onRecord}><IconDoc /> 기록 확인</button>
        ) : (
          <button className="vbtn vbtn--primary" onClick={onRecord}><IconPencil /> 현장 기록</button>
        )}
      </div>

      {open && (
        <div className="visit__ledger">
          <p>건축물대장</p>
          <SummaryRows
            rows={[
              ['주용도', b.ledger.use],
              ['층수', b.ledger.floors],
              ['사용승인', b.ledger.approval],
              ['위반건축물', b.ledger.violation],
              ['세대수', b.ledger.units],
            ]}
          />
        </div>
      )}

      {done && <span className="visit__dim" />}
    </article>
  );
}
