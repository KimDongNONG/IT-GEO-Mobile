// M2-4 길찾기 (건물 하나) · M2-5 전체 경로 안내
// 서버 로그인 : 네이버 지도 + TMAP 경로 (웹 동선과 같은 api/field/walk.do), 출발점은 현재 위치 (못 받으면 이전 건물 · 구청)
// 시연 모드 : Figma 시안 값(390×772 기준)으로 그린 도식 지도
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Geolocation } from '@capacitor/geolocation';
import { useGroup, useStore } from '../store/AppStore';
import type { Building } from '../data/types';
import { guOffice } from '../api/wellfair';
import NaverMap, { useWalk, type MapStop } from '../components/NaverMap';
import { IconCheck16, IconLocate, IconPencil, IconRoute28, IconTurn } from '../components/icons';
import { TabBar } from '../components/ui';
import { routeSummary } from '../components/RouteMap';
import './Navigate.css';

const MW = 390, MH = 772;
const ROADS: [string, string, number][] = [
  ['M0 520L390 430', '#2A2B30', 18], ['M120 0L170 772', '#2A2B30', 14], ['M0 260L390 300', '#2A2B30', 12],
  ['M300 0L250 772', '#2A2B30', 10], ['M0 650L390 690', '#232428', 7], ['M60 0L40 772', '#232428', 7],
  ['M0 120L390 90', '#232428', 7], ['M200 0L215 772', '#202125', 5],
];
const LEG = 'M154 528L151 485L270 457L279 330';
const FULL = 'M154 528L151 485L270 457L279 330L283 289L210 282L137 274L132 180';
const HERE = { x: 154, y: 528 };
// 전체 경로 위 방문지 위치 (시안 기준: 1번은 이미 지나온 곳)
const STOPS = [{ x: 95, y: 498 }, { x: 279, y: 330 }, { x: 210, y: 282 }, { x: 132, y: 180 }];

const pct = (p: { x: number; y: number }) => ({ left: `${(p.x / MW) * 100}%`, top: `${(p.y / MH) * 100}%` });

function MapCanvas({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <div className="nmap">
      <svg viewBox={`0 0 ${MW} ${MH}`} preserveAspectRatio="xMidYMid slice" className="nmap__svg" aria-hidden>
        {ROADS.map(([d, c, w]) => <path key={d} d={d} stroke={c} strokeWidth={w} />)}
        <path d={path} stroke="#0B0B0C" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={path} stroke="#448EDE" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <div className="nmap__layer">
        {children}
        <span className="nmap__here" style={pct(HERE)}><i /></span>
      </div>
    </div>
  );
}

type LatLng = { lat: number; lng: number };

/** 현재 위치 (앱 권한이 없거나 실패하면 null). locate() 로 다시 받기 */
function useHere(enabled: boolean) {
  const [here, setHere] = useState<LatLng | null>(null);
  const locate = useCallback(() => {
    Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 })
      .then((p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }))
      .catch(() => undefined);
  }, []);
  useEffect(() => { if (enabled) locate(); }, [enabled, locate]);
  return { here, locate };
}

