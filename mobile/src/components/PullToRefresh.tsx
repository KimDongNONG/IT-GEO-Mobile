// 당겨서 새로고침 : 화면 맨 위에서 아래로 끌어내리면 위에서 동그란 표시가 내려오고,
// 일정 거리 이상 당겼다 놓으면 데이터를 다시 읽는다 (웹뷰는 overscroll-behavior: none 이라 직접 구현)
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/AppStore';
import { runPullRefresh } from '../lib/pullRefresh';
import './PullToRefresh.css';

const THRESHOLD = 72;   // 이만큼(표시 기준) 당기면 새로고침
const MAX_PULL = 120;   // 표시가 내려오는 최대 거리
const REST = 64;        // 새로고침하는 동안 표시가 머무는 위치
const MIN_SPIN = 600;   // 너무 빨리 끝나도 돌아가는 모습은 잠깐 보여 줌

/** 이 요소 안에서 시작한 터치는 당겨서 새로고침으로 보지 않는다 */
function blocked(target: EventTarget | null): boolean {
  // 팝업이 떠 있으면 막음
  if (document.querySelector('.modal')) return true;
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    // 지도 화면 · 직접 막은 곳
    if (el.matches('.nav, .nmap, [data-no-ptr]')) return true;
    const cs = getComputedStyle(el);
    // 끌기 손잡이(순서 바꾸기 · 카드 손잡이) 와 떠 있는 패널 · 탭바
    if (cs.touchAction === 'none' || cs.position === 'fixed') return true;
    // 안쪽 스크롤 영역이 이미 내려가 있으면 그 영역 스크롤이 먼저
    if (el.scrollTop > 0 && /(auto|scroll)/.test(cs.overflowY)) return true;
  }
  return false;
}

export default function PullToRefresh() {
  const { act } = useStore();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const st = useRef({ y0: 0, x0: 0, active: false, decided: false, pull: 0, busy: false });
  const actRef = useRef(act);
  actRef.current = act;

  useEffect(() => {
    const s = st.current;

    const onStart = (e: TouchEvent) => {
      s.active = false;
      if (s.busy || e.touches.length !== 1 || window.scrollY > 0 || blocked(e.target)) return;
      s.active = true;
      s.decided = false;
      s.y0 = e.touches[0].clientY;
      s.x0 = e.touches[0].clientX;
      s.pull = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!s.active) return;
      const dy = e.touches[0].clientY - s.y0;
      const dx = e.touches[0].clientX - s.x0;
      if (!s.decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        // 가로로 밀거나 위로 올리면 일반 스크롤 · 스와이프로 넘김
        if (Math.abs(dx) > Math.abs(dy) || dy < 0 || window.scrollY > 0) { s.active = false; return; }
        s.decided = true;
        setDragging(true);
      }
      // 끌수록 덜 따라오게 (고무줄 느낌)
      const p = dy <= 0 ? 0 : Math.min(MAX_PULL, dy * 0.5);
      s.pull = p;
      setPull(p);
      if (e.cancelable) e.preventDefault();   // 당기는 동안 페이지가 같이 움직이지 않게
    };

    const onEnd = () => {
      if (!s.active) return;
      s.active = false;
      setDragging(false);
      if (!s.decided) return;
      if (s.pull < THRESHOLD) { setPull(0); return; }

      s.busy = true;
      setBusy(true);
      setPull(REST);
      const started = Date.now();
      Promise.allSettled([actRef.current.refresh(), runPullRefresh()]).then(() => {
        const wait = Math.max(0, MIN_SPIN - (Date.now() - started));
        setTimeout(() => {
          s.busy = false;
          setBusy(false);
          setPull(0);
        }, wait);
      });
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const progress = Math.min(1, pull / THRESHOLD);
  const ready = pull >= THRESHOLD;

  return (
    <div
      className={`ptr ${dragging ? 'is-dragging' : ''} ${busy ? 'is-busy' : ''} ${ready ? 'is-ready' : ''}`}
      style={{ transform: `translate(-50%, ${pull - 48}px)`, opacity: pull > 0 ? Math.max(0.3, progress) : 0 }}
      role="status"
      aria-live="polite"
      aria-label={busy ? '새로고침 중' : undefined}
    >
      <svg className="ptr__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden
        style={busy ? undefined : { transform: `rotate(${progress * 270}deg)` }}>
        {busy ? (
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="34 50" />
        ) : (
          <>
            <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M20 4v4.5h-4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </div>
  );
}
