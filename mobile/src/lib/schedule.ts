// 확인 탭 달력 : 날짜 계산 · 현장조사 상태 · 상태별 통계
// 상태는 서버가 아니라 여기서 정한다. "오늘"과 "다음 방문"은 폰의 현재 시각에 따라 바뀌기 때문.
import type { ScheduleItem, VisitStatus } from '../data/types';

const pad = (n: number) => String(n).padStart(2, '0');
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/** Date → yyyy-MM-dd (폰의 지역 시간 기준) */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** 11.19 목 */
export const shortDate = (s: string) => {
  const d = fromYmd(s);
  return `${d.getMonth() + 1}.${pad(d.getDate())} ${WEEK[d.getDay()]}`;
};
export const nowHm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const WEEKDAYS = WEEK;

/** 월간 달력 칸 : 그 달 1일이 있는 주의 일요일부터 6주(42칸). 서버 조회 범위도 이것 (end 는 미포함) */
export function monthGrid(year: number, month0: number) {
  const first = new Date(year, month0, 1);
  const start = addDays(first, -first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return { key: `${year}-${pad(month0 + 1)}`, start: ymd(days[0]), end: ymd(addDays(days[41], 1)), days };
}

/** 그날 기록이 있는 항목의 상태 */
function recordedStatus(it: ScheduleItem): VisitStatus {
  if (it.result === 'ABSENT') return '부재';
  if (it.result === 'REFUSED' || it.result === 'OTHER') return '종료';
  return it.supports.length ? '자원 연결' : '완료';
}

export interface DayRow { item: ScheduleItem; status: VisitStatus; seq: number }

/**
 * 하루 일정 : 시간대 순으로 줄을 세우고 상태를 붙인다.
 *  - 그날 기록이 있으면 방문 시각 순 (완료 · 자원 연결 · 부재 · 종료)
 *  - 기록이 없으면 그 뒤에 리스트 · 방문 순서대로
 *      지난 날짜 → 종료 (방문하지 못하고 지나감)
 *      오늘 첫 번째 → 다음
 *      직전 방문이 부재였으면 → 재방문
 *      나머지 → 예정
 */
export function dayRows(items: ScheduleItem[], date: string, today: string): DayRow[] {
  const day = items.filter((it) => it.date === date);
  const done = day.filter((it) => it.recordId != null).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const todo = day
    .filter((it) => it.recordId == null)
    .sort((a, b) => a.title.localeCompare(b.title) || (a.order ?? 9999) - (b.order ?? 9999));
  let nextGiven = false;
  const rows: DayRow[] = done.map((item) => ({ item, status: recordedStatus(item), seq: 0 }));
  for (const item of todo) {
    let status: VisitStatus;
    if (date < today) status = '종료';
    else if (date === today && !nextGiven) { status = '다음'; nextGiven = true; }
    else if (item.prevResult === 'ABSENT') status = '재방문';
    else status = '예정';
    rows.push({ item, status, seq: 0 });
  }
  return rows.map((r, i) => ({ ...r, seq: i + 1 }));
}

/** 카드 우측 상단 통계 (완료 · 예정 · 부재 · 종료) 와 남은 건수 */
export function dayStats(rows: DayRow[]) {
  const c = { 완료: 0, 예정: 0, 부재: 0, 종료: 0 };
  for (const { status } of rows) {
    if (status === '완료' || status === '자원 연결') c.완료++;
    else if (status === '예정' || status === '다음' || status === '재방문') c.예정++;
    else c[status]++;
  }
  return { ...c, remaining: c.예정 };
}

/** 상태 → 뱃지 색 이름 (Calendar.css 의 .vst--*) */
export const STATUS_CLASS: Record<VisitStatus, string> = {
  완료: 'done', 예정: 'plan', 부재: 'absent', 종료: 'end', 재방문: 'revisit', '자원 연결': 'link', 다음: 'next',
};

// ---------- 홈 주간 일정 ----------
/** 그날이 들어 있는 주 (일요일 ~ 토요일). key 는 state.schedule 에 넣을 이름, end 는 미포함 */
export function weekOf(d: Date) {
  const start = addDays(d, -d.getDay());
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return { key: `week-${ymd(start)}`, start: ymd(start), end: ymd(addDays(start, 7)), days };
}

export interface DayList { groupId: string; title: string; items: ScheduleItem[] }

/** 하루 일정을 리스트별로 묶고, 리스트 안은 방문 순서대로 */
export function listsOfDay(items: ScheduleItem[]): DayList[] {
  const m = new Map<string, DayList>();
  for (const it of items) {
    if (!m.has(it.groupId)) m.set(it.groupId, { groupId: it.groupId, title: it.title, items: [] });
    m.get(it.groupId)!.items.push(it);
  }
  const lists = [...m.values()];
  for (const l of lists) l.items.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  return lists.sort((a, b) => a.title.localeCompare(b.title));
}
