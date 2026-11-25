// 홈 : 오늘의 현장확인 리스트를 진행중 / 완료됨 으로 나눠 진행 상황을 보여 준다 (오늘 진행 상태 숫자는 홈 상단 카드)
//   리스트 항목 = api/mobile/schedule/day.do (건물 취약점 · 가구 취약점 포함)
//   리스트 카드를 펼치면 동선 순서 + 수정 모드 (순서 바꾸기 · 빼기 · 보관함에서 넣기)
//   완료 기준 : 그날 확인 기록이 있는 건물 (recordId). 리스트 안 건물을 다 기록하면 완료됨 탭으로 간다
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { DragHandle, IconCheck16, IconDown, IconRoute16, IconSearch, IconUp } from './icons';
import { Btn, Modal, StatusBadge } from './ui';
import { STATUS_CLASS, dayRows, fromYmd, listsOfDay, ymd, type DayList } from '../lib/schedule';
import type { ScheduleItem, VisitStatus, WorkStatus } from '../data/types';
import './WeekPlan.css';

/** 취약점 줄 : 최대 3개, 나머지는 (+n) */
function Vulns({ label, list }: { label: string; list?: string[] }) {
  const items = list ?? [];
  return (
    <span className="wk-vulns">
      <span className="wk-vulns__label">{label}</span>
      {items.length === 0 && <span className="wk-vulns__none">없음</span>}
      {items.slice(0, 3).map((v) => <span key={v} className="wk-chip">{v}</span>)}
      {items.length > 3 && <span className="wk-vulns__more">(+{items.length - 3})</span>}
    </span>
  );
}

export default function WeekPlan() {
  const { state, act } = useStore();
  const navigate = useNavigate();
  const today = ymd(new Date());
  const selected = today;                                          // 주간 달력 없이 오늘만
  const [tab, setTab] = useState<'doing' | 'done'>('doing');
  const [openId, setOpenId] = useState<string | null>(null);        // 펼친 리스트 (groupId, null = 아직 안 정함)
  const [editing, setEditing] = useState<string | null>(null);      // 수정 중인 리스트 (groupId)
  const [adding, setAdding] = useState<DayList | null>(null);       // + 로 연 건물 추가 창
  const [deleting, setDeleting] = useState<{ list: DayList; item: ScheduleItem } | null>(null);

  useEffect(() => { act.loadDay(selected); setEditing(null); setOpenId(null); setTab('doing'); }, [act, selected, state.mode]);

  const dayItems = state.days[selected];

  // 건물별 그날 상태 (완료 · 다음 · 예정 · 재방문 · 부재 · 종료 · 자원 연결) : 확인 탭 달력과 같은 규칙
  const visit = useMemo(() => {
    const m: Record<string, VisitStatus> = {};
    for (const r of dayRows(dayItems ?? [], selected, today)) m[r.item.key] = r.status;
    return m;
  }, [dayItems, selected, today]);

  const lists = useMemo(() => listsOfDay(dayItems ?? []).map((l) => {
    const visited = l.items.filter((it) => it.recordId != null).length;
    return { list: l, visited, total: l.items.length, done: l.items.length > 0 && visited === l.items.length };
  }), [dayItems]);
  const doingLists = lists.filter((x) => !x.done);
  const doneLists = lists.filter((x) => x.done);
  const shown = tab === 'doing' ? doingLists : doneLists;

  // 처음에는 보이는 탭의 첫 리스트를 펼쳐 둔다
  const firstId = shown[0]?.list.groupId;
  useEffect(() => { if (openId === null && firstId) setOpenId(firstId); }, [openId, firstId]);

  // 줄을 누르면 (수정 모드가 아닐 때) : 바로 현장 기록 화면으로. 기록 화면의 '이전'은 홈으로 돌아온다 (from=home)
  //   이미 기록한 결과는 확인 탭 → 확인 결과에서 본다
  const openRow = (it: ScheduleItem) => {
    if (!state.buildings[it.bldId]) return;
    navigate(`/record/${it.bldId}?group=${it.groupId}&from=home`);
  };

  const sel = fromYmd(selected);

  return (
    <section className="wk">
      <h2 className="wk__heading">오늘의 현장확인 리스트</h2>
      <div className="wk__tabs" role="tablist" aria-label="리스트 진행 상황">
        <button role="tab" aria-selected={tab === 'doing'} className={tab === 'doing' ? 'is-on' : ''} onClick={() => setTab('doing')}>
          진행중 {doingLists.length}
        </button>
        <button role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'is-on' : ''} onClick={() => setTab('done')}>
          완료됨 {doneLists.length}
        </button>
      </div>

      <div className="wk__lists">
        {dayItems === undefined && <p className="wk__empty">불러오는 중…</p>}
        {dayItems && lists.length === 0 && <p className="wk__empty">오늘 나가기로 한 현장확인 리스트가 없어요.</p>}
        {dayItems && lists.length > 0 && shown.length === 0 && (
          <p className="wk__empty">{tab === 'doing' ? '오늘 리스트는 모두 확인했어요.' : '오늘 다 확인한 리스트가 아직 없어요.'}</p>
        )}
        {shown.map((x) => (
          <ListBlock
            key={x.list.groupId}
            list={x.list}
            visited={x.visited}
            dateLabel={`${sel.getMonth() + 1}월 ${sel.getDate()}일`}
            visit={visit}
            open={openId === x.list.groupId}
            onToggleOpen={() => { setOpenId(openId === x.list.groupId ? '' : x.list.groupId); setEditing(null); }}
            editing={editing === x.list.groupId}
            onToggleEdit={() => setEditing(editing === x.list.groupId ? null : x.list.groupId)}
            onReorder={(from, to) => act.dayReorder(selected, x.list.groupId, from, to)}
            onDelete={(item) => setDeleting({ list: x.list, item })}
            onAdd={() => setAdding(x.list)}
            onOpen={openRow}
            onMap={state.groups.some((g) => g.id === x.list.groupId) ? () => navigate(`/route/${x.list.groupId}`) : undefined}
          />
        ))}
      </div>

      {adding && (
        <AddSheet
          list={adding}
          onPick={(archiveId) => { act.dayAdd(selected, adding.groupId, archiveId); setAdding(null); }}
          onDismiss={() => setAdding(null)}
        />
      )}

      {deleting && (
        <Modal onDismiss={() => setDeleting(null)}>
          <h2 className="dlg__title">이 건물을 뺄까요?</h2>
          <p className="dlg__desc">'{deleting.list.title}' 리스트에서 빠지고,<br />업무 리스트(보관함)에는 그대로 남아 있어요.</p>
          <div className="dlg__target"><div><p className="dlg__target-name">{deleting.item.place}</p></div></div>
          <div className="dlg__actions">
            <Btn onClick={() => setDeleting(null)}>취소</Btn>
            <Btn variant="danger" onClick={() => { act.dayRemove(selected, deleting.list.groupId, deleting.item.key); setDeleting(null); }}>빼기</Btn>
          </div>
        </Modal>
      )}
    </section>
  );
}

