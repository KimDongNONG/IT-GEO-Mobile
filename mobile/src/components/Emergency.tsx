// 긴급신고 : 모든 화면 오른쪽 위에 떠 있는 '!' 버튼 (App.tsx 에서 한 번만 그림)
//   꾸욱 누르면(0.4초) 손가락을 따라 옮길 수 있고, 놓은 자리는 기억한다
//   누르면 신고 창이 열리고, 그와 동시에 GPS 로 지금 위치(경위도)를 잡아 주소로 바꾼다 (네이버 역지오코딩)
//   - 119 전화 : tel:119 → 폰의 전화 화면이 119 가 입력된 채로 열린다 (통화 버튼은 본인이 누름)
//   - 위치 문자 : sms:119 → 문자 앱이 받는 사람 119 · 주소 · 경위도가 채워진 채로 열린다 (보내기는 본인이 누름)
//   앱(웹뷰)은 문자를 직접 보낼 수 없어서 문자 앱을 여는 방식. 잘못 누른 신고를 막는 확인 단계도 겸한다
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Geolocation } from '@capacitor/geolocation';
import { useStore } from '../store/AppStore';
import { reverseGeocode } from './NaverMap';
import './Emergency.css';

const CALL_NO = '119';
const HOLD_MS = 400;                       // 이만큼 누르고 있으면 옮기기 시작
const POS_KEY = 'itgeo.mobile.sosPos';     // 옮긴 자리 (화면 왼쪽 위 기준 px)
const EDGE = 4;

type Pos = { x: number; y: number };
interface Press { id: number; dx: number; dy: number; sx: number; sy: number; timer: number; drag: boolean; moved: boolean }

function loadPos(): Pos | null {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null');
    return p && typeof p.x === 'number' && typeof p.y === 'number' ? p : null;
  } catch { return null; }
}
/** 버튼이 화면 밖으로 나가지 않게 */
function clamp(p: Pos, size: number): Pos {
  return {
    x: Math.min(Math.max(EDGE, p.x), window.innerWidth - size - EDGE),
    y: Math.min(Math.max(EDGE, p.y), window.innerHeight - size - EDGE),
  };
}

type Loc =
  | { kind: 'loading' }
  | { kind: 'ok'; lat: number; lng: number; acc: number; addr: string | null }
  | { kind: 'fail' };

/** 받는 사람 + 본문이 채워진 문자 주소 (아이폰은 & , 안드로이드는 ? 로 본문을 붙인다) */
function smsHref(body: string) {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return `sms:${CALL_NO}${ios ? '&' : '?'}body=${encodeURIComponent(body)}`;
}

