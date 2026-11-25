// 로그인 화면의 '시연 모드'에서 쓰는 데이터 (Figma 화면의 값 그대로)
import type { ArchiveItem, Building, FieldRecord, Group, ScheduleItem } from './types';

// 확인 완료 시각 : 오늘을 기준으로 며칠 전 (시연 모드 확인 완료 탭이 늘 '최근' 으로 보이게)
const p2 = (n: number) => String(n).padStart(2, '0');
function agoAt(days: number, time: string) {
  const t = new Date(); const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - days);
  return { at: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${time}`, saved: `${d.getMonth() + 1}월 ${d.getDate()}일 ${time.replace(/^0/, '')}` };
}
const DONE_AT = {
  'b-12-34': agoAt(0, '10:20'), 'd-sinwol-45-6': agoAt(1, '16:40'), 'd-daerim-77-1': agoAt(1, '14:05'), 'd-guro-102-9': agoAt(1, '11:30'),
  'd-mok-602-3': agoAt(3, '15:10'), 'd-dorim-14-2': agoAt(6, '09:50'), 'd-gaebong-341-12': agoAt(9, '13:25'),
};

/** 확인 완료 탭에만 나오는 시연용 건물 (리스트에는 없음) */
function doneBld(id: keyof typeof DONE_AT, gu: string, dong: string, type: string, floors: string, factors: string[], score: number, households: string): Building {
  return {
    id, gu, dong, type, floors, factors, status: 'done', score, households, checkedAt: DONE_AT[id].at,
    ledger: { use: type, floors, approval: '-', violation: '없음', units: '-' },
    factorEvidence: factors.map((f) => ({ name: f, evidence: '분석 근거: 보관함 분석 결과' })),
    pos: { x: 0.5, y: 0.5 },
  };
}

export const BUILDINGS: Building[] = [
  {
    id: 'b-12-34', gu: '구로구', dong: '가리봉동 12-34', type: '다세대주택', floors: '지상 3층 / 지하 1층',
    factors: ['지하층', '노후', '침수'], status: 'done', score: 100, households: '6가구', checkedAt: DONE_AT['b-12-34'].at,
    ledger: { use: '다세대주택', floors: '지상 3층 / 지하 1층', approval: '1988.03.11 (38년)', violation: '없음', units: '6세대' },
    factorEvidence: [
      { name: '지하층 (반지하)', evidence: '분석 근거: 건축물대장 지하 1층' },
      { name: '노후', evidence: '분석 근거: 1988년 준공 (38년)' },
    ],
    pos: { x: 50 / 350, y: 155 / 220 },
  },
  {
    id: 'b-21-8', gu: '구로구', dong: '가리봉동 21-8', type: '연립주택', floors: '지상 2층 / 지하 1층',
    factors: ['지하층', '노후'], status: 'doing', score: 76, households: '4가구 (고령 1인 · 장애 1)',
    ledger: { use: '연립주택', floors: '지상 2층 / 지하 1층', approval: '1984.06.20 (42년)', violation: '없음', units: '6세대' },
    factorEvidence: [
      { name: '지하층 (반지하)', evidence: '분석 근거: 건축물대장 지하 1층' },
      { name: '노후', evidence: '분석 근거: 1984년 준공 (42년)' },
    ],
    pos: { x: 130 / 350, y: 90 / 220 },
  },
  {
    id: 'b-88-2', gu: '구로구', dong: '가리봉동 88-2', type: '고시원', floors: '지상 4층',
    factors: ['고시원', '노후', '침수'], status: 'before', score: 80, households: '12실',
    ledger: { use: '고시원', floors: '지상 4층', approval: '1991.09.02 (35년)', violation: '없음', units: '12실' },
    factorEvidence: [
      { name: '고시원', evidence: '분석 근거: 건축물대장 주용도' },
      { name: '노후', evidence: '분석 근거: 1991년 준공 (35년)' },
    ],
    pos: { x: 210 / 350, y: 142 / 220 },
  },
  {
    id: 'b-130', gu: '구로구', dong: '가리봉동 130', type: '다가구주택', floors: '지상 2층 / 지하 1층',
    factors: ['노후', '저지대'], status: 'before', score: 74, households: '3가구',
    ledger: { use: '다가구주택', floors: '지상 2층 / 지하 1층', approval: '1986.11.15 (40년)', violation: '없음', units: '3세대' },
    factorEvidence: [
      { name: '노후', evidence: '분석 근거: 1986년 준공 (40년)' },
      { name: '저지대', evidence: '분석 근거: 표고 12m 이하' },
    ],
    pos: { x: 290 / 350, y: 78 / 220 },
  },
  doneBld('d-sinwol-45-6', '양천구', '신월동 45-6', '고시원', '지상 3층', ['고시원', '노후'], 88, '9실'),
  doneBld('d-daerim-77-1', '영등포구', '대림동 77-1', '다가구주택', '지상 3층 / 지하 1층', ['지하층', '침수'], 84, '5가구'),
  doneBld('d-guro-102-9', '구로구', '구로동 102-9', '다세대주택', '지상 4층 / 지하 1층', ['지하층', '노후'], 79, '8가구'),
  doneBld('d-mok-602-3', '양천구', '목동 602-3', '연립주택', '지상 3층 / 지하 1층', ['지하층', '저지대'], 77, '6가구'),
  doneBld('d-dorim-14-2', '영등포구', '도림동 14-2', '다세대주택', '지상 3층', ['노후', '저가'], 72, '4가구'),
  doneBld('d-gaebong-341-12', '구로구', '개봉동 341-12', '연립주택', '지상 2층 / 지하 1층', ['지하층', '노후', '침수'], 80, '6가구'),
];

export const GROUPS: Group[] = [
  { id: 'g-garibong', title: '가리봉동 반지하 현장 확인', date: '11월 4일', buildingIds: ['b-12-34', 'b-21-8', 'b-88-2', 'b-130'] },
  { id: 'g-sinwol', title: '신월동 고시원 밀집 확인', date: '11월 5일', buildingIds: [], size: 5 },
  { id: 'g-daerim', title: '대림동 옥탑 증축 확인', date: '11월 6일', buildingIds: [], size: 4 },
];

export const ARCHIVE: ArchiveItem[] = [
  { id: 'b-12-34', name: '가리봉동 12-34 다세대주택', state: 'inGroup', factors: ['지하층', '노후', '침수', '저지대', '저가'], score: 100 },
  { id: 'a-31-5', name: '가리봉동 31-5 고시원', state: 'new', factors: ['고시원', '위반건축물', '침수', '저지대'], score: 90 },
  { id: 'a-guro-22-7', name: '구로동 22-7 다세대주택', state: 'new', factors: ['지하층', '노후', '침수', '저지대'], score: 90 },
  { id: 'a-guro-433-5', name: '구로동 433-5 연립주택', state: 'doing', factors: ['지하층', '노후', '저지대', '저가'], score: 88 },
  { id: 'a-gaebong-341-12', name: '개봉동 341-12 연립주택', state: 'done', factors: ['지하층', '노후', '침수', '저지대'], score: 80 },
  { id: 'b-88-2', name: '가리봉동 88-2 고시원', state: 'inGroup', factors: ['고시원', '노후', '침수', '저지대'], score: 80 },
  { id: 'a-sindorim-410-2', name: '신도림동 410-2 고시원', state: 'new', factors: ['고시원', '노후', '침수', '저지대'], score: 80 },
];
export const ARCHIVE_COUNTS = { all: 25, new: 16, doing: 6, done: 3 };

/** 시연용 현장 사진 (그림 대신 색 칸 + 이름) */
const demoPhoto = (label: string, c1: string, c2: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="640" height="480" fill="url(#g)"/><text x="320" y="255" font-size="44" font-family="sans-serif" fill="#fff" text-anchor="middle">시연 사진 · ${label}</text></svg>`);

