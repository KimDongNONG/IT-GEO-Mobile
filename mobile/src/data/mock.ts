// 로그인 화면의 '시연 모드'에서 쓰는 데이터 (Figma 화면의 값 그대로)
import type { ArchiveItem, Building, FieldRecord, Group } from './types';

export const BUILDINGS: Building[] = [
  {
    id: 'b-12-34', gu: '구로구', dong: '가리봉동 12-34', type: '다세대주택', floors: '지상 3층 / 지하 1층',
    factors: ['지하층', '노후', '침수'], status: 'done', score: 100, households: '6가구',
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

export const RECORDS: FieldRecord[] = [
  {
    buildingId: 'b-12-34',
    scores: { around: 1, flood: 4, exit: 2, clean: 1, mold: 4 },
    resident: '주의',
    supports: ['집 수리', '돌봄 연계'],
    memo: '반지하 창문 있음 · 옥탑 증축 없음 · 고시원 간판 없음 · 침수 흔적 있음 · 우편함 8개',
    photos: [],
    factorChecks: { '지하층': true, '침수 흔적 구역': true, '노후': true, '에너지 급감': null },
    savedAt: '11월 4일 10:20',
    author: '김구로',
  },
];
