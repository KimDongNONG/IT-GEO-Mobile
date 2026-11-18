// M6 확인 결과 상세
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { Btn, Screen, TabBar } from '../components/ui';
import { blobUrl } from '../api/client';
import { photoPath } from '../api/wellfair';
import './Result.css';

/** 서버에 저장된 사진 (로그인 세션이 필요해서 fetch → blob 으로 보여 줌) */
function ServerPhoto({ id, alt }: { id: number; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    let alive = true;
    blobUrl(photoPath(id)).then((x) => { u = x; if (alive) setSrc(x); else URL.revokeObjectURL(x); }).catch(() => undefined);
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [id]);
  return src ? <img src={src} alt={alt} /> : <span className="result__loading" />;
}

const PHOTO_LABELS = ['외관', '반지하 창문', '우편함'];

export default function Result() {
  const { buildingId = '' } = useParams();
  const { state, act } = useStore();
  const navigate = useNavigate();
  const b = state.buildings[buildingId];
  const rec = state.records[buildingId];
  // 웹에서 새로 남긴 기록까지 최신으로
  useEffect(() => { act.loadBuilding(buildingId).catch(() => undefined); }, [buildingId, act]);

  if (!b || !rec) {
    return (
      <Screen title="확인 결과 상세" back>
        <p className="result__empty">아직 등록된 확인 결과가 없어요.</p>
        <TabBar />
      </Screen>
    );
  }

  return (
    <Screen title="확인 결과 상세" back right={<span className="badge badge--plain result__badge">완료</span>} className="result">
      <div className="result__bld">
        <p className="result__bld-name">{b.gu} {b.dong} {b.type}</p>
        <p className="result__bld-sub">{rec.savedAt} · {rec.author}{rec.fromWeb && ' · 웹에서 등록'}</p>
      </div>

      <h2 className="result__h">사전 탐지 요인</h2>
      <ul className="card result__factors">
        {Object.keys(rec.factorChecks).length === 0 && <li><span>체크한 요인 없음</span></li>}
        {Object.entries(rec.factorChecks).map(([name, v]) => (
          <li key={name}>
            <span>{name}</span>
            <span className={`result__chip ${v ? 'is-yes' : ''}`}>{v === true ? '확인' : v === false ? '아님' : '미확인'}</span>
          </li>
        ))}
      </ul>

      <h2 className="result__h">건물 상태 메모</h2>
      <div className="card result__memo">{rec.memo || '메모 없음'}</div>

      <h2 className="result__h">외관 사진</h2>
      <ul className="result__photos">
        {rec.photoIds?.length
          ? rec.photoIds.map((id, i) => (
              <li key={id}><ServerPhoto id={id} alt={`외관 사진 ${i + 1}`} /></li>
            ))
          : rec.photos.length
          ? rec.photos.map((src, i) => (
              <li key={i}><img src={src} alt={`외관 사진 ${i + 1}`} /></li>
            ))
          : PHOTO_LABELS.map((l) => (
              <li key={l} className="is-empty">
                <span>{l}</span>
              </li>
            ))}
      </ul>

      <Btn variant="white" className="result__edit" onClick={() => navigate(`/record/${b.id}`)}>확인 내용 수정</Btn>
      <TabBar />
    </Screen>
  );
}
