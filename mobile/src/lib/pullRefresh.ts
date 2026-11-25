// 당겨서 새로고침 : 화면마다 "새로고침할 때 다시 읽을 것"을 등록해 두는 곳
//   - 공통(리스트 · 보관함 다시 읽기)은 components/PullToRefresh.tsx 가 act.refresh() 로 처리
//   - 화면 고유 데이터(달력 일정, 건물 상세 등)는 각 화면에서 usePullRefresh(() => ...) 로 추가
import { useEffect, useRef } from 'react';

type Handler = () => unknown;
const handlers = new Set<{ current: Handler }>();

/** 등록된 화면별 새로고침을 모두 실행하고 끝날 때까지 기다린다 (하나가 실패해도 나머지는 계속) */
export function runPullRefresh(): Promise<unknown> {
  return Promise.allSettled([...handlers].map((h) => Promise.resolve().then(h.current)));
}

/** 이 화면이 떠 있는 동안, 당겨서 새로고침하면 fn 을 실행한다 */
export function usePullRefresh(fn: Handler) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = ref;
    handlers.add(h);
    return () => { handlers.delete(h); };
  }, []);
}
