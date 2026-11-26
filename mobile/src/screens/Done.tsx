// M6 확인 완료 목록 · M6-2 조회 기간 · 정렬 · M6-3 상세 필터
//   위 = 제목 · 검색(주소 · 동 이름, 오른쪽 필터 아이콘 → 상세 필터), 구별 칩, 기간 표시 + '1주일 · 최신순' 버튼(→ 조회 조건 시트)
//   아래 = 날짜별로 묶은 흰 카드 (사진 · 주소 · 유형 · 시각 · 담당자). 줄을 누르면 확인 결과 상세
//   상세 필터 : 지역(구 · 동), 취약 요인(여러 개, 모두 / 하나라도), 점수 구간, 방문 결과
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { usePullRefresh } from '../lib/pullRefresh';
import { Screen, Sheet, TabBar } from '../components/ui';
import ServerPhoto from '../components/ServerPhoto';
import { Ico } from '../components/figma';
import { dayKey, dayTitle, doneAt, hm } from '../lib/fieldcheck';
import type { Building, FieldRecord } from '../data/types';
import './Done.css';

const GU_ORDER = ['구로구', '양천구', '영등포구'];
const FACTOR_OPTS = ['지하', '옥탑', '고시원', '위반', '노후', '침수', '저지대'];
const SCORE_OPTS = [
  { key: '80', label: '80점 이상', min: 80, max: Infinity },
  { key: '60', label: '60~79점', min: 60, max: 79.999 },
  { key: '40', label: '40~59점', min: 40, max: 59.999 },
] as const;
const RESULT_OPTS = ['만남', '부재', '거부'];

type Period = 'week' | 'month' | 'quarter';
const PERIOD_LABEL: Record<Period, string> = { week: '1주일', month: '1개월', quarter: '3개월' };
const PERIOD_TITLE: Record<Period, string> = { week: '이번 주', month: '최근 1개월', quarter: '최근 3개월' };

interface Filter { gu: string; dong: string; factors: string[]; all: boolean; score: string | null; result: string | null }
const NO_FILTER: Filter = { gu: '전체', dong: '', factors: [], all: true, score: null, result: null };

interface Row { b: Building; rec?: FieldRecord; at: Date | null }

/** 조회 기간 : 1주일 = 이번 주 월 ~ 일, 1 · 3개월 = 오늘까지 */
function rangeOf(p: Period, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p === 'week') {
    const mon = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
    return { from: mon, to: new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7), last: new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6) };
  }
  const from = new Date(today.getFullYear(), today.getMonth() - (p === 'month' ? 1 : 3), today.getDate() + 1);
  return { from, to: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1), last: today };
}
const md = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
const dongOf = (b: Building) => b.dong.split(' ')[0] ?? '';
const resultOf = (rec?: FieldRecord) => rec?.visitResult ?? (rec ? (rec.resident === '부재' ? '부재' : '만남') : undefined);

function matches(r: Row, f: Filter) {
  if (f.gu !== '전체' && (r.b.gu || '기타') !== f.gu) return false;
  if (f.dong && dongOf(r.b) !== f.dong) return false;
  if (f.factors.length) {
    const has = (opt: string) => r.b.factors.some((x) => x.startsWith(opt));
    if (f.all ? !f.factors.every(has) : !f.factors.some(has)) return false;
  }
  if (f.score) {
    const band = SCORE_OPTS.find((x) => x.key === f.score)!;
    if (r.b.score < band.min || r.b.score > band.max) return false;
  }
  if (f.result && resultOf(r.rec) !== f.result) return false;
  return true;
}

