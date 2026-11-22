export type WorkStatus = 'before' | 'doing' | 'done'; // 조사 전 · 조사 중 · 확인 완료

export const STATUS_LABEL: Record<WorkStatus, string> = {
  before: '조사 전',
  doing: '조사 중',
  done: '확인 완료',
};

export interface Ledger {
  use: string;        // 주용도
  floors: string;     // 층수
  approval: string;   // 사용승인
  violation: string;  // 위반건축물
  units: string;      // 세대수
}

export interface Building {
  id: string;
  dong: string;          // 가리봉동 12-34
  gu: string;            // 구로구
  type: string;          // 다세대주택
  floors: string;        // 지상 3층 / 지하 1층
  factors: string[];     // 사전 탐지 요인 칩
  status: WorkStatus;
  score: number;         // 취약도
  households: string;    // 4가구 (고령 1인 · 장애 1)
  ledger: Ledger;
  factorEvidence: { name: string; evidence: string; key?: string }[]; // 제출 확인에서 맞음/아님 고르는 요인 (key = 서버 요인 키)
  /** 도식 지도 위 위치 (0~1 비율). 실제 지도는 lat/lng */
  pos: { x: number; y: number };
  // 서버 연동 값
  lat?: number;
  lng?: number;
  factorId?: number;     // 리스트 순서 · 빼기 · 바꾸기에 쓰는 보관함 키
  checkedAt?: string;    // 확인 완료 시각 (yyyy-MM-dd HH:mm, 서버 FieldItemTO.checkedAt) : 확인 완료 탭의 날짜 묶음
  planId?: number | null;
  detailLoaded?: boolean;
}

export interface Group {
  id: string;
  title: string;
  date: string;          // 11월 4일
  buildingIds: string[]; // 방문 순서
  surveyId?: number;     // 서버 현장확인 리스트 ID
  sggCd?: string | null; // 리스트의 구 (출발점 = 구청)
  size?: number;         // 시연용: 상세가 없는 그룹의 건물 수
}

export type ArchiveState = 'new' | 'doing' | 'done' | 'inGroup';

export interface ArchiveItem {
  id: string;
  name: string;      // 가리봉동 31-5 고시원
  state: ArchiveState;
  factors: string[];
  score: number;
  factorId?: number;
  bldId?: string;
  groupId?: string;  // 담긴 현장확인 리스트
}

export type ResidentStatus = '양호' | '주의' | '긴급' | '부재';

export interface FieldRecord {
  buildingId: string;
  scores: Record<string, number>;   // 항목 키 → 1(양호) ~ 5(위험)
  resident?: ResidentStatus;
  supports: string[];
  memo: string;
  photos: string[];                 // data URL 또는 파일 경로
  factorChecks: Record<string, boolean | null>; // 요인 → 맞음(true) · 아님(false) · 미확인(null)
  savedAt?: string;
  author?: string;
  recordId?: number;
  photoIds?: number[];   // 서버에 저장된 사진 (api/mobile/photo.do)
  fromWeb?: boolean;     // 웹 05 화면에서 저장한 기록
}

// ---------- 확인 탭 달력 (api/mobile/schedule.do) ----------
/** 현장조사 상태. 오늘을 기준으로 lib/schedule.ts 의 visitStatus() 가 정한다 */
export type VisitStatus = '완료' | '예정' | '부재' | '종료' | '재방문' | '자원 연결' | '다음';

/** 달력 날짜에 넣은 현장확인 리스트 안의 건물 한 곳 */
export interface ScheduleItem {
  key: string;            // scheduleId-planId (같은 건물이 다른 날에도 있을 수 있음)
  scheduleId: number;
  date: string;           // yyyy-MM-dd
  groupId: string;        // 방문그룹(현장확인 리스트) id
  title: string;          // 리스트 이름
  bldId: string;
  order: number | null;   // 리스트 안 방문 순서
  place: string;          // 가리봉동 12-34 다세대주택
  score: number;
  recordId?: number;      // 그날 남긴 확인 기록
  time?: string;          // 그날 기록의 방문 시각 HH:mm
  result?: 'MET' | 'ABSENT' | 'REFUSED' | 'OTHER';
  supports: string[];     // 그날 기록의 필요한 지원
  prevResult?: string;    // 그날 이전 마지막 방문 결과
  // 홈 주간 일정 (api/mobile/schedule/day.do) 에서만 채움
  factorId?: number;      // 리스트 순서 · 빼기에 쓰는 보관함 키
  bldFactors?: string[];  // 건물 취약점 (지하층 · 노후 …)
  hhVulns?: string[];     // 가구 취약점 (75세 이상 3명 …)
}

/** 홈 리스트의 '이력' : 이 건물에 남긴 확인 기록 한 건 (웹 05 시설 상세의 기록 타임라인과 같은 데이터) */
export interface HistoryRow {
  id: string;
  at: string;             // 2026-11-19 14:10
  result: string;         // 만남 · 부재 · 거부 · 기타
  author: string;
  resident?: string;      // 양호 · 주의 · 긴급 · 부재
  supports: string[];
  memo: string;
  fromWeb: boolean;       // 웹에서 남긴 기록
}
