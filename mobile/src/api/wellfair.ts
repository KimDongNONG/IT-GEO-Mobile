// 서버 응답(스프링 TO) 타입과, 앱 화면 모델(data/types.ts)로 바꾸는 함수
import type { ArchiveItem, Building, FieldRecord, Group, ResidentStatus } from '../data/types';
import { api, postForm, postJson } from './client';

// ---------- 서버 타입 (필요한 칸만) ----------
export interface MemberTO { userId: number; loginId: string; sggCd: string | null; userNm: string | null; deptNm: string | null; rankNm: string | null; guName: string }
export interface FieldItemTO {
  planId: number | null; surveyId: number; factorId: number; bldId: string; visitOrder: number | null;
  addr: string; bldNm: string | null; useNm: string | null; emdNm: string; sggCd: string; useaprDay: string | null;
  grndFlr: number | null; ugrndFlr: number | null; lat: number; lng: number;
  score: number; factorText: string | null; checkedAt: string | null; checkResult: string | null; checked: boolean;
}
export interface FieldListTO { surveyId: number; title: string; createdAt: string; updatedAt: string | null; itemCnt: number; doneCnt: number; sggCd: string | null; moveMode: string; items: FieldItemTO[] }
export interface ArchiveRowTO {
  factorId: number; bldId: string; sggCd: string; emdNm: string; addr: string; bldNm: string | null; useNm: string | null;
  lat: number; lng: number; score: number; factorText: string | null; status: 'TODO' | 'DOING' | 'DONE'; surveyId: number | null; surveyTitle: string | null;
}
interface BuildingTO {
  bldId: string; sggCd: string; addr: string; bldNm: string | null; useNm: string | null; grndFlr: number | null; ugrndFlr: number | null;
  useaprDay: string | null; violYn: string | null; units: number | null; spNm: string | null; elevM: number; floodCnt: number; floodDepth: number;
  pricePct: number | null; bldAge: number | null; score: number;
  ptUgrnd: number; ptGosiwon: number; ptRooftop: number; ptViol: number; ptOld: number; ptFlood: number; ptLow: number; ptCheap: number;
}
interface PhotoTO { photoId: number; label: string | null }
export interface RecordTO {
  recordId: number; visitedAt: string; result: string; userNm: string | null; content: string; scoreAdj: number | null;
  checks: Record<string, 'Y' | 'N' | '?'>; added: string[]; source: string | null; residentStatus: string | null;
  scores: Record<string, number>; supports: string[]; photos: PhotoTO[];
}
export interface ArchiveDetailTO {
  building: BuildingTO; residents: { hhCnt: number; mbrCnt: number; summary: string } | null; planId: number | null; records: RecordTO[];
}
export interface WalkPathTO { mode: string; totalDistance: number; totalTime: number; legs: { distance: number; time: number }[]; path: [number, number][] }
export interface ConfigTO { naverClientId: string; factorLabels: Record<string, string> }

// ---------- 공통 값 (서버와 같은 키) ----------
/** ArchiveService.FACTOR_LABELS */
export const FACTOR_LABELS: Record<string, string> = { ugrnd: '지하층', gosiwon: '고시원', rooftop: '옥탑', viol: '위반건축물', old: '노후', flood: '침수', low: '저지대', cheap: '저가' };
const FACTOR_KEY_BY_LABEL = Object.fromEntries(Object.entries(FACTOR_LABELS).map(([k, v]) => [v, k]));
export const GU_NAME: Record<string, string> = { '11530': '구로구', '11470': '양천구', '11560': '영등포구' };
/** 출발점 = 구청 (FieldService.guOffice 와 같은 좌표) */
export function guOffice(sggCd?: string | null) {
  if (sggCd === '11470') return { name: '양천구청', lat: 37.517, lng: 126.8664 };
  if (sggCd === '11560') return { name: '영등포구청', lat: 37.5264, lng: 126.8962 };
  return { name: '구로구청', lat: 37.4954, lng: 126.8874 };
}

// ---------- API ----------
export const login = (loginId: string, pw: string) => postForm<{ ok: true; member: MemberTO }>('api/mobile/login.do', { loginId, pw });
export const logout = () => postForm('api/mobile/logout.do', {});
export const me = () => api<MemberTO>('api/mobile/me.do');
export const config = () => api<ConfigTO>('api/mobile/config.do');
export const fetchGroups = () => api<FieldListTO[]>('api/mobile/groups.do');
export const fetchArchive = () => api<ArchiveRowTO[]>('api/mobile/archive.do');
export const fetchBuilding = (bldId: string) => api<ArchiveDetailTO>(`api/mobile/building.do?bldId=${encodeURIComponent(bldId)}`);
export const saveOrder = (surveyId: number, factorIds: number[]) => postForm('api/mobile/group/order.do', { surveyId, factorIds });
export const removeItem = (surveyId: number, factorId: number) => postForm('api/mobile/group/remove.do', { surveyId, factorId });
export const replaceItem = (surveyId: number, oldFactorId: number, newFactorId: number) =>
  postForm('api/mobile/group/replace.do', { surveyId, oldFactorId, newFactorId });