export default function Done() {
  const { state, act } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState<Period>('week');
  const [oldFirst, setOldFirst] = useState(false);
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const [sheet, setSheet] = useState<'period' | 'filter' | null>(null);

  const rows = useMemo<Row[]>(() => Object.values(state.buildings)
    .filter((b) => b.status === 'done')
    .map((b) => { const rec = state.records[b.id]; return { b, rec, at: doneAt(b, rec) }; }), [state.buildings, state.records]);

  // 서버 모드 : 담당자 · 사진 · 방문 결과는 건물 상세(기록)에 있어서, 아직 안 읽은 건물만 차례로 읽는다
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

  // 당겨서 새로고침 : 웹에서 고친 기록(담당자 · 사진 · 방문 결과)까지 다시 읽기 (최근 것부터 40건, 4개씩 동시에)
  usePullRefresh(async () => {
    if (state.mode !== 'server') return;
    const ids = [...rows].sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0)).slice(0, 40).map((r) => r.b.id);
    const next = async (): Promise<void> => {
      const id = ids.shift();
      if (!id) return;
      await act.loadBuilding(id).catch(() => undefined);
      return next();
    };
    await Promise.all([next(), next(), next(), next()]);
  });

  const range = rangeOf(period);
  const inPeriod = useMemo(() => rows.filter((r) => r.at && r.at >= range.from && r.at < range.to),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, period]);

  const guCounts = useMemo(() => {
    const m = new Map<string, number>();
    inPeriod.forEach((r) => m.set(r.b.gu || '기타', (m.get(r.b.gu || '기타') ?? 0) + 1));
    return [...m.entries()].sort((a, b) => (GU_ORDER.indexOf(a[0]) + 99) % 99 - (GU_ORDER.indexOf(b[0]) + 99) % 99);
  }, [inPeriod]);

  const search = (list: Row[]) => {
    const k = q.trim().replace(/\s+/g, '');
    return k ? list.filter((r) => `${r.b.gu}${r.b.dong}${r.b.type}`.replace(/\s+/g, '').includes(k)) : list;
  };
  const shown = useMemo(() => search(inPeriod.filter((r) => matches(r, filter)))
    .sort((a, b) => ((b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0)) * (oldFirst ? -1 : 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inPeriod, filter, q, oldFirst]);

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

  const extra = (filter.dong ? 1 : 0) + filter.factors.length + (filter.score ? 1 : 0) + (filter.result ? 1 : 0);
  const sortLabel = `${PERIOD_LABEL[period]} · ${oldFirst ? '과거순' : '최신순'}`;

  return (
    <Screen title="확인 완료" sub={`${PERIOD_TITLE[period]}${period === 'week' ? '에' : ' 동안'} 현장 확인을 마친 건물`} className="done">
      <label className="done__search">
        <Ico name="search" size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="주소나 동 이름으로 검색" aria-label="주소나 동 이름으로 검색" />
        <button type="button" className={`done__filter ${extra ? 'is-on' : ''}`} aria-label={`상세 필터${extra ? ` (${extra}개 적용)` : ''}`} onClick={() => setSheet('filter')}>
          <Ico name="filter" size={20} />
          {extra > 0 && <i>{extra}</i>}
        </button>
      </label>

      <div className="done__chips" role="tablist" aria-label="구별 보기">
        {[['전체', inPeriod.length] as const, ...guCounts].map(([name, n]) => (
          <button key={name} role="tab" aria-selected={filter.gu === name} className={`pill ${filter.gu === name ? 'is-on' : ''}`}
            onClick={() => setFilter((f) => ({ ...f, gu: name, dong: '' }))}>
            {name} {n}
          </button>
        ))}
      </div>

      <div className="done__period">
        <p><b>{PERIOD_TITLE[period]}</b><span>{md(range.from)} ~ {md(range.last)}</span></p>
        <button className="done__sortbtn" onClick={() => setSheet('period')}>
          <Ico name="sort" size={16} />{sortLabel}<Ico name="chevDown14" size={14} />
        </button>
      </div>

      {groups.length === 0 && (
        <p className="done__empty">{inPeriod.length ? '조건에 맞는 건물이 없어요.' : `${PERIOD_TITLE[period]} 확인을 마친 건물이 없어요.`}</p>
      )}
      {groups.map((g) => (
        <section key={g.key} className="done__day">
          <h2>{g.title}</h2>
          <ul className="done__list card">
            {g.rows.map(({ b, rec, at }) => (
              <li key={b.id}>
                <button className="done__row" onClick={() => navigate(`/result/${b.id}`)}>
                  <span className="done__thumb">
                    {rec?.photoIds?.length ? <ServerPhoto id={rec.photoIds[0]} alt="" />
                      : rec?.photos.length ? <img src={rec.photos[0]} alt="" />
                      : <Ico name="image20" size={20} />}
                  </span>
                  <span className="done__body">
                    <b>{b.gu} {b.dong}</b>
                    <small>{[b.type, at ? hm(at) : '', rec?.author].filter(Boolean).join(' · ')}</small>
                  </span>
                  <Ico name="chevRightSub" size={20} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {groups.length > 0 && (
        <p className="done__end">
          {PERIOD_TITLE[period]} 확인 완료는 여기까지예요
          {period !== 'quarter' && <><br />지난 기록은 ‘{sortLabel}’을 눌러 기간을 바꿔 보세요</>}
        </p>
      )}

      {sheet === 'period' && (
        <PeriodSheet
          period={period}
          oldFirst={oldFirst}
          onApply={(p, o) => { setPeriod(p); setOldFirst(o); setSheet(null); }}
          onDismiss={() => setSheet(null)}
        />
      )}
      {sheet === 'filter' && (
        <FilterSheet
          rows={search(inPeriod)}
          value={filter}
          onApply={(f) => { setFilter(f); setSheet(null); }}
          onDismiss={() => setSheet(null)}
        />
      )}
      <TabBar />
    </Screen>
  );
}

/** M6-2 조회 조건 : 조회 기간 · 정렬 순서 */
function PeriodSheet({ period, oldFirst, onApply, onDismiss }: {
  period: Period; oldFirst: boolean; onApply: (p: Period, oldFirst: boolean) => void; onDismiss: () => void;
}) {
  const [p, setP] = useState(period);
  const [o, setO] = useState(oldFirst);
  return (
    <Sheet onDismiss={onDismiss} title="조회 조건을 선택해 주세요" close className="dsheet">
      <div className="sheet__field">
        <p className="sheet__label">조회 기간</p>
        <div className="opts">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((k) => (
            <button key={k} className={`opt ${p === k ? 'is-on' : ''}`} aria-pressed={p === k} onClick={() => setP(k)}>{PERIOD_LABEL[k]}</button>
          ))}
        </div>
        <p className="sheet__hint">{p === 'week' ? '1주일은 이번 주(월~일) 확인 완료 건물을 보여 줘요' : `오늘까지 ${PERIOD_LABEL[p]} 동안 확인 완료한 건물을 보여 줘요`}</p>
      </div>
      <div className="sheet__field">
        <p className="sheet__label">정렬 순서</p>
        <div className="opts">
          <button className={`opt ${!o ? 'is-on' : ''}`} aria-pressed={!o} onClick={() => setO(false)}>최신순</button>
          <button className={`opt ${o ? 'is-on' : ''}`} aria-pressed={o} onClick={() => setO(true)}>과거순</button>
        </div>
      </div>
      <button className="btn btn--primary dsheet__go" onClick={() => onApply(p, o)}>확인</button>
    </Sheet>
  );
}

/** M6-3 상세 필터 : 지역(구 · 동) · 취약 요인 · 점수 구간 · 방문 결과. 아래 버튼에 맞는 건수 */
function FilterSheet({ rows, value, onApply, onDismiss }: {
  rows: Row[]; value: Filter; onApply: (f: Filter) => void; onDismiss: () => void;
}) {
  const [f, setF] = useState<Filter>(value);
  const gus = ['전체', ...GU_ORDER];
  const dongs = [...new Set(rows.filter((r) => f.gu === '전체' || r.b.gu === f.gu).map((r) => dongOf(r.b)).filter(Boolean))].sort();
  const count = rows.filter((r) => matches(r, f)).length;
  const toggleFactor = (x: string) => setF((v) => ({ ...v, factors: v.factors.includes(x) ? v.factors.filter((y) => y !== x) : [...v.factors, x] }));

  return (
    <Sheet onDismiss={onDismiss} title="상세 필터" desc="고른 조건에 맞는 건물만 목록에 보여 줘요" close className="dsheet dsheet--filter">
      <div className="sheet__field">
        <p className="sheet__label">지역</p>
        <div className="opts">
          {gus.map((g) => (
            <button key={g} className={`opt opt--sm ${f.gu === g ? 'is-on' : ''}`} aria-pressed={f.gu === g} onClick={() => setF((v) => ({ ...v, gu: g, dong: '' }))}>{g}</button>
          ))}
        </div>
        <label className="dsheet__select">
          <select value={f.dong} onChange={(e) => setF((v) => ({ ...v, dong: e.target.value }))} aria-label="동 선택">
            <option value="">동 전체</option>
            {dongs.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <Ico name="chevDown16" size={16} />
        </label>
      </div>

      <div className="sheet__field">
        <p className="sheet__label">취약 요인<small>여러 개 고를 수 있어요</small></p>
        <div className="dsheet__factors">
          {FACTOR_OPTS.map((x) => (
            <button key={x} className={`opt opt--sm ${f.factors.includes(x) ? 'is-on' : ''}`} aria-pressed={f.factors.includes(x)} onClick={() => toggleFactor(x)}>{x}</button>
          ))}
        </div>
        <div className="seg dsheet__mode" role="radiogroup" aria-label="요인 조건">
          <button role="radio" aria-checked={f.all} className={f.all ? 'is-on' : ''} onClick={() => setF((v) => ({ ...v, all: true }))}>모두 가진 건물</button>
          <button role="radio" aria-checked={!f.all} className={!f.all ? 'is-on' : ''} onClick={() => setF((v) => ({ ...v, all: false }))}>하나라도 가진 건물</button>
        </div>
      </div>

      <div className="sheet__field">
        <p className="sheet__label">점수 구간<small>분석 점수 기준</small></p>
        <div className="opts">
          {SCORE_OPTS.map((x) => (
            <button key={x.key} className={`opt opt--sm ${f.score === x.key ? 'is-on' : ''}`} aria-pressed={f.score === x.key}
              onClick={() => setF((v) => ({ ...v, score: v.score === x.key ? null : x.key }))}>{x.label}</button>
          ))}
        </div>
      </div>

      <div className="sheet__field">
        <p className="sheet__label">방문 결과</p>
        <div className="opts">
          {RESULT_OPTS.map((x) => (
            <button key={x} className={`opt opt--sm ${f.result === x ? 'is-on' : ''}`} aria-pressed={f.result === x}
              onClick={() => setF((v) => ({ ...v, result: v.result === x ? null : x }))}>{x}</button>
          ))}
        </div>
      </div>

      <div className="sheet__btns dsheet__btns">
        <button className="btn btn--ghost" onClick={() => setF(NO_FILTER)}>초기화</button>
        <button className="btn btn--primary" onClick={() => onApply(f)}>{count}건 보기</button>
      </div>
    </Sheet>
  );
}
