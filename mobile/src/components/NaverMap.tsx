// 네이버 지도 (웹 WellFAIR 와 같은 키 · 같은 SDK). 키는 서버 app.properties → api/mobile/config.do 로 받아요.
// 네이버 클라우드 콘솔 Web 서비스 URL 에 앱 주소를 등록해야 지도가 떠요 (README 참고).
// 키가 없거나 SDK 를 못 불러오면 fallback(도식 지도)을 그대로 보여 줘요.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { walkPath, type WalkPathTO } from '../api/wellfair';
import './NaverMap.css';

declare global {
  interface Window { naver?: any; navermap_authFailure?: () => void }
}

let loader: Promise<any> | null = null;
function loadNaver(clientId: string): Promise<any> {
  if (window.naver?.maps) return Promise.resolve(window.naver);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    s.async = true;
    s.onload = () => (window.naver?.maps ? resolve(window.naver) : reject(new Error('naver')));
    s.onerror = () => reject(new Error('naver'));
    window.navermap_authFailure = () => reject(new Error('auth'));
    document.head.appendChild(s);
  }).catch((e) => { loader = null; throw e; });
  return loader;
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
    return () => { alive = false; };
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
      overlays.current.push(new naver.maps.Polyline({ map: m, path: p, strokeColor: '#0B0B0C', strokeWeight: 9, strokeOpacity: 0.9, strokeLineCap: 'round', strokeLineJoin: 'round' }));
      overlays.current.push(new naver.maps.Polyline({ map: m, path: p, strokeColor: '#448EDE', strokeWeight: 5, strokeLineCap: 'round', strokeLineJoin: 'round' }));
    }
    for (const s of stops) {
      const kind = s.id === selectedId ? 'sel' : s.kind ?? 'plain';
      const inner = kind === 'done' ? '✓' : kind === 'start' ? '출발' : String(s.num ?? '');
      const label = kind === 'sel' && s.label ? `<span class="nvpin__label">${escapeHtml(s.label)}</span>` : '';
      overlays.current.push(new naver.maps.Marker({
        map: m, position: LL(s.lat, s.lng), zIndex: kind === 'sel' ? 100 : 10,
        icon: { content: `<div class="nvpin nvpin--${kind}">${kind === 'sel' ? '<span class="nvpin__halo"></span>' : ''}<span class="nvpin__dot">${inner}</span>${label}</div>`, anchor: new naver.maps.Point(16, 16) },
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
  return <div ref={el} className={`nvmap ${className}`} />;
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