export const walkPath = (pts: { lat: number; lng: number }[], mode: 'walk' | 'car' = 'walk') =>
  postForm<WalkPathTO>('api/field/walk.do', { lngs: pts.map((p) => p.lng), lats: pts.map((p) => p.lat), mode });
export const photoPath = (photoId: number) => `api/mobile/photo.do?photoId=${photoId}`;

/** 현장 기록 저장 → 사진은 한 장씩 따로 올린다 (JSON, 서버 폼 크기 제한 회피) */
export async function saveRecord(b: Building, rec: FieldRecord, onPhoto?: (done: number, total: number) => void) {
  const chk: Record<string, string> = {};
  for (const f of b.factorEvidence) {
    const v = rec.factorChecks[f.name];
    const key = f.key ?? FACTOR_KEY_BY_LABEL[f.name];
    if (key) chk[`chk_${key}`] = v === true ? 'Y' : v === false ? 'N' : '?';
  }
  const score: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec.scores)) score[`score_${k}`] = v;
  const warn = Object.values(rec.scores).filter((v) => v >= 4).length;
  const res = await postForm<{ ok: true; recordId: number }>('api/mobile/record.do', {
    bldId: b.id,
    result: rec.resident === '부재' ? 'ABSENT' : 'MET',
    content: rec.memo.trim() || undefined,
    scoreAdj: warn,
    resident: rec.resident,
    supports: rec.supports,
    ...chk,
    ...score,
  });
  let failed = 0;
  for (let i = 0; i < rec.photos.length; i++) {
    try {
      await postJson('api/mobile/photo/upload.do', { recordId: res.recordId, label: `현장 사진 ${i + 1}`, data: rec.photos[i] });
    } catch {
      failed++;
    }
    onPhoto?.(i + 1, rec.photos.length);
  }
  return { recordId: res.recordId, failedPhotos: failed };
}

// ---------- 화면 모델로 바꾸기 ----------
/** "서울특별시 구로구 가리봉동 12-34" → "가리봉동 12-34" (FieldItemTO.Common.shortAddr) */
export const shortAddr = (addr?: string | null) => (addr ?? '').replace(/^서울특별시\s+/, '').replace(/^\S+구\s+/, '');
const floorsText = (g?: number | null, u?: number | null) =>
  [g ? `지상 ${g}층` : '', u && u > 0 ? `지하 ${u}층` : ''].filter(Boolean).join(' / ') || '-';
