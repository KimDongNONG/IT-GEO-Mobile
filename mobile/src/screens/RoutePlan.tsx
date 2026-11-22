// M2 동선 : 위 = 지도(뒤로 · 리스트 이름 · 완료 수 · 지금 갈 곳 보기), 아래 = 방문 순서 시트
//   방문 순서 : 확인한 곳(체크) → 지금 갈 곳(처음부터 펼침 : 길찾기 · 현장 기록) → 남은 곳. 줄을 누르면 그 건물을 펼치고 지도도 그 건물로 확대
//   순서 편집 : 오른쪽 손잡이를 끌어서 순서를 바꾼다 (서버 저장은 AppStore.reorder)
//   거리 : 서버 모드는 TMAP 도보 경로(구간별 legs, 구청 출발), 시연 모드는 도식 지도 거리
import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Building } from '../data/types';
import { useGroup, useStore } from '../store/AppStore';
import RouteMap, { routeSummary } from '../components/RouteMap';
import { useWalk } from '../components/NaverMap';
import { guOffice } from '../api/itgeo';
import { DragHandle, IconBack, IconCheck16, IconDoc, IconLocate, IconNav, IconPencil, IconRoute16 } from '../components/icons';
import { Notice, Screen, StatusBadge, TabBar } from '../components/ui';
import './RoutePlan.css';

const M_PER_PX = 7;         // 도식 지도 1px ≈ 7m (RouteMap.routeSummary 와 같은 값)
const MIN_PER_KM = 15.2;    // 도보 속도

