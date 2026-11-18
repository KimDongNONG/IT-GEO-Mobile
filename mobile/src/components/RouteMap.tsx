// 방문 건물 위치 지도 (동선 화면 상단).
// 서버에 로그인하면 웹과 같은 네이버 지도 + TMAP 경로(구청 출발), 시연 모드나 지도 키가 없으면 Figma 시안과 같은 도식 지도.
import type { Building, Group } from '../data/types';
import { useStore } from '../store/AppStore';
import { guOffice } from '../api/wellfair';
import NaverMap, { useWalk } from './NaverMap';
import './RouteMap.css';

const W = 350;
const H = 220;
const M_PER_PX = 7;          // 도식 지도 1px ≈ 7m (시안의 2.1km에 맞춘 값)
const MIN_PER_KM = 15.2;     // 도보 속도

export function routeSummary(bs: Building[]) {
  let px = 0;
  for (let i = 1; i < bs.length; i++) {
    const a = bs[i - 1].pos, b = bs[i].pos;
    px += Math.hypot((b.x - a.x) * W, (b.y - a.y) * H);
  }
  const km = (px * M_PER_PX) / 1000;
  return { count: bs.length, km, minutes: Math.round(km * MIN_PER_KM) };
}

export default function RouteMap({ buildings, selectedId, group }: { buildings: Building[]; selectedId?: string | null; group?: Group }) {
  const { state } = useStore();
  const located = buildings.filter((b) => b.lat && b.lng);
  const real = state.mode === 'server' && located.length > 0;
  const office = guOffice(group?.sggCd);
  const walk = useWalk(real ? [office, ...located.map((b) => ({ lat: b.lat!, lng: b.lng! }))] : null);
  const fallback = <SchematicMap buildings={buildings} selectedId={selectedId} />;
  if (!real || !state.naverClientId) return fallback;

  const km = walk ? walk.totalDistance / 1000 : routeSummary(buildings).km;
  const minutes = walk ? Math.round(walk.totalTime / 60) : routeSummary(buildings).minutes;
  return (
    <div className="rmap">
      <NaverMap
        clientId={state.naverClientId}
        selectedId={selectedId}
        path={selectedId ? undefined : walk?.path}
        padding={28}
        stops={[
          { id: '_start', lat: office.lat, lng: office.lng, kind: 'start' },
          ...located.map((b, i) => ({ id: b.id, lat: b.lat!, lng: b.lng!, num: i + 1, kind: (b.status === 'done' ? 'done' : i === 0 ? 'fill' : 'plain') as 'done' | 'fill' | 'plain', label: b.dong })),
        ]}
        fallback={fallback}
      />
      <span className="rmap__chip">
        {office.name} 출발 · {buildings.length}곳 · 약 {km.toFixed(1)}km · 도보 {minutes}분
      </span>
    </div>
  );
}

function SchematicMap({ buildings, selectedId }: { buildings: Building[]; selectedId?: string | null }) {
  const sel = buildings.find((b) => b.id === selectedId);
  // 선택한 건물이 있으면 그 주변을 1.8배 확대해서 보여줌
  const zoom = sel ? 1.8 : 1;
  const vw = W / zoom, vh = H / zoom;
  const cx = sel ? sel.pos.x * W : W / 2;
  const cy = sel ? sel.pos.y * H : H / 2;
  const vx = Math.min(Math.max(cx - vw / 2, -W * 0.2), W * 1.2 - vw);
  const vy = Math.min(Math.max(cy - vh / 2, -H * 0.2), H * 1.2 - vh);
  const toPct = (b: Building) => ({
    left: `${((b.pos.x * W - vx) / vw) * 100}%`,
    top: `${((b.pos.y * H - vy) / vh) * 100}%`,
  });
  const points = buildings.map((b) => `${b.pos.x * W},${b.pos.y * H}`).join(' ');
  const s = routeSummary(buildings);

  return (
    <div className="rmap">
      <svg className="rmap__svg" viewBox={`${vx} ${vy} ${vw} ${vh}`} preserveAspectRatio="none" aria-hidden>
        <path d={`M${-W} ${-H}L${W * 2} ${H * 2}M${W * 2} ${-H}L${-W} ${H * 2}`} stroke="#2C2D31" vectorEffect="non-scaling-stroke" />
        <polyline points={points} fill="none" stroke="#448EDE" strokeWidth={3} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
      </svg>

      {buildings.map((b, i) => {
        const isSel = b.id === selectedId;
        const first = i === 0;
        return (
          <div key={b.id} className={`rmap__pin ${isSel ? 'is-sel' : ''} ${sel && !isSel ? 'is-dim' : ''}`} style={toPct(b)}>
            {isSel && <span className="rmap__halo" />}
            <span className={`rmap__marker ${first || isSel ? 'is-fill' : ''}`}>{i + 1}</span>
            {isSel && <span className="rmap__label">{b.dong}</span>}
          </div>
        );
      })}

      <span className="rmap__chip">
        {s.count}곳 · 약 {s.km.toFixed(1)}km · 도보 {s.minutes}분
      </span>
    </div>
  );
}
