// 긴급신고 : 모든 화면 오른쪽 위에 떠 있는 SOS 버튼 (App.tsx 에서 한 번만 그림)
//   누르면 신고 창이 열리고, 그와 동시에 GPS 로 지금 위치(경위도)를 잡아 주소로 바꾼다 (네이버 역지오코딩)
//   - 119 전화 : tel:119 → 폰의 전화 화면이 119 가 입력된 채로 열린다 (통화 버튼은 본인이 누름)
//   - 위치 문자 : sms:119 → 문자 앱이 받는 사람 119 · 주소 · 경위도가 채워진 채로 열린다 (보내기는 본인이 누름)
//   앱(웹뷰)은 문자를 직접 보낼 수 없어서 문자 앱을 여는 방식. 잘못 누른 신고를 막는 확인 단계도 겸한다
import { useCallback, useEffect, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { useStore } from '../store/AppStore';
import { reverseGeocode } from './NaverMap';
import './Emergency.css';

const CALL_NO = '119';

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
      <button className="sos" onClick={() => setOpen(true)} aria-label="긴급신고">SOS</button>

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
