// 확인 탭 : 확인 완료 리스트 (지금까지 현장 확인을 마친 건물)
//   위 = 요약(누적 · 이번 주 · 부서 이관), 검색(주소 · 동 이름), 구별 칩, 날짜별 묶음 카드
//   줄을 누르면 확인 결과 화면 → '확인 내용 수정'으로 현장 기록을 고친다
//   부서 이관 = 기록의 '필요한 지원'을 넘길 부서로 바꾼 것 (집 수리 · 주거 이전 → 주택과, 긴급복지 · 돌봄 연계 · 안부 확인 → 복지과, 의료 → 보건소)
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { Screen, TabBar } from '../components/ui';
import ServerPhoto from '../components/ServerPhoto';
import { IconChevronRight, IconFilter, IconImage, IconSearch } from '../components/icons';
import { DEPT_CLASS, dayKey, dayTitle, deptsOf, doneAt, hm, inThisWeek } from '../lib/fieldcheck';
import type { Building, FieldRecord } from '../data/types';
import './Done.css';

const GU_ORDER = ['구로구', '양천구', '영등포구'];

interface Row { b: Building; rec?: FieldRecord; at: Date | null; depts: string[] }

export default function Done() {
  const { state, act } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [gu, setGu] = useState('전체');
  const [oldFirst, setOldFirst] = useState(false);

  const rows = useMemo<Row[]>(() => Object.values(state.buildings)
    .filter((b) => b.status === 'done')
    .map((b) => { const rec = state.records[b.id]; return { b, rec, at: doneAt(b, rec), depts: deptsOf(rec) }; }), [state.buildings, state.records]);

  // 서버 모드 : 담당자 · 부서 이관 · 사진은 건물 상세(기록)에 있어서, 아직 안 읽은 건물만 차례로 읽는다
  const missing = rows.filter((r) => !r.rec).map((r) => r.b.id).join(',');
  useEffect(() => {
    if (state.mode !== 'server' || !missing) return;
    let alive = true;
    (async () => {
      for (const id of missing.split(',').slice(0, 40)) {
        if (!alive) return;
        await act.loadBuilding(id).catch(() => undefined);
      }
    })();
    return () => { alive = false; };
  }, [state.mode, missing, act]);

  const guCounts = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.b.gu || '기타', (m.get(r.b.gu || '기타') ?? 0) + 1));
    return [...m.entries()].sort((a, b) => (GU_ORDER.indexOf(a[0]) + 99) % 99 - (GU_ORDER.indexOf(b[0]) + 99) % 99);
  }, [rows]);

  const shown = useMemo(() => {
    const k = q.trim().replace(/\s+/g, '');
    return rows
      .filter((r) => gu === '전체' || (r.b.gu || '기타') === gu)
      .filter((r) => !k || `${r.b.gu}${r.b.dong}${r.b.type}`.replace(/\s+/g, '').includes(k))
      .sort((a, b) => ((b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0)) * (oldFirst ? -1 : 1));
  }, [rows, gu, q, oldFirst]);

  const groups = useMemo(() => {
    const out: { key: string; title: string; rows: Row[] }[] = [];
    for (const r of shown) {
      const key = r.at ? dayKey(r.at) : 'none';
      let g = out.find((x) => x.key === key);
      if (!g) { g = { key, title: r.at ? dayTitle(r.at) : '날짜 없음', rows: [] }; out.push(g); }
      g.rows.push(r);
    }
    return out;
  }, [shown]);

  const week = rows.filter((r) => r.at && inThisWeek(r.at)).length;
  const moved = rows.filter((r) => r.depts.length).length;

  return (
    <Screen title="확인 완료" className="done">
      <p className="done__desc">지금까지 현장 확인을 마친 건물</p>

      <div className="done__stats card">
        <div><span>누적</span><b>{rows.length}곳</b></div>
        <div><span>이번 주</span><b className="is-blue">{week}곳</b></div>
        <div><span>부서 이관</span><b>{moved}건</b></div>
      </div>

      <label className="done__search">
        <IconSearch />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="주소나 동 이름으로 검색" aria-label="주소나 동 이름으로 검색" />
        <button
          type="button"
          className={`done__sort ${oldFirst ? 'is-on' : ''}`}
          aria-label={oldFirst ? '오래된 순 (누르면 최신 순)' : '최신 순 (누르면 오래된 순)'}
          onClick={() => { setOldFirst((v) => !v); act.toast(oldFirst ? '최신 순으로 보여요.' : '오래된 순으로 보여요.'); }}
        >
          <IconFilter color={oldFirst ? 'var(--primary)' : 'var(--sub)'} />
        </button>
      </label>

      <div className="done__chips" role="tablist" aria-label="구별 보기">
        {[['전체', rows.length] as const, ...guCounts].map(([name, n]) => (
          <button key={name} role="tab" aria-selected={gu === name} className={gu === name ? 'is-on' : ''} onClick={() => setGu(name)}>
            {name} {n}
          </button>
        ))}
      </div>

      {groups.length === 0 && <p className="done__empty">{rows.length ? '찾는 건물이 없어요.' : '아직 확인을 마친 건물이 없어요.'}</p>}
      {groups.map((g) => (
        <section key={g.key} className="done__day">
          <h2>{g.title}</h2>
          <ul className="done__list card">
            {g.rows.map(({ b, rec, at, depts }) => (
              <li key={b.id}>
                <button className="done__row" onClick={() => navigate(`/result/${b.id}`)}>
                  <span className="done__thumb">
                    {rec?.photoIds?.length ? <ServerPhoto id={rec.photoIds[0]} alt="" />
                      : rec?.photos.length ? <img src={rec.photos[0]} alt="" />
                      : <IconImage />}
                  </span>
                  <span className="done__body">
                    <b>{b.gu} {b.dong}</b>
                    <small>{[b.type, at ? hm(at) : '', rec?.author].filter(Boolean).join(' · ')}</small>
                    <span className="done__tags">
                      {rec ? (depts.length ? depts.map((d) => <i key={d} className={DEPT_CLASS[d] ?? ''}>{d}</i>) : <i className="is-none">넘김 없음</i>) : <i className="is-none">불러오는 중</i>}
                    </span>
                  </span>
                  <IconChevronRight />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <TabBar />
    </Screen>
  );
}