function approvalText(d?: string | null) {
  if (!d || d.length !== 8) return '-';
  const age = new Date().getFullYear() - Number(d.slice(0, 4));
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)} (${age}년)`;
}
const splitFactors = (t?: string | null) => (t ? t.split('·').map((s) => s.trim()).filter(Boolean) : []);

export function groupFromServer(f: FieldListTO): Group {
  const d = f.createdAt ? new Date(f.createdAt.replace(' ', 'T')) : null;
  return {
    id: String(f.surveyId),
    surveyId: f.surveyId,
    title: f.title,
    date: d && !isNaN(d.getTime()) ? `${d.getMonth() + 1}월 ${d.getDate()}일` : '',
    buildingIds: f.items.map((it) => it.bldId),
    sggCd: f.sggCd,
  };
}

export function buildingFromItem(it: FieldItemTO, prev?: Building): Building {
  const type = it.bldNm || it.useNm || '';
  const factors = splitFactors(it.factorText);
  return {
    ...(prev ?? {}),
    id: it.bldId,
    factorId: it.factorId,
    planId: it.planId,
    gu: GU_NAME[it.sggCd] ?? '',
    dong: shortAddr(it.addr),
    type,
    floors: floorsText(it.grndFlr, it.ugrndFlr),
    factors,
    status: it.checked ? 'done' : prev?.status === 'doing' ? 'doing' : 'before',
    score: it.score,
    households: prev?.households ?? '-',
    ledger: prev?.ledger ?? { use: it.useNm ?? '-', floors: floorsText(it.grndFlr, it.ugrndFlr), approval: approvalText(it.useaprDay), violation: '-', units: '-' },
    factorEvidence: prev?.factorEvidence ?? factors.map((name) => ({ name, key: FACTOR_KEY_BY_LABEL[name], evidence: '분석 근거: 보관함 분석 결과' })),
    pos: prev?.pos ?? { x: 0.5, y: 0.5 },
    lat: it.lat,
    lng: it.lng,
  };
}

/** 지도 SDK 없이 그릴 때 쓰는 0~1 위치 (그룹 안 건물 좌표를 상자에 맞춤) */
export function layoutPos(bs: Building[]) {
  const pts = bs.filter((b) => b.lat && b.lng);
  if (!pts.length) return {};
  const lats = pts.map((b) => b.lat!), lngs = pts.map((b) => b.lng!);
  const [a, b2, c, d] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const out: Record<string, { x: number; y: number }> = {};
  for (const b of pts) {
    out[b.id] = {
      x: d - c < 1e-6 ? 0.5 : 0.12 + ((b.lng! - c) / (d - c)) * 0.76,
      y: b2 - a < 1e-6 ? 0.5 : 0.15 + ((b2 - b.lat!) / (b2 - a)) * 0.7,
    };
  }
  return out;
}

/** building.do 상세로 대장 · 요인 근거 · 가구 채우기 */
export function applyDetail(b: Building, d: ArchiveDetailTO): Building {
  const t = d.building;
  const ev: { key: string; pt: number; evidence: string }[] = [
    { key: 'ugrnd', pt: t.ptUgrnd, evidence: `건축물대장 지하 ${t.ugrndFlr ?? 1}층` },
    { key: 'gosiwon', pt: t.ptGosiwon, evidence: t.spNm ? `${t.spNm}` : '건축물대장 주용도' },
    { key: 'rooftop', pt: t.ptRooftop, evidence: '옥탑 거주 가구 있음' },
    { key: 'viol', pt: t.ptViol, evidence: '건축물대장 위반건축물 표시' },
    { key: 'old', pt: t.ptOld, evidence: t.useaprDay ? `${t.useaprDay.slice(0, 4)}년 준공 (${t.bldAge ?? '-'}년)` : '준공 연도 기준' },
    { key: 'flood', pt: t.ptFlood, evidence: t.floodCnt ? `침수 흔적 ${t.floodCnt}회 · 최대 ${t.floodDepth}m` : '침수 흔적 구역' },
    { key: 'low', pt: t.ptLow, evidence: `표고 ${Math.round(t.elevM)}m` },
    { key: 'cheap', pt: t.ptCheap, evidence: t.pricePct != null ? `공시가격 하위 ${Math.round(t.pricePct)}%` : '공시가격 하위' },
  ];
  const hit = ev.filter((e) => e.pt > 0);
  const r = d.residents;
  return {
    ...b,
    type: b.type || t.bldNm || t.useNm || '',
    floors: floorsText(t.grndFlr, t.ugrndFlr),
    households: r && r.hhCnt ? `${r.hhCnt}가구${r.summary ? ` (${r.summary})` : ''}` : b.households,
    ledger: {
      use: t.useNm ?? '-',
      floors: floorsText(t.grndFlr, t.ugrndFlr),
      approval: approvalText(t.useaprDay),
      violation: t.violYn === 'Y' ? '있음' : t.violYn ? '없음' : '-',
      units: t.units != null ? `${t.units}세대` : '-',
    },
    factorEvidence: hit.length
      ? hit.map((e) => ({ name: FACTOR_LABELS[e.key], key: e.key, evidence: `분석 근거: ${e.evidence}` }))
      : b.factorEvidence,
    detailLoaded: true,
  };
}

export function recordFromServer(bldId: string, r: RecordTO, b?: Building): FieldRecord {
  const factorChecks: Record<string, boolean | null> = {};
  const keys = Object.keys(r.checks ?? {}).sort((a, b) => Object.keys(FACTOR_LABELS).indexOf(a) - Object.keys(FACTOR_LABELS).indexOf(b));
  for (const k of keys) { const v = r.checks[k]; factorChecks[FACTOR_LABELS[k] ?? k] = v === 'Y' ? true : v === 'N' ? false : null; }
  // 사전 탐지 요인 중 체크 안 한 것은 미확인으로
  b?.factorEvidence.forEach((f) => { if (!(f.name in factorChecks)) factorChecks[f.name] = null; });
  const d = new Date((r.visitedAt ?? '').replace(' ', 'T'));
  return {
    buildingId: bldId,
    recordId: r.recordId,
    scores: r.scores ?? {},
    resident: (r.residentStatus as ResidentStatus) ?? (r.result === 'ABSENT' ? '부재' : undefined),
    supports: r.supports ?? [],
    memo: r.content ?? '',
    photos: [],
    photoIds: (r.photos ?? []).map((p) => p.photoId),
    factorChecks,
    savedAt: isNaN(d.getTime()) ? r.visitedAt : `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`,
    author: r.userNm ?? '',
    fromWeb: r.source !== 'APP',
  };
}

export function archiveFromServer(a: ArchiveRowTO): ArchiveItem {
  const state: Record<ArchiveRowTO['status'], ArchiveItem['state']> = { TODO: 'new', DOING: 'doing', DONE: 'done' };
  return {
    id: String(a.factorId),
    factorId: a.factorId,
    bldId: a.bldId,
    name: `${shortAddr(a.addr)} ${a.bldNm || a.useNm || ''}`.trim(),
    state: state[a.status] ?? 'new',
    factors: splitFactors(a.factorText),
    score: a.score,
    groupId: a.surveyId != null ? String(a.surveyId) : undefined,
  };
}