export default function Emergency() {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [loc, setLoc] = useState<Loc>({ kind: 'loading' });
  const [pos, setPos] = useState<Pos | null>(loadPos);
  const [dragging, setDragging] = useState(false);
  // 저장 완료 화면은 오른쪽 위에 X 가 있어서, 처음 자리(옮기지 않음)일 때만 X 아래로 비켜 준다
  const { pathname } = useLocation();
  const below = !pos && pathname.endsWith('/saved');
  const btn = useRef<HTMLButtonElement>(null);
  const press = useRef<Press | null>(null);
  const skipClick = useRef(false);

  // 화면 크기가 바뀌면(가로 · 세로 전환) 옮긴 자리를 화면 안으로
  useEffect(() => {
    const fit = () => setPos((p) => (p && btn.current ? clamp(p, btn.current.offsetWidth) : p));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p: Press = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, timer: 0, drag: false, moved: false };
    p.timer = window.setTimeout(() => { p.drag = true; setDragging(true); navigator.vibrate?.(15); }, HOLD_MS);
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = p;
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (!p.drag) {
      // 꾸욱 누르기 전에 손가락이 움직이면 옮기기도 신고도 아님
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 10) { p.moved = true; clearTimeout(p.timer); }
      return;
    }
    setPos(clamp({ x: e.clientX - p.dx, y: e.clientY - p.dy }, e.currentTarget.offsetWidth));
  };
  const onUp = () => {
    const p = press.current;
    if (!p) return;
    clearTimeout(p.timer);
    press.current = null;
    if (p.drag || p.moved) skipClick.current = true;   // 옮기고 놓은 손에 신고 창이 열리지 않게
    if (p.drag) {
      setDragging(false);
      setPos((cur) => { if (cur) { try { localStorage.setItem(POS_KEY, JSON.stringify(cur)); } catch { /* 무시 */ } } return cur; });
    }
  };
  const onClick = () => {
    if (skipClick.current) { skipClick.current = false; return; }
    setOpen(true);
  };

  const locate = useCallback(async () => {
    setLoc({ kind: 'loading' });
    try {
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
      const { latitude: lat, longitude: lng, accuracy } = p.coords;
      setLoc({ kind: 'ok', lat, lng, acc: Math.round(accuracy), addr: null });
      const addr = await reverseGeocode(state.naverClientId, lat, lng);
      if (addr) setLoc((cur) => (cur.kind === 'ok' && cur.lat === lat && cur.lng === lng ? { ...cur, addr } : cur));
    } catch {
      setLoc({ kind: 'fail' });
    }
  }, [state.naverClientId]);

  // 창을 여는 순간 위치를 잡기 시작한다
  useEffect(() => { if (open) locate(); }, [open, locate]);

  const who = state.member ? `${state.member.dept ? `${state.member.dept} ` : ''}${state.member.name}` : '';
  const body = [
    '[긴급신고] 현장조사 중 긴급상황입니다.',
    loc.kind === 'ok'
      ? `위치: ${loc.addr ?? '주소 확인 안 됨'}\n위도 ${loc.lat.toFixed(6)}, 경도 ${loc.lng.toFixed(6)} (오차 약 ${loc.acc}m)`
      : '위치: 확인하지 못함 (GPS 꺼짐 또는 권한 없음)',
    who && `신고자: ${who}`,
  ].filter(Boolean).join('\n');

  return (
    <>
      <button
        ref={btn}
        className={`sos ${below ? 'sos--below' : ''} ${dragging ? 'is-dragging' : ''}`}
        style={pos ? { left: pos.x, top: pos.y, right: 'auto' } : undefined}
        onClick={onClick}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="긴급신고 (꾸욱 눌러서 옮기기)"
      >!</button>

      {open && (
        <div className="sos-sheet" role="dialog" aria-modal="true" aria-labelledby="sosTitle">
          <div className="sos-sheet__dim" onClick={() => setOpen(false)} />
          <div className="sos-sheet__box">
            <h2 id="sosTitle" className="sos-sheet__title">긴급신고</h2>
            <p className="sos-sheet__desc">119 에 전화를 걸고, 지금 위치를 문자로 보낼 수 있어요.</p>

            <div className="sos-loc">
              <p className="sos-loc__label">지금 위치</p>
              {loc.kind === 'loading' && <p className="sos-loc__main">위치 확인 중…</p>}
              {loc.kind === 'ok' && (
                <>
                  <p className="sos-loc__main">{loc.addr ?? '주소를 찾는 중이거나 확인할 수 없어요'}</p>
                  <p className="sos-loc__sub">위도 {loc.lat.toFixed(6)} · 경도 {loc.lng.toFixed(6)} · 오차 약 {loc.acc}m</p>
                </>
              )}
              {loc.kind === 'fail' && (
                <>
                  <p className="sos-loc__main">위치를 가져오지 못했어요</p>
                  <p className="sos-loc__sub">폰의 위치(GPS)를 켜고 앱 위치 권한을 허용해 주세요.</p>
                  <button className="sos-loc__retry" onClick={locate}>다시 시도</button>
                </>
              )}
            </div>

            <a className="sos-btn sos-btn--call" href={`tel:${CALL_NO}`}>119 전화 걸기</a>
            <a className={`sos-btn sos-btn--sms ${loc.kind === 'loading' ? 'is-wait' : ''}`} href={smsHref(body)}
              aria-disabled={loc.kind === 'loading'} onClick={(e) => { if (loc.kind === 'loading') e.preventDefault(); }}>
              {loc.kind === 'loading' ? '위치 확인 후 문자 보내기…' : '119 에 위치 문자 보내기'}
            </a>
            <p className="sos-sheet__note">전화 화면 · 문자 앱이 열리면 통화 · 보내기를 눌러 주세요.</p>
            <button className="sos-btn sos-btn--close" onClick={() => setOpen(false)}>닫기</button>
          </div>
        </div>
      )}
    </>
  );
}