const at = (b: Building): LatLng => ({ lat: b.lat!, lng: b.lng! });
const fmtM = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`);
const fmtMin = (sec: number) => Math.max(1, Math.round(sec / 60));

function arrival(min: number) {
  const d = new Date(Date.now() + min * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function NavigateOne() {
  const { groupId, buildingId } = useParams();
  const { group, buildings } = useGroup(groupId);
  const { state } = useStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'walk' | 'car'>('walk');
  const idx = Math.max(0, buildings.findIndex((b) => b.id === buildingId));
  const b = buildings[idx];
  const real = state.mode === 'server' && !!state.naverClientId && !!b?.lat;
  const { here, locate } = useHere(state.mode === 'server');
  // 출발점 : 현재 위치 → 이전 건물 → 구청
  const prev = buildings[idx - 1];
  const start: LatLng | null = b?.lat ? here ?? (prev?.lat ? at(prev) : guOffice(group?.sggCd)) : null;
  const startName = here ? '현재 위치' : prev?.lat ? `${idx}. ${prev.dong}` : guOffice(group?.sggCd).name;
  const walkR = useWalk(start && b?.lat ? [start, at(b)] : null, 'walk');
  const carR = useWalk(start && b?.lat ? [start, at(b)] : null, 'car');
  const r = mode === 'walk' ? walkR : carR;
  const min = r ? fmtMin(r.totalTime) : mode === 'walk' ? 7 : 3;
  const dist = r ? fmtM(r.totalDistance) : '450m';
  if (!b || !group) return null;

  const pin = (
    <span className="npin npin--sel" style={pct(STOPS[1])}>
      <span className="npin__halo" />
      <span className="npin__dot">{idx + 1}</span>
      <span className="npin__label">{b.dong}</span>
    </span>
  );
  const demoMap = <MapCanvas path={LEG}>{pin}</MapCanvas>;

  return (
    <div className="nav">
      {real ? (
        <div className="nmap">
          <NaverMap
            clientId={state.naverClientId}
            stops={[{ id: b.id, lat: b.lat!, lng: b.lng!, num: idx + 1, kind: 'sel', label: b.dong }]}
            path={r?.path}
            here={here ?? start}
            padding={{ top: 170, right: 40, bottom: 330, left: 40 }}
            fallback={demoMap}
          />
        </div>
      ) : demoMap}

      <div className="nav__card card">
        <span className="nav__icon"><IconTurn /></span>
        <div>
          {real ? (
            <>
              <p className="nav__title">{b.dong}까지 {dist}</p>
              <p className="nav__sub">{startName}에서 출발 · TMAP {mode === 'walk' ? '보행자' : '자동차'} 경로</p>
            </>
          ) : (
            <>
              <p className="nav__title">120m 앞 우회전</p>
              <p className="nav__sub">가리봉로 방향 · 도착지까지 450m</p>
            </>
          )}
        </div>
      </div>

      <div className="nav__mode" role="tablist">
        <button className={mode === 'walk' ? 'is-on' : ''} onClick={() => setMode('walk')}>도보 {walkR ? fmtMin(walkR.totalTime) : 7}분</button>
        <button className={mode === 'car' ? 'is-on' : ''} onClick={() => setMode('car')}>차량 {carR ? fmtMin(carR.totalTime) : 3}분</button>
      </div>

      <button className="nav__locate" onClick={locate} aria-label="현재 위치로"><IconLocate /></button>

      <section className="nav__sheet">
        <span className="nav__grip" />
        <p className="nav__label">도착지</p>
        <p className="nav__dest"><span className="nav__num">{idx + 1}</span>{b.gu} {b.dong}</p>
        <p className="nav__eta">{mode === 'walk' ? '도보' : '차량'} {min}분 · {dist} · {arrival(min)} 도착 예정</p>
        <div className="nav__actions">
          <button className="btn btn--ghost" onClick={() => navigate(`/route/${group.id}?open=${b.id}`)}>안내 종료</button>
          <button className="btn btn--primary" onClick={() => navigate(`/record/${b.id}?group=${group.id}`)}>
            <IconPencil size={18} /> 현장 기록
          </button>
        </div>
      </section>
      <TabBar />
    </div>
  );
}

export function NavigateAll() {
  const { groupId } = useParams();
  const { group, buildings } = useGroup(groupId);
  const { state } = useStore();
  const navigate = useNavigate();
  const found = buildings.findIndex((b) => b.status !== 'done');
  const nextIdx = found < 0 ? Math.max(0, buildings.length - 1) : found;
  const next = buildings[nextIdx];
  const remain = buildings.slice(nextIdx);
  const real = state.mode === 'server' && !!state.naverClientId && remain.some((b) => b.lat);
  const { here, locate } = useHere(state.mode === 'server');
  const start = here ?? (buildings[nextIdx - 1]?.lat ? at(buildings[nextIdx - 1]) : guOffice(group?.sggCd));
  const walk = useWalk(real ? [start, ...remain.filter((b) => b.lat).map(at)] : null, 'walk');
  const demo = routeSummary(remain);
  const s = walk ? { km: walk.totalDistance / 1000, minutes: fmtMin(walk.totalTime) } : demo;
  const leg = walk?.legs[0];
  const legText = leg ? `${fmtM(leg.distance)} · 도보 ${fmtMin(leg.time)}분` : '450m · 도보 7분';
  const rest = remain.slice(1).map((_, i) => nextIdx + i + 2).join(' → ');
  if (!group) return null;

  const stops: MapStop[] = buildings.filter((b) => b.lat).map((b) => {
    const i = buildings.indexOf(b);
    return { id: b.id, lat: b.lat!, lng: b.lng!, num: i + 1, kind: i < nextIdx ? 'done' : i === nextIdx ? 'sel' : 'plain', label: b.dong };
  });

  return (
    <div className="nav">
      {real ? (
        <div className="nmap">
          <NaverMap
            clientId={state.naverClientId}
            stops={stops}
            path={walk?.path}
            here={start}
            padding={{ top: 170, right: 40, bottom: 360, left: 40 }}
            fallback={<MapCanvas path={FULL}>{null}</MapCanvas>}
          />
        </div>
      ) : <MapCanvas path={FULL}>
        {buildings.slice(0, 4).map((b, i) => {
          const p = pct(STOPS[i]);
          if (i < nextIdx) return <span key={b.id} className="npin npin--done" style={p}><IconCheck16 /></span>;
          if (i === nextIdx)
            return (
              <span key={b.id} className="npin npin--sel" style={p}>
                <span className="npin__halo" />
                <span className="npin__dot">{i + 1}</span>
                <span className="npin__label">{b.dong}</span>
              </span>
            );
          return <span key={b.id} className="npin" style={p}><span className="npin__dot">{i + 1}</span></span>;
        })}
      </MapCanvas>}

      <div className="nav__card card">
        <span className="nav__icon"><IconRoute28 /></span>
        <div>
          <p className="nav__title">다음 방문 · {nextIdx + 1}. {next?.dong}</p>
          <p className="nav__sub">{legText}{rest && ` · 이어서 ${rest} 순서로 안내해요`}</p>
        </div>
      </div>

      <button className="nav__locate nav__locate--full" onClick={locate} aria-label="현재 위치로"><IconLocate /></button>

      <section className="nav__sheet nav__sheet--full">
        <span className="nav__grip" />
        <div className="nav__sheet-head">
          <p className="nav__h">전체 경로 안내</p>
          <p className="nav__sum">남은 {remain.length}곳 · {s.km.toFixed(1)}km · 도보 {s.minutes}분</p>
        </div>
        <ol className="steps" style={{ ['--done' as string]: buildings.length > 1 ? nextIdx / (buildings.length - 1) : 0 }}>
          {buildings.map((b, i) => (
            <li key={b.id} className={i < nextIdx ? 'is-done' : i === nextIdx ? 'is-now' : ''}>
              <span className="steps__dot">{i < nextIdx ? <IconCheck16 /> : i + 1}</span>
              <span className="steps__name">{b.dong.replace(/^\S+\s/, '')}</span>
            </li>
          ))}
        </ol>
        <div className="nav__actions">
          <button className="btn btn--ghost" onClick={() => navigate(`/route/${group.id}`)}>안내 종료</button>
          <button className="btn btn--primary" onClick={() => next && navigate(`/record/${next.id}?group=${group.id}`)}>
            <IconPencil size={18} /> 현장 기록
          </button>
        </div>
      </section>
      <TabBar />
    </div>
  );
}