/** 리스트 카드 하나 : 머리(이름 · 상태 · 건물 수 · 진행 막대)를 누르면 펼쳐지고, 펼치면 동선 순서 + 수정 */
function ListBlock({ list, visited, dateLabel, visit, open, onToggleOpen, editing, onToggleEdit, onReorder, onDelete, onAdd, onOpen, onMap }: {
  list: DayList; visited: number; dateLabel: string; visit: Record<string, VisitStatus>;
  open: boolean; onToggleOpen: () => void; editing: boolean; onToggleEdit: () => void;
  onReorder: (from: number, to: number) => void; onDelete: (it: ScheduleItem) => void; onAdd: () => void; onOpen: (it: ScheduleItem) => void;
  onMap?: () => void;
}) {
  const total = list.items.length;
  const status: WorkStatus = total && visited === total ? 'done' : visited > 0 ? 'doing' : 'before';
  const pct = total ? Math.round((visited / total) * 100) : 0;

  // ---- 끌어서 순서 바꾸기 (RoutePlan.tsx 와 같은 방식) ----
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; startY: number } | null>(null);
  const targetIndex = (clientY: number, from: number) => {
    const rows = Array.from(listRef.current?.children ?? []) as HTMLElement[];
    let to = rows.length - 1;
    for (let i = 0; i < rows.length; i++) {
      if (i === from) continue;
      const r = rows[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) { to = i > from ? i - 1 : i; break; }
    }
    return Math.max(0, Math.min(rows.length - 1, to));
  };
  const onDown = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ from: index, to: index, dy: 0, startY: e.clientY });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, dy: e.clientY - drag.startY, to: targetIndex(e.clientY, drag.from) });
  };
  const onUp = () => {
    if (drag && drag.from !== drag.to) onReorder(drag.from, drag.to);
    setDrag(null);
  };

  return (
    <div className={`wl ${open ? 'is-open' : ''} ${editing ? 'is-editing' : ''}`}>
      <button className="wl__head" onClick={onToggleOpen} aria-expanded={open}>
        <span className="wl__text">
          <span className="wl__meta">현장확인 리스트 · {dateLabel}</span>
          <span className="wl__title">{list.title}</span>
        </span>
        <StatusBadge status={status} />
        {open ? <IconUp /> : <IconDown />}
      </button>
      <div className="wl__chips"><span className="wl__chip">건물 {total}동</span></div>
      <div className="wl__prog">
        <span className="wl__bar"><i style={{ width: `${pct}%` }} /></span>
        <span className="wl__cnt">{visited}/{total}</span>
      </div>

      {open && (
        <div className="wl__body">
          <div className="wl__sub">
            <span>동선 순서</span>
            <span className="wl__sub-acts">
              <button className="wl__edit" onClick={onToggleEdit}>{editing ? '완료' : '수정'}</button>
            </span>
          </div>
          {onMap && !editing && (
            <button className="wl__map" onClick={onMap}>
              <IconRoute16 color="currentColor" /> 지도로 경로 확인하기 <span aria-hidden>›</span>
            </button>
          )}

          <ol className="wl__rows" ref={listRef}>
            {list.items.map((it, i) => {
              const st = visit[it.key];
              const cls = ['wl__row', it.recordId != null && 'is-visited',
                drag?.from === i && 'is-dragging',
                drag && drag.to === i && drag.from !== i && (drag.to > drag.from ? 'drop-after' : 'drop-before'),
              ].filter(Boolean).join(' ');
              return (
                <li key={it.key} className={cls} style={drag?.from === i ? { transform: `translateY(${drag.dy}px)` } : undefined}>
                  {editing ? (
                    <span className="wl__handle" aria-label="순서 바꾸기"
                      onPointerDown={(e) => onDown(e, i)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                      <DragHandle />
                    </span>
                  ) : (
                    <span className="wl__no">{it.recordId != null ? <IconCheck16 color="#FFFFFF" /> : i + 1}</span>
                  )}
                  <button className="wl__main" onClick={() => !editing && onOpen(it)} tabIndex={editing ? -1 : 0}>
                    <span className="wl__addr">{it.place}</span>
                    <Vulns label="건물" list={it.bldFactors} />
                    <Vulns label="가구" list={it.hhVulns} />
                  </button>
                  {editing
                    ? <button className="wl__del" onClick={() => onDelete(it)}>삭제</button>
                    : (
                      <span className="wl__right">
                        <b className="wl__score">{it.score}</b>
                        {st && <span className={`vst vst--${STATUS_CLASS[st]}`}>{st}</span>}
                      </span>
                    )}
                </li>
              );
            })}
          </ol>

          {editing && (
            <button className="wl__add" onClick={onAdd} aria-label="건물 추가">+</button>
          )}
        </div>
      )}
    </div>
  );
}

