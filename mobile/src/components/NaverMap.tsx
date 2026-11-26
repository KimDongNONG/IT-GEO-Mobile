// 네이버 지도 (웹 ItGEO 와 같은 키 · 같은 SDK). 키는 서버 app.properties → api/mobile/config.do 로 받아요.
// 네이버 클라우드 콘솔 Web 서비스 URL 에 앱 주소를 등록해야 지도가 떠요 (README 참고).
// 키가 없거나 SDK 를 못 불러오면 fallback(도식 지도)을 그대로 보여 줘요.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FIG } from './figma';
import { walkPath, type WalkPathTO } from '../api/itgeo';
import './NaverMap.css';

declare global {
  interface Window { naver?: any; navermap_authFailure?: () => void }
}

let loader: Promise<any> | null = null;
// 인증 실패(콘솔에 앱 주소 미등록 등)는 SDK 를 다 불러온 뒤에 따로 온다 → 지도를 도식 지도로 바꾸게 알림
let authFailed = false;
const authListeners = new Set<() => void>();
function loadNaver(clientId: string): Promise<any> {
  if (authFailed) return Promise.reject(new Error('auth'));
  if (window.naver?.maps) return Promise.resolve(window.naver);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    // submodules=geocoder : 긴급신고에서 현재 위치 → 주소 (reverseGeocode). 콘솔에서 Reverse Geocoding 을 켜야 주소가 나온다 (안 켜도 지도는 뜸)
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder`;
    s.async = true;
    s.onload = () => (window.naver?.maps ? resolve(window.naver) : reject(new Error('naver')));
    s.onerror = () => reject(new Error('naver'));
    window.navermap_authFailure = () => {
      authFailed = true;
      console.warn('[ItGEO] 네이버 지도 인증 실패: 네이버 클라우드 콘솔 Web 서비스 URL 에 지금 주소(' + location.origin + ')를 등록해 주세요.');
      authListeners.forEach((fn) => fn());
      reject(new Error('auth'));
    };
    document.head.appendChild(s);
  }).catch((e) => { loader = null; throw e; });
  return loader;
}

/** 경위도 → 주소 (도로명 우선, 없으면 지번). 키가 없거나 SDK · 역지오코딩을 못 쓰면 null */
export async function reverseGeocode(clientId: string | null | undefined, lat: number, lng: number): Promise<string | null> {
  if (!clientId) return null;
  try {
    const naver = await loadNaver(clientId);
    const svc = naver?.maps?.Service;
    if (!svc?.reverseGeocode) return null;
    return await new Promise<string | null>((resolve) => {
      const t = setTimeout(() => resolve(null), 5000);
      svc.reverseGeocode(
        { coords: new naver.maps.LatLng(lat, lng), orders: [svc.OrderType.ROAD_ADDR, svc.OrderType.ADDR].join(',') },
        (status: any, res: any) => {
          clearTimeout(t);
          if (status !== svc.Status.OK) { resolve(null); return; }
          const a = res?.v2?.address;
          resolve(a?.roadAddress || a?.jibunAddress || null);
        },
      );
    });
  } catch {
    return null;
  }
}

export interface MapStop {
  id: string;
  lat: number;
  lng: number;
  num?: number;
  kind?: 'plain' | 'fill' | 'sel' | 'done' | 'start';
  label?: string;
}

export default function NaverMap({
  clientId, stops, path, selectedId, here, fallback, className = '', padding = 40,
}: {
  clientId: string;
  stops: MapStop[];
  path?: [number, number][];
  selectedId?: string | null;
  here?: { lat: number; lng: number } | null;
  fallback: ReactNode;
  className?: string;
  padding?: number | { top: number; right: number; bottom: number; left: number };
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const overlays = useRef<any[]>([]);
  const [failed, setFailed] = useState(!clientId);

  useEffect(() => {
    if (!clientId) { setFailed(true); return; }
    let alive = true;
    loadNaver(clientId)
      .then((naver) => {
        if (!alive || !el.current || map.current) return;
        map.current = new naver.maps.Map(el.current, {
          zoom: 15, scaleControl: false, mapDataControl: false, logoControlOptions: { position: naver.maps.Position.BOTTOM_LEFT },
        });
        setFailed(false);
        draw();
      })
      .catch(() => alive && setFailed(true));
    const onAuthFail = () => { map.current = null; if (alive) setFailed(true); };
    authListeners.add(onAuthFail);
    return () => { alive = false; authListeners.delete(onAuthFail); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // 마커 · 경로 다시 그리기
  const draw = () => {
    const naver = window.naver;
    const m = map.current;
    if (!naver || !m) return;
    overlays.current.forEach((o) => o.setMap(null));
    overlays.current = [];
    const LL = (lat: number, lng: number) => new naver.maps.LatLng(lat, lng);

    if (path && path.length > 1) {
      const p = path.map(([lng, lat]) => LL(lat, lng));
      overlays.current.push(new naver.maps.Polyline({ map: m, path: p, strokeColor: '#FFFFFF', strokeWeight: 9, strokeOpacity: 0.9, strokeLineCap: 'round', strokeLineJoin: 'round' }));
      overlays.current.push(new naver.maps.Polyline({ map: m, path: p, strokeColor: '#1F4F9A', strokeWeight: 5, strokeLineCap: 'round', strokeLineJoin: 'round' }));
    }
    for (const s of stops) {
      const kind = s.id === selectedId ? 'sel' : s.kind ?? 'plain';
      const inner = kind === 'done' ? `<img src="${FIG.checkWhite16}" width="16" height="16" alt="" />` : kind === 'start' ? '출발' : String(s.num ?? '');
      const label = kind === 'sel' && s.label ? `<span class="nvpin__label">${escapeHtml(s.label)}</span>` : '';
      overlays.current.push(new naver.maps.Marker({
        map: m, position: LL(s.lat, s.lng), zIndex: kind === 'sel' ? 100 : 10,
        icon: { content: `<div class="nvpin nvpin--${kind}">${kind === 'sel' ? '<span class="nvpin__halo"></span>' : ''}<span class="nvpin__dot">${inner}</span>${label}</div>`, anchor: new naver.maps.Point(18, 18) },
      }));
    }
    if (here) {
      overlays.current.push(new naver.maps.Marker({
        map: m, position: LL(here.lat, here.lng), zIndex: 200,
        icon: { content: '<div class="nvhere"><i></i></div>', anchor: new naver.maps.Point(12, 12) },
      }));
    }

    const sel = stops.find((s) => s.id === selectedId);
    if (sel && !path) {
      m.setCenter(LL(sel.lat, sel.lng));
      m.setZoom(17);
      return;
    }
    const pts = [...(path ?? []).map(([lng, lat]) => ({ lat, lng })), ...stops, ...(here ? [here] : [])];
    if (!pts.length) return;
    const b = new naver.maps.LatLngBounds(LL(pts[0].lat, pts[0].lng), LL(pts[0].lat, pts[0].lng));
    pts.forEach((p) => b.extend(LL(p.lat, p.lng)));
    const pad = typeof padding === 'number' ? { top: padding, right: padding, bottom: padding, left: padding } : padding;
    m.fitBounds(b, pad);
    if (m.getZoom() > 17) m.setZoom(17);
  };

  useEffect(draw); // props 가 바뀔 때마다

  if (failed) return <>{fallback}</>;
  // 네이버 지도는 넘겨준 div 를 position: relative 로 바꾼다 → 위치 잡는 바깥 div 와 지도 div 를 나눠야 높이가 0 이 되지 않음
  return (
    <div className={`nvmap ${className}`}>
      <div ref={el} className="nvmap__canvas" />
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** TMAP 경로 (서버 api/field/walk.do, 웹 동선과 같은 API). 같은 좌표는 다시 부르지 않음 */
const walkCache = new Map<string, Promise<WalkPathTO>>();
export function useWalk(points: { lat: number; lng: number }[] | null, mode: 'walk' | 'car' = 'walk') {
  const [res, setRes] = useState<WalkPathTO | null>(null);
  const key = points && points.length > 1 ? `${mode}|${points.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(';')}` : '';
  useEffect(() => {
    if (!key || !points) { setRes(null); return; }
    let alive = true;
    let p = walkCache.get(key);
    if (!p) {
      p = walkPath(points, mode);
      walkCache.set(key, p);
      p.catch(() => walkCache.delete(key));
    }
    p.then((r) => alive && setRes(r)).catch(() => alive && setRes(null));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return res;
}
