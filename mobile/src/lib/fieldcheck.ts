// 현장 기록 · 확인 완료 · 확인 결과 화면이 같이 쓰는 값
import type { Building, FieldRecord } from '../data/types';

/** 건물 점검 항목 (현장 기록 화면의 섹션 카드와 같은 순서). 점수 1 양호 ~ 5 위험 */
export const SECTIONS = [
  { key: 'safety', title: '안전', items: [{ key: 'around', label: '건물 주변' }, { key: 'flood', label: '침수 흔적·배수' }, { key: 'exit', label: '비상 탈출로' }] },
  { key: 'hygiene', title: '위생', items: [{ key: 'clean', label: '내부 청결' }, { key: 'mold', label: '곰팡이·습기' }] },
];
export const SUPPORTS = ['집 수리', '주거 이전', '긴급복지', '돌봄 연계', '의료', '안부 확인'];
export const SCORE_LABEL: Record<number, string> = { 1: '양호', 2: '양호', 3: '보통', 4: '주의', 5: '위험' };

/** 필요한 지원 → 넘길 부서 (확인 완료 리스트의 부서 이관 칩) */
const DEPT_OF: Record<string, string> = {
  '집 수리': '주택과', '주거 이전': '주택과',
  '긴급복지': '복지과', '돌봄 연계': '복지과', '안부 확인': '복지과',
  '의료': '보건소',
};
export const DEPT_CLASS: Record<string, string> = { 주택과: 'is-house', 복지과: 'is-welfare', 보건소: 'is-health' };
export function deptsOf(rec?: FieldRecord): string[] {
  if (!rec) return [];
  return [...new Set(rec.supports.map((s) => DEPT_OF[s.trim()] ?? s.trim()).filter(Boolean))];
}

const d2 = (n: number) => String(n).padStart(2, '0');
export const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/** "2026-11-04 10:20" / "2026-11-04T10:20:00" → Date (없거나 틀리면 null) */
export function parseAt(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}
export const fmtAt = (d: Date) => `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())} ${d2(d.getHours())}:${d2(d.getMinutes())}`;
export const dayKey = (d: Date) => `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}`;
export const dayTitle = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
export const hm = (d: Date) => `${d2(d.getHours())}:${d2(d.getMinutes())}`;

/** 이번 주 (월요일 0시 ~ 다음 월요일 0시) 안인지 */
export function inThisWeek(d: Date, now = new Date()) {
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const next = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7);
  return d >= mon && d < next;
}

/** 확인 완료 시각 : 건물의 확인 시각(서버 checkedAt) → 없으면 기록 저장 시각 */
export function doneAt(b: Building, rec?: FieldRecord): Date | null {
  const a = parseAt(b.checkedAt);
  if (a) return a;
  // savedAt "11월 4일 10:20" (연도 없음 → 올해, 앞으로의 날짜면 작년)
  const m = rec?.savedAt?.match(/(\d+)월 (\d+)일 (\d+):(\d+)/);
  if (!m) return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), +m[1] - 1, +m[2], +m[3], +m[4]);
  if (d.getTime() > now.getTime() + 86400000) d.setFullYear(d.getFullYear() - 1);
  return d;
}