const fmtM = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m / 10) * 10}m`);

/** 건물별 "앞 지점에서 이 건물까지" 거리(m) · 시간(분). 첫 건물의 앞 지점은 구청(서버) 또는 없음(시연) */
function useLegs(buildings: Building[], sggCd: string | null | undefined, real: boolean) {
  const located = buildings.filter((b) => b.lat && b.lng);
  const office = guOffice(sggCd);
  const walk = useWalk(real && located.length ? [office, ...located.map((b) => ({ lat: b.lat!, lng: b.lng! }))] : null);
  return useMemo(() => {
    const m: Record<string, { meters: number; minutes: number } | undefined> = {};
    if (walk) {
      located.forEach((b, i) => {
        const l = walk.legs[i];
        if (l) m[b.id] = { meters: l.distance, minutes: Math.max(1, Math.round(l.time / 60)) };
      });
    } else {
      for (let i = 1; i < buildings.length; i++) {
        const a = buildings[i - 1].pos, b = buildings[i].pos;
        const meters = Math.hypot((b.x - a.x) * 350, (b.y - a.y) * 220) * M_PER_PX;
        m[buildings[i].id] = { meters, minutes: Math.max(1, Math.round((meters / 1000) * MIN_PER_KM)) };
      }
    }
    const sum = walk
      ? { km: walk.totalDistance / 1000, minutes: Math.round(walk.totalTime / 60) }
      : routeSummary(buildings);
    return { legs: m, sum };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk, buildings]);
}

export default function RoutePlan() {
  const { groupId } = useParams();
  const { group, buildings } = useGroup(groupId);
  const { state, act } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const real = state.mode === 'server' && !!state.naverClientId;
  const { legs, sum } = useLegs(buildings, group?.sggCd, real);

  const doneCnt = buildings.filter((b) => b.status === 'done').length;
  const current = buildings.find((b) => b.status !== 'done');          // 지금 갈 곳 = 아직 확인 안 한 첫 건물
  // 펼친 건물 : 주소의 ?open= (없으면 지금 갈 곳)
  const openParam = params.get('open');
  const openId = openParam === '' ? null : openParam ?? current?.id ?? null;
  const setOpen = (id: string | null) => setParams({ open: id ?? '' }, { replace: true });
  // 지도 확대 대상 : 처음엔 전체 동선. 줄을 누르거나 오른쪽 위 버튼을 누르면 그 건물로 확대 (길찾기 화면에서 돌아온 ?open= 도 확대)
  const [focusId, setFocusId] = useState<string | null>(openParam || null);

  const [editing, setEditing] = useState(false);

  // ---- 끌어서 순서 바꾸기 (편집 모드에서만 손잡이가 보인다) ----
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; startY: number } | null>(null);
  const targetIndex = (clientY: number, from: number) => {
    const items = Array.from(listRef.current?.children ?? []) as HTMLElement[];
    let to = items.length - 1;
    for (let i = 0; i < items.length; i++) {
      if (i === from) continue; // 끌고 있는 줄은 위치 계산에서 뺌
      const r = items[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) { to = i > from ? i - 1 : i; break; }
    }
    return Math.max(0, Math.min(items.length - 1, to));
  };
  const onHandleDown = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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

  // 오른쪽 위 버튼 : 지금 갈 곳으로 확대 ↔ 전체 동선 보기
  const focusing = !!focusId;
  const onLocate = () => {
    if (focusing) { setFocusId(null); return; }
    const id = current?.id ?? buildings[0]?.id ?? null;
    setFocusId(id);
    if (id) setOpen(id);
  };

  return (
    <div className="screen screen--tabs rt">
      {/* ---------- 지도 ---------- */}
      <div className="rt__map">
        <RouteMap buildings={buildings} selectedId={focusId} group={group} />
        <div className="rt__top">
          <button className="rt__fab" onClick={() => navigate('/')} aria-label="뒤로 가기"><IconBack /></button>
          <div className="rt__title">
            <span className="rt__title-tx">{group.title}</span>
            <b className="rt__title-cnt">{doneCnt}/{buildings.length}</b>
          </div>
          <button className={`rt__fab ${focusing ? 'is-on' : ''}`} onClick={onLocate}
            aria-label={focusing ? '전체 동선 보기' : '지금 갈 곳 보기'}>
            <IconLocate />
          </button>
        </div>
        {buildings.length > 0 && (
          <button className="rt__fab rt__guide" onClick={() => navigate(`/route/${group.id}/guide`)} aria-label="경로 안내">
            <IconRoute16 />
          </button>
        )}
      </div>

      {/* ---------- 방문 순서 시트 ---------- */}
      <section className="rt__sheet">
        <span className="rt__grip" aria-hidden />
        <div className="rt__head">
          <h2>방문 순서</h2>
          {drag && <span className="rt__hint">끌어서 놓으세요</span>}
          {buildings.length > 1 && (
            <button className={`rt__edit ${editing ? 'is-on' : ''}`} onClick={() => setEditing(!editing)}>
              {editing ? '완료' : '순서 편집'}
            </button>
          )}
        </div>
        <div className="rt__chips">
          <span className="rt__chip">건물 {buildings.length}곳</span>
          <span className="rt__chip">{sum.km.toFixed(1)}km</span>
          <span className="rt__chip">도보 {sum.minutes}분</span>
        </div>

        {buildings.length === 0 && <p className="rt__empty">아직 불러온 건물이 없어요.</p>}

        <ol className={`rt__list ${editing ? 'is-editing' : ''}`} ref={listRef}>
          {buildings.map((b, i) => {
            const done = b.status === 'done';
            const isCur = b.id === current?.id;
            const open = !editing && openId === b.id;
            const leg = legs[b.id];
            const sub = done
              ? `${b.type} · 확인 완료`
              : isCur
                ? `${b.type}${leg ? ` · ${fmtM(leg.meters)} · 도보 ${leg.minutes}분` : ''}`
                : `${b.type}${leg ? ` · 앞 건물에서 ${fmtM(leg.meters)}` : ''}`;
            const cls = ['rt__item', done && 'is-done', isCur && 'is-cur', open && 'is-open',
              drag?.from === i && 'is-dragging',
              drag && drag.to === i && drag.from !== i && (drag.to > drag.from ? 'drop-after' : 'drop-before'),
            ].filter(Boolean).join(' ');
            return (
              <li key={b.id} className={cls} style={drag?.from === i ? { transform: `translateY(${drag.dy}px)` } : undefined}>
                <span className="rt__no">{done ? <IconCheck16 color="#FFFFFF" /> : i + 1}</span>
                <div className="rt__body">
                  <button className="rt__row" onClick={() => { if (editing) return; setOpen(open ? null : b.id); setFocusId(open ? null : b.id); }} tabIndex={editing ? -1 : 0} aria-expanded={open}>
                    <span className="rt__text">
                      <span className="rt__name">{b.gu} {b.dong}</span>
                      <span className="rt__sub">{sub}</span>
                    </span>
                    {!editing && <StatusBadge status={b.status} />}
                  </button>
                  {open && (
                    <div className="rt__acts">
                      <button className="rbtn" onClick={() => navigate(`/route/${group.id}/nav/${b.id}`)}><IconNav /> 길찾기</button>
                      {done ? (
                        <button className="rbtn" onClick={() => navigate(`/result/${b.id}`)}><IconDoc /> 기록 확인</button>
                      ) : (
                        <button className="rbtn rbtn--primary" onClick={() => navigate(`/record/${b.id}?group=${group.id}`)}><IconPencil /> 현장 기록</button>
                      )}
                    </div>
                  )}
                </div>
                {editing && (
                  <span className="rt__handle" aria-label="순서 바꾸기"
                    onPointerDown={(e) => onHandleDown(e, i)} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={onHandleUp}>
                    <DragHandle />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <TabBar />
    </div>
  );
}
