// M0 로딩 : 앱을 켜고 로그인 상태를 확인하는 동안 보이는 화면 (메인 그라데이션 + itGEO 워드마크)
import { FIG } from '../components/figma';
import './Loading.css';

export default function Loading() {
  return (
    <div className="loading" role="status" aria-label="불러오는 중">
      <div className="loading__logo" aria-label="itGEO">
        <img className="loading__it" src={FIG.logoIt} width={62.06} height={60.84} alt="" />
        <span className="loading__geo"><img src={FIG.logoGeo} width={172.035} height={60.846} alt="" /></span>
      </div>
    </div>
  );
}
