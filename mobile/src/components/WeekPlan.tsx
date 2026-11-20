// 홈 : 이번 주 주간 일정 + 고른 날의 현장확인 리스트 (수정 모드 : 순서 바꾸기 · 빼기 · 보관함에서 넣기)
//   주간 칸 = 확인 탭 달력과 같은 survey_schedule (api/mobile/schedule.do)
//   리스트 항목 = api/mobile/schedule/day.do (건물 취약점 · 가구 취약점 포함)
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { DragHandle, IconSearch } from './icons';
import { Btn, Modal } from './ui';
import { WEEKDAYS, fromYmd, listsOfDay, weekOf, ymd, type DayList } from '../lib/schedule';
import type { ScheduleItem } from '../data/types';
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
  const week = useMemo(() => weekOf(fromYmd(today)), [today]);
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<string | null>(null);      // 수정 중인 리스트 (groupId)
  const [adding, setAdding] = useState<DayList | null>(null);       // + 로 연 건물 추가 창
  const [deleting, setDeleting] = useState<{ list: DayList; item: ScheduleItem } | null>(null);

  useEffect(() => { act.loadSchedule(week.key, week.start, week.end); }, [act, week, state.mode]);
  useEffect(() => { act.loadDay(selected); setEditing(null); }, [act, selected, state.mode]);

  const dayItems = state.days[selected];

  // 주간 칸 : 날짜별 건물 수 (고른 날은 수정한 결과가 바로 보이게 그날 목록 수로)
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of state.schedule[week.key] ?? []) m[it.date] = (m[it.date] ?? 0) + 1;
    if (dayItems) m[selected] = dayItems.length;
    return m;
  }, [state.schedule, week.key, dayItems, selected]);
  const lists = useMemo(() => listsOfDay(dayItems ?? []), [dayItems]);

  // 줄을 누르면 (수정 모드가 아닐 때) : 기록이 있으면 결과, 없으면 현장 기록 — 확인 탭 달력과 같음
  const openRow = (it: ScheduleItem) => {
    if (!state.buildings[it.bldId]) return;
    navigate(it.recordId != null ? `/result/${it.bldId}` : `/record/${it.bldId}?group=${it.groupId}`);
  };

  return (
    <section className="wk">
      <h2 className="wk__heading">이번 주 일정</h2>
      <div className="wk__strip" role="tablist" aria-label="이번 주">
        {week.days.map((d, i) => {
          const key = ymd(d);
          const n = counts[key] ?? 0;
          const cls = ['wk__day', i === 0 && 'is-sun', i === 6 && 'is-sat', key === today && 'is-today', key === selected && 'is-sel'].filter(Boolean).join(' ');
          return (
            <button key={key} role="tab" aria-selected={key === selected} className={cls} onClick={() => setSelected(key)}
              aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일${n ? `, 현장방문 ${n}곳` : ''}`}>
              <span className="wk__wd">{WEEKDAYS[i]}</span>
              <span className="wk__num">{d.getDate()}</span>
              <span className="wk__cnt">{n ? `${n}곳` : ''}</span>
            </button>
          );
        })}
      </div>

      <div className="wk__lists">
        {dayItems === undefined && <p className="wk__empty">불러오는 중…</p>}
        {dayItems && lists.length === 0 && <p className="wk__empty">이 날 나가기로 한 현장확인 리스트가 없어요.</p>}
        {lists.map((l) => (
          <ListBlock
            key={l.groupId}
            list={l}
            editing={editing === l.groupId}
            onToggleEdit={() => setEditing(editing === l.groupId ? null : l.groupId)}
            onReorder={(from, to) => act.dayReorder(selected, l.groupId, from, to)}
            onDelete={(item) => setDeleting({ list: l, item })}
            onAdd={() => setAdding(l)}
            onOpen={openRow}
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

/** 리스트 하나 : 제목 줄(오른쪽 끝 수정) + bar 로 나눈 건물 줄 */
function ListBlock({ list, editing, onToggleEdit, onReorder, onDelete, onAdd, onOpen }: {
  list: DayList; editing: boolean; onToggleEdit: () => void;
  onReorder: (from: number, to: number) => void; onDelete: (it: ScheduleItem) => void; onAdd: () => void; onOpen: (it: ScheduleItem) => void;
}) {
  // ---- 끌어서 순서 바꾸기 (RoutePlan.tsx 와 같은 방식) ----
  const listRef = useRef<HTMLUListElement>(null);
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
    <div className={`wl ${editing ? 'is-editing' : ''}`}>
      <div className="wl__head">
        <h3 className="wl__title">{list.title}</h3>
        <button className="wl__edit" onClick={onToggleEdit}>{editing ? '완료' : '수정'}</button>
      </div>

      <ul className="wl__rows" ref={listRef}>
        {list.items.map((it, i) => {
          const cls = ['wl__row',
            drag?.from === i && 'is-dragging',
            drag && drag.to === i && drag.from !== i && (drag.to > drag.from ? 'drop-after' : 'drop-before'),
          ].filter(Boolean).join(' ');
          return (
            <li key={it.key} className={cls} style={drag?.from === i ? { transform: `translateY(${drag.dy}px)` } : undefined}>
              {editing && (
                <span className="wl__handle" aria-label="순서 바꾸기"
                  onPointerDown={(e) => onDown(e, i)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                  <DragHandle />
                </span>
              )}
              <button className="wl__main" onClick={() => !editing && onOpen(it)} tabIndex={editing ? -1 : 0}>
                <span className="wl__addr">{it.place}</span>
                <Vulns label="건물" list={it.bldFactors} />
                <Vulns label="가구" list={it.hhVulns} />
              </button>
              {editing && <button className="wl__del" onClick={() => onDelete(it)}>삭제</button>}
            </li>
          );
        })}
      </ul>

      {editing && (
        <button className="wl__add" onClick={onAdd} aria-label="건물 추가">+</button>
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