export const RECORDS: FieldRecord[] = [
  {
    buildingId: 'b-12-34',
    scores: { around: 1, flood: 4, exit: 2, clean: 1, mold: 4 },
    resident: '주의',
    supports: ['집 수리', '돌봄 연계'],
    memo: '반지하 창문 있음 · 옥탑 증축 없음 · 고시원 간판 없음 · 침수 흔적 있음 · 우편함 8개',
    photos: [demoPhoto('외관', '#3a4a5e', '#1f2a36'), demoPhoto('반지하 창문', '#4a3f5e', '#241f36'), demoPhoto('우편함', '#3f5e4f', '#1f362b')],
    factorChecks: { '지하층': true, '침수 흔적 구역': true, '노후': true, '에너지 급감': null },
    savedAt: DONE_AT['b-12-34'].saved,
    author: '김구로',
  },
  doneRec('d-sinwol-45-6', { around: 2, flood: 1, exit: 4, clean: 3, mold: 2 }, '긴급', ['긴급복지', '안부 확인'], { '고시원': true, '노후': true }, '복도 비상구 앞 적치물. 1인 고령 거주 2실 확인'),
  doneRec('d-daerim-77-1', { around: 2, flood: 4, exit: 2, clean: 2, mold: 3 }, '주의', ['집 수리'], { '지하층': true, '침수': null }, '반지하 창문 물막이판 없음'),
  doneRec('d-guro-102-9', { around: 1, flood: 1, exit: 1, clean: 2, mold: 1 }, '양호', [], { '지하층': true, '노후': false }, '특이 사항 없음'),
  doneRec('d-mok-602-3', { around: 2, flood: 3, exit: 2, clean: 2, mold: 4 }, '주의', ['돌봄 연계'], { '지하층': true, '저지대': true }, '지하 1가구 곰팡이 심함'),
  doneRec('d-dorim-14-2', { around: 1, flood: 1, exit: 2, clean: 1, mold: 1 }, '부재', [], { '노후': true, '저가': null }, '부재 · 안내문 부착'),
  doneRec('d-gaebong-341-12', { around: 3, flood: 4, exit: 3, clean: 2, mold: 3 }, '주의', ['주거 이전', '의료'], { '지하층': true, '노후': true, '침수': true }, '침수 흔적 있음 · 거동 불편 1명'),
];

