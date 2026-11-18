// M5 저장 완료
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { Btn, Screen, SummaryRows } from '../components/ui';
import './Result.css';

export default function Saved() {
  const { buildingId = '' } = useParams();
  const [params] = useSearchParams();
  const { state } = useStore();
  const navigate = useNavigate();
  const b = state.buildings[buildingId];
  const rec = state.records[buildingId];
  const group = state.groups.find((g) => g.id === params.get('group')) ?? state.groups.find((g) => g.buildingIds.includes(buildingId));
  if (!b || !rec) return null;

  const warn = Object.values(rec.scores).filter((v) => v >= 4).length;
  const checks = Object.values(rec.factorChecks);
  const groupBs = group?.buildingIds.map((id) => state.buildings[id]).filter(Boolean) ?? [];
  const toRoute = () => navigate(group ? `/route/${group.id}` : '/');

  return (
    <Screen title="확인 저장 완료" back={toRoute} bottom="none" className="saved">
      <div className="saved__mark">✓</div>
      <p className="saved__title">확인 결과가 등록되었습니다</p>
      <p className="saved__desc">
        {b.gu} {b.dong}
        <br />
        그룹 진행률과 분석 지도 점수에 반영되었어요.
      </p>
      <div className="card saved__card">
        <SummaryRows
          rows={[
            ['취약도', `${b.score} → ${b.score + warn} (현장 확인 보정)`],
            ['사전 탐지 요인', `${checks.filter((v) => v !== null && v !== undefined).length} / ${b.factorEvidence.length}`],
            ['리스트 완료 건물', `${groupBs.filter((x) => x.status === 'done').length} / ${groupBs.length}`],
          ]}
        />
      </div>
      <div className="saved__btns">
        <Btn className="saved__btn" onClick={() => navigate(`/result/${b.id}`)}>등록 결과 보기</Btn>
        <Btn variant="primary" className="saved__btn saved__btn--go" onClick={toRoute}>그룹 건물 목록으로</Btn>
      </div>
    </Screen>
  );
}
