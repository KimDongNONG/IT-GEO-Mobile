// itGEO 로고 (최종본 · 라이트용 둥근 GEO) : 검은 i + 하늘색 t, 남색 GEO
//   원본 짜임 364 × 92.28 (it 94.13 × 92.28 · GEO 는 왼쪽 100 에서 시작)을 height 에 맞춰 줄인다
import itMark from '../assets/figma/logo-final-it.svg';
import geoMark from '../assets/figma/logo-final-geo.svg';
import './Logo.css';

const W = 364, H = 92.28;

export default function Logo({ height, className = '' }: { height: number; className?: string }) {
  const k = height / H;
  return (
    <span className={`logo ${className}`} style={{ width: W * k, height }} role="img" aria-label="itGEO">
      <span className="logo__in" style={{ transform: `scale(${k})` }}>
        <img className="logo__it" src={itMark} width={94.1256} height={92.28} alt="" draggable={false} />
        <img className="logo__geo" src={geoMark} width={260.921} height={92.2828} alt="" draggable={false} />
      </span>
    </span>
  );
}