function doneRec(id: keyof typeof DONE_AT, scores: Record<string, number>, resident: FieldRecord['resident'], supports: string[], factorChecks: Record<string, boolean | null>, memo: string): FieldRecord {
  return { buildingId: id, scores, resident, supports, memo, photos: [], factorChecks, savedAt: DONE_AT[id].saved, author: '김구로' };
}

// ---------- 확인 탭 달력 (시연 모드) : 오늘을 기준으로 앞뒤 날짜에 일정을 만든다 ----------
const d2 = (n: number) => String(n).padStart(2, '0');
function dayOf(today: Date, diff: number) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff);
  return `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}`;
}
type Seed = [diff: number, group: string, title: string, bldId: string, place: string, score: number,
  rec?: { time: string; result: NonNullable<ScheduleItem['result']>; supports?: string[] }, prev?: string];
const SEEDS: Seed[] = [
  // 오늘 : 완료 · 부재 · 다음 · 재방문
  [0, 'g-garibong', '가리봉동 반지하 현장 확인', 'b-12-34', '가리봉동 12-34 다세대주택', 100, { time: '10:00', result: 'MET' }],
  [0, 'g-garibong', '가리봉동 반지하 현장 확인', 'b-21-8', '가리봉동 21-8 연립주택', 76, { time: '11:00', result: 'ABSENT' }],
  [0, 'g-garibong', '가리봉동 반지하 현장 확인', 'b-88-2', '가리봉동 88-2 고시원', 80],
  [0, 'g-garibong', '가리봉동 반지하 현장 확인', 'b-130', '가리봉동 130 다가구주택', 74, undefined, 'ABSENT'],
  // 지난 날짜 : 자원 연결 · 종료(거부) · 종료(방문 못 함)
  [-2, 'g-sinwol', '신월동 고시원 밀집 확인', 'a-31-5', '가리봉동 31-5 고시원', 90, { time: '14:10', result: 'MET', supports: ['긴급복지', '돌봄 연계'] }],
  [-2, 'g-sinwol', '신월동 고시원 밀집 확인', 'a-guro-22-7', '구로동 22-7 다세대주택', 90, { time: '15:00', result: 'REFUSED' }],
  [-2, 'g-sinwol', '신월동 고시원 밀집 확인', 'a-guro-433-5', '구로동 433-5 연립주택', 88],
  // 앞으로 : 예정 · 재방문
  [2, 'g-daerim', '대림동 옥탑 증축 확인', 'a-gaebong-341-12', '개봉동 341-12 연립주택', 80],
  [2, 'g-daerim', '대림동 옥탑 증축 확인', 'a-sindorim-410-2', '신도림동 410-2 고시원', 80],
  [5, 'g-garibong', '가리봉동 반지하 현장 확인', 'b-21-8', '가리봉동 21-8 연립주택', 76, undefined, 'ABSENT'],
];
export function demoSchedule(today = new Date()): ScheduleItem[] {
  return SEEDS.map(([diff, groupId, title, bldId, place, score, rec, prev], i) => ({
    key: `demo-${i}`, scheduleId: 1000 + diff, date: dayOf(today, diff), groupId, title, bldId, order: i + 1, place, score,
    recordId: rec ? 9000 + i : undefined, time: rec?.time, result: rec?.result, supports: rec?.supports ?? [], prevResult: prev,
  }));
}
export const DEMO_HH: Record<string, string[]> = {
  'b-12-34': ['75세 이상 2명', '지하 거주 2가구', '건보료 체납 1가구', '사회적고립 1가구'],
  'b-21-8': ['75세 이상 1명', '심한 장애 1명'],
  'b-88-2': ['사회적고립 4가구', '고위험고립 2가구', '차상위·기초생활 3가구', '건보료 체납 2가구', '사각지대 1가구'],
  'b-130': ['독박돌봄 1가구'],
  'a-31-5': ['고위험고립 2가구', '사회적고립 3가구'],
};
