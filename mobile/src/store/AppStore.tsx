// 앱 상태. 두 가지 모드
//   - server : 웹과 같은 계정으로 로그인. 리스트 · 보관함 · 기록을 스프링 서버(웹과 같은 DB)에서 읽고 저장
//   - demo   : 로그인 화면의 '시연 모드'. Figma 값(data/mock.ts)으로 동작하고 폰 안에만 저장
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { ARCHIVE, ARCHIVE_COUNTS, BUILDINGS, GROUPS, RECORDS } from '../data/mock';
import type { ArchiveItem, Building, FieldRecord, Group } from '../data/types';
import { AuthError, setAuthLostHandler } from '../api/client';
import * as W from '../api/wellfair';

export type Mode = 'none' | 'demo' | 'server';
export interface Member { name: string; gu: string; dept: string; rank: string }
type Counts = { all: number; new: number; doing: number; done: number };

interface State {
  mode: Mode;
  ready: boolean;                 // 시작 시 로그인 확인 끝
  member: Member | null;
  buildings: Record<string, Building>;
  groups: Group[];
  archive: ArchiveItem[];
  archiveCounts: Counts;
  records: Record<string, FieldRecord>;
  lastResultId: string | null;    // 하단 탭 '확인'이 여는 결과
  naverClientId: string;
  toast: string | null;
}

type Action =
  | { type: 'ready'; mode: Mode }
  | { type: 'demo' }
  | { type: 'loaded'; member?: Member; groups: Group[]; buildings: Record<string, Building>; archive: ArchiveItem[]; naverClientId?: string }
  | { type: 'logout' }
  | { type: 'reorder'; groupId: string; from: number; to: number }
  | { type: 'removeFromGroup'; groupId: string; buildingId: string }
  | { type: 'replaceInGroup'; groupId: string; oldId: string; archiveId: string }
  | { type: 'saveRecord'; record: FieldRecord }
  | { type: 'patchBuilding'; building: Building }
  | { type: 'setRecord'; record: FieldRecord }
  | { type: 'toast'; msg: string | null };

const STORAGE_KEY = 'wellfair.mobile.v1';
const MODE_KEY = 'wellfair.mobile.mode';

const EMPTY: State = {
  mode: 'none', ready: false, member: null, buildings: {}, groups: [], archive: [], archiveCounts: { all: 0, new: 0, doing: 0, done: 0 },
  records: {}, lastResultId: null, naverClientId: '', toast: null,
};

function demoState(): State {
  const base: State = {
    ...EMPTY,
    mode: 'demo',
    ready: true,
    member: { name: '김구로', gu: '구로구', dept: '구로구청 복지정책과', rank: '주무관' },
    buildings: Object.fromEntries(BUILDINGS.map((b) => [b.id, b])),
    groups: GROUPS,
    archive: ARCHIVE,
    archiveCounts: ARCHIVE_COUNTS,
    records: Object.fromEntries(RECORDS.map((r) => [r.buildingId, r])),
    lastResultId: RECORDS[0]?.buildingId ?? null,
  };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const s = JSON.parse(saved);
      return { ...base, buildings: s.buildings ?? base.buildings, groups: s.groups ?? base.groups, archive: s.archive ?? base.archive, records: s.records ?? base.records, lastResultId: s.lastResultId ?? base.lastResultId };
    }
  } catch {
    /* 저장소를 못 쓰는 환경이면 기본값으로 */
  }
  return base;
}

function countsOf(archive: ArchiveItem[]): Counts {
  return {
    all: archive.length,
    new: archive.filter((a) => a.state === 'new').length,
    doing: archive.filter((a) => a.state === 'doing' || a.state === 'inGroup').length,
    done: archive.filter((a) => a.state === 'done').length,
  };
}

