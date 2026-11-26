// M5 확인 저장 완료 : 등록 안내 · 반영 결과(취약도 보정 · 사전 탐지 요인 · 그룹 진행) · 다음 방문 카드
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { Ico } from '../components/figma';
import { ActionBar, Bar, Btn } from '../components/ui';
import './Saved.css';

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
  const checks = Object.values(rec.factorChecks).filter((v) => v != null);
  const yes = checks.filter((v) => v === true).length;
  const groupBs = group?.buildingIds.map((id) => state.buildings[id]).filter(Boolean) ?? [];
  const doneCnt = groupBs.filter((x) => x.status === 'done').length;
  const nextIdx = groupBs.findIndex((x) => x.status !== 'done');
  const next = nextIdx >= 0 ? groupBs[nextIdx] : undefined;
  const toRoute = () => navigate(group ? `/route/${group.id}` : '/');

  return (
    <div className="screen screen--actions saved">
      <div className="saved__bar">
        <button className="saved__close" onClick={toRoute} aria-label="닫기"><Ico name="closeX" size={24} /></button>
      </div>

      <div className="saved__hero">
        <span className="saved__mark"><span><Ico name="checkWhite32" size={32} /></span></span>
        <h1 className="saved__title">확인 결과가 등록됐어요</h1>
        <p className="saved__desc">{b.gu} {b.dong}<br />그룹 진행률과 분석 지도 점수에 반영됐어요.</p>
      </div>

      <section className="card saved__card">
        <div className="saved__score">
          <span className="saved__k">취약도</span>
          <b className="is-old">{b.score}</b>
          <Ico name="arrowRightSub" size={16} />
          <b>{b.score + warn}</b>
          <span className="saved__tag">현장 확인 보정</span>
        </div>
        <hr className="divider" />
        <div className="saved__row">
          <span className="saved__k">사전 탐지 요인</span>
          <b>{checks.length === 0 ? '선택 안 함' : yes === checks.length ? `${yes}개 모두 맞음` : `${checks.length}개 중 ${yes}개 맞음`}</b>
        </div>
        {group && (
          <div className="saved__grp">
            <div className="saved__row">
              <span className="saved__k">그룹 진행</span>
              <b className="is-blue">{doneCnt} / {groupBs.length} 건물</b>
            </div>
            <Bar value={doneCnt} total={groupBs.length} />
          </div>
        )}
      </section>

      {group && next && (
        <section className="card saved__next">
          <p className="saved__next-h">다음 방문</p>
          <div className="saved__next-row">
            <span className="saved__no">{nextIdx + 1}</span>
            <div className="saved__next-tx">
              <p>{next.gu} {next.dong}</p>
              <small>{next.type}</small>
            </div>
            <button className="btn btn--soft saved__nav" onClick={() => navigate(`/route/${group.id}/nav/${next.id}`)}>
              <Ico name="navPrimary" size={18} />길찾기
            </button>
          </div>
        </section>
      )}

      <ActionBar className="actionbar--plain actionbar--even">
        <Btn variant="line" onClick={() => navigate(`/result/${b.id}`)}>등록 결과 보기</Btn>
        {group && next
          ? <Btn variant="primary" onClick={() => navigate(`/route/${group.id}?open=${next.id}`)}>다음 건물로</Btn>
          : <Btn variant="primary" onClick={toRoute}>{group ? '동선으로' : '홈으로'}</Btn>}
      </ActionBar>
    </div>
  );
}