/** + 를 누르면 : 업무 리스트(보관함) 건물 중 이 리스트에 없는 것을 검색해서 고른다 */
function AddSheet({ list, onPick, onDismiss }: { list: DayList; onPick: (archiveId: string) => void; onDismiss: () => void }) {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const inList = (a: { id: string; bldId?: string; factorId?: number }) =>
    list.items.some((it) => (a.factorId != null && it.factorId === a.factorId) || it.bldId === (a.bldId ?? a.id));
  const words = q.trim().toLowerCase();
  const rows = state.archive
    .filter((a) => !inList(a))
    .filter((a) => !words || `${a.name} ${a.factors.join(' ')}`.toLowerCase().includes(words));

  return (
    <Modal onDismiss={onDismiss} className="wadd">
      <h2 className="dlg__title">건물 추가</h2>
      <p className="dlg__desc">'{list.title}' 맨 뒤에 넣어요.</p>
      <label className="wadd__search">
        <IconSearch />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="주소, 건물명, 취약 요인 검색" autoFocus />
      </label>
      <ul className="wadd__list">
        {rows.length === 0 && <li className="wadd__none">{state.archive.length ? '맞는 건물이 없어요.' : '업무 리스트에 담은 건물이 없어요.'}</li>}
        {rows.map((a) => (
          <li key={a.id}>
            <button onClick={() => onPick(a.id)}>
              <span className="wadd__name">{a.name}</span>
              <span className="wadd__sub">{a.factors.slice(0, 3).join(' · ')}{a.factors.length > 3 ? ` (+${a.factors.length - 3})` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="dlg__actions"><Btn onClick={onDismiss}>닫기</Btn></div>
    </Modal>
  );
}