/** 시연 모드: 보관함 항목으로 그룹에 넣을 건물 정보를 만든다 */
function buildingFromArchive(a: ArchiveItem, pos: Building['pos']): Building {
  const [dong1, dong2, ...rest] = a.name.split(' ');
  return {
    id: a.id, gu: '구로구', dong: `${dong1} ${dong2}`, type: rest.join(' '), floors: '-',
    factors: a.factors.slice(0, 3), status: 'before', score: a.score, households: '-',
    ledger: { use: rest.join(' '), floors: '-', approval: '-', violation: '-', units: '-' },
    factorEvidence: a.factors.slice(0, 2).map((f) => ({ name: f, evidence: '분석 근거: 보관함 분석 결과' })),
    pos,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ready':
      return { ...state, ready: true, mode: action.mode };
    case 'demo':
      return demoState();
    case 'loaded': {
      const lastResultId = state.lastResultId && action.buildings[state.lastResultId] ? state.lastResultId : null;
      return {
        ...state, mode: 'server', ready: true,
        member: action.member ?? state.member,
        groups: action.groups, buildings: action.buildings, archive: action.archive, archiveCounts: countsOf(action.archive),
        naverClientId: action.naverClientId ?? state.naverClientId,
        lastResultId,
      };
    }
    case 'logout':
      return { ...EMPTY, ready: true };
    case 'reorder': {
      const groups = state.groups.map((g) => {
        if (g.id !== action.groupId) return g;
        const ids = [...g.buildingIds];
        const [moved] = ids.splice(action.from, 1);
        ids.splice(action.to, 0, moved);
        return { ...g, buildingIds: ids };
      });
      return { ...state, groups };
    }
    case 'removeFromGroup': {
      const groups = state.groups.map((g) =>
        g.id === action.groupId ? { ...g, buildingIds: g.buildingIds.filter((id) => id !== action.buildingId) } : g,
      );
      const archive = state.archive.map((a) => (a.id === action.buildingId ? { ...a, state: 'new' as const } : a));
      return { ...state, groups, archive };
    }
    case 'replaceInGroup': {
      const a = state.archive.find((x) => x.id === action.archiveId);
      const old = state.buildings[action.oldId];
      if (!a || !old) return state;
      const building = state.buildings[a.id] ?? buildingFromArchive(a, old.pos);
      const groups = state.groups.map((g) =>
        g.id === action.groupId ? { ...g, buildingIds: g.buildingIds.map((id) => (id === action.oldId ? a.id : id)) } : g,
      );
      const archive = state.archive.map((x) =>
        x.id === a.id ? { ...x, state: 'inGroup' as const } : x.id === action.oldId ? { ...x, state: 'new' as const } : x,
      );
      return { ...state, groups, archive, buildings: { ...state.buildings, [a.id]: building } };
    }
    case 'saveRecord': {
      const b = state.buildings[action.record.buildingId];
      return {
        ...state,
        records: { ...state.records, [action.record.buildingId]: action.record },
        buildings: b ? { ...state.buildings, [b.id]: { ...b, status: 'done' } } : state.buildings,
        lastResultId: action.record.buildingId,
      };
    }
    case 'patchBuilding':
      return { ...state, buildings: { ...state.buildings, [action.building.id]: action.building } };
    case 'setRecord':
      return { ...state, records: { ...state.records, [action.record.buildingId]: action.record } };
    case 'toast':
      return { ...state, toast: action.msg };
  }
}

function memberOf(m: W.MemberTO): Member {
  return { name: m.userNm ?? m.loginId, gu: m.guName || '서울시청', dept: m.deptNm ?? '', rank: m.rankNm ?? '' };
}

