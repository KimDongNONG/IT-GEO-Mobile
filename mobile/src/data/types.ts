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