export interface Actions {
  login: (loginId: string, pw: string) => Promise<void>;
  startDemo: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  reorder: (groupId: string, from: number, to: number) => void;
  remove: (groupId: string, buildingId: string) => Promise<void>;
  replace: (groupId: string, oldId: string, archiveId: string) => Promise<void>;
  saveRecord: (rec: FieldRecord, onPhoto?: (done: number, total: number) => void) => Promise<{ failedPhotos: number }>;
  loadBuilding: (buildingId: string) => Promise<void>;
  toast: (msg: string | null) => void;
}

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void; act: Actions } | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, EMPTY);
  const ref = useRef(state);
  ref.current = state;

  // 시연 모드만 폰 안에 저장
  useEffect(() => {
    if (state.mode !== 'demo') return;
    try {
      const { buildings, groups, archive, records, lastResultId } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ buildings, groups, archive, records, lastResultId }));
    } catch {
      /* 무시 */
    }
  }, [state]);

  const fail = useCallback((e: unknown) => {
    if (e instanceof AuthError) return; // 로그인 화면으로 (setAuthLostHandler)
    dispatch({ type: 'toast', msg: e instanceof Error ? e.message : '처리하지 못했어요.' });
  }, []);

  /** 리스트 + 보관함을 다시 읽어서 웹에서 바꾼 내용까지 반영 */
  const load = useCallback(async (member?: Member) => {
    const [lists, picks, cfg] = await Promise.all([W.fetchGroups(), W.fetchArchive(), ref.current.naverClientId ? null : W.config().catch(() => null)]);
    const prev = ref.current.buildings;
    const buildings: Record<string, Building> = {};
    const groups = lists.map(W.groupFromServer);
    for (const f of lists) {
      const bs = f.items.map((it) => W.buildingFromItem(it, prev[it.bldId]));
      const pos = W.layoutPos(bs);
      for (const b of bs) buildings[b.id] = { ...b, pos: pos[b.id] ?? b.pos };
    }
    dispatch({ type: 'loaded', member, groups, buildings, archive: picks.map(W.archiveFromServer), naverClientId: cfg?.naverClientId });
  }, []);

  // 시작: 지난번 모드가 server 면 세션이 살아 있는지 확인
  useEffect(() => {
    let mode: string | null = null;
    try { mode = localStorage.getItem(MODE_KEY); } catch { /* 무시 */ }
    if (mode === 'demo') { dispatch({ type: 'demo' }); return; }
    if (mode !== 'server') { dispatch({ type: 'ready', mode: 'none' }); return; }
    W.me()
      .then((m) => load(memberOf(m)))
      .catch(() => dispatch({ type: 'ready', mode: 'none' }));
  }, [load]);

  // 앱으로 돌아오면 다시 읽기 (그 사이 웹에서 바꾼 내용 반영)
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'visible' && ref.current.mode === 'server') load().catch(() => undefined); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [load]);

  useEffect(() => {
    setAuthLostHandler(() => {
      dispatch({ type: 'logout' });
      dispatch({ type: 'toast', msg: '로그인이 풀렸어요. 다시 로그인해 주세요.' });
    });
    return () => setAuthLostHandler(null);
  }, []);

  const act = useMemo<Actions>(() => {
    const isServer = () => ref.current.mode === 'server';
    const groupOf = (id: string) => ref.current.groups.find((g) => g.id === id);
    const a: Actions = {
      async login(loginId, pw) {
        const res = await W.login(loginId, pw);
        try { localStorage.setItem(MODE_KEY, 'server'); } catch { /* 무시 */ }
        await load(memberOf(res.member));
      },
      startDemo() {
        try { localStorage.setItem(MODE_KEY, 'demo'); } catch { /* 무시 */ }
        dispatch({ type: 'demo' });
      },
      async logout() {
        if (isServer()) await W.logout().catch(() => undefined);
        try { localStorage.removeItem(MODE_KEY); } catch { /* 무시 */ }
        dispatch({ type: 'logout' });
      },
      async refresh() {
        if (isServer()) await load().catch(fail);
      },
      reorder(groupId, from, to) {
        dispatch({ type: 'reorder', groupId, from, to });
        if (!isServer()) return;
        const g = groupOf(groupId);
        if (!g?.surveyId) return;
        const ids = [...g.buildingIds];
        const [moved] = ids.splice(from, 1);
        ids.splice(to, 0, moved);
        const factorIds = ids.map((id) => ref.current.buildings[id]?.factorId).filter((x): x is number => x != null);
        W.saveOrder(g.surveyId, factorIds).catch((e) => { fail(e); load().catch(() => undefined); });
      },
      async remove(groupId, buildingId) {
        if (!isServer()) { dispatch({ type: 'removeFromGroup', groupId, buildingId }); return; }
        const g = groupOf(groupId), b = ref.current.buildings[buildingId];
        if (!g?.surveyId || b?.factorId == null) return;
        try {
          await W.removeItem(g.surveyId, b.factorId);
          await load();
        } catch (e) { fail(e); }
      },
      async replace(groupId, oldId, archiveId) {
        if (!isServer()) { dispatch({ type: 'replaceInGroup', groupId, oldId, archiveId }); return; }
        const g = groupOf(groupId), b = ref.current.buildings[oldId], a = ref.current.archive.find((x) => x.id === archiveId);
        if (!g?.surveyId || b?.factorId == null || a?.factorId == null) return;
        await W.replaceItem(g.surveyId, b.factorId, a.factorId);
        await load();
      },
      async saveRecord(rec, onPhoto) {
        const now = new Date();
        const savedAt = `${now.getMonth() + 1}월 ${now.getDate()}일 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        const author = ref.current.member?.name ?? '';
        if (!isServer()) {
          dispatch({ type: 'saveRecord', record: { ...rec, savedAt, author } });
          return { failedPhotos: 0 };
        }
        const b = ref.current.buildings[rec.buildingId];
        const { recordId, failedPhotos } = await W.saveRecord(b, rec, onPhoto);
        dispatch({ type: 'saveRecord', record: { ...rec, recordId, savedAt, author, fromWeb: false } });
        await load().catch(() => undefined);
        // 서버에 저장된 사진 번호까지 다시 읽기
        await a.loadBuilding(rec.buildingId).catch(() => undefined);
        return { failedPhotos };
      },
      async loadBuilding(buildingId) {
        if (!isServer()) return;
        const d = await W.fetchBuilding(buildingId);
        const cur = ref.current.buildings[buildingId];
        const b = W.applyDetail(cur ?? W.buildingFromItem({
          planId: d.planId, surveyId: 0, factorId: 0, bldId: buildingId, visitOrder: null, addr: d.building.addr, bldNm: d.building.bldNm,
          useNm: d.building.useNm, emdNm: '', sggCd: d.building.sggCd, useaprDay: d.building.useaprDay, grndFlr: d.building.grndFlr,
          ugrndFlr: d.building.ugrndFlr, lat: 0, lng: 0, score: d.building.score, factorText: null, checkedAt: null, checkResult: null, checked: d.records.length > 0,
        }), d);
        dispatch({ type: 'patchBuilding', building: b });
        if (d.records.length) dispatch({ type: 'setRecord', record: W.recordFromServer(buildingId, d.records[0], b) });
      },
      toast(msg) {
        dispatch({ type: 'toast', msg });
      },
    };
    return a;
  }, [load, fail]);

  const value = useMemo(() => ({ state, dispatch, act }), [state, act]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppStoreProvider 밖에서 useStore를 썼어요');
  return v;
}

export function useGroup(groupId: string | undefined) {
  const { state } = useStore();
  const group: Group | undefined = state.groups.find((g) => g.id === groupId) ?? state.groups[0];
  const buildings = (group?.buildingIds ?? []).map((id) => state.buildings[id]).filter(Boolean);
  return { group, buildings };
}
