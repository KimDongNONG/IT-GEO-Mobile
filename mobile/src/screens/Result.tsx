// M6 확인 결과 : 확인 완료 리스트에서 들어오는 현장 확인 기록 보기
//   위 = 사진(넘겨 보기 + 아래 썸네일), 확인 완료 배지 · 주소 · 유형 · 일시 · 담당자
//   카드 = 사전 탐지 요인(맞음 n / m) · 건물 상태(1~5 점) · 필요한 지원과 넘길 부서 · 메모
//   '확인 내용 수정' → 현장 기록 화면을 마지막 기록 내용으로 채워 연다 (/record/:id?edit=1)
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { usePullRefresh } from '../lib/pullRefresh';
import { Btn, Screen, TabBar } from '../components/ui';
import ServerPhoto from '../components/ServerPhoto';
import { IconCheck16, IconImage, IconMore, IconShare } from '../components/icons';
import { DEPT_CLASS, SCORE_LABEL, SECTIONS, deptsOf, doneAt } from '../lib/fieldcheck';
import './Result.css';

const PHOTO_LABELS = ['외관', '반지하 창문', '우편함'];

export default function Result() {
  const { buildingId = '' } = useParams();
  const { state, act } = useStore();
  const navigate = useNavigate();
  const b = state.buildings[buildingId];
  const rec = state.records[buildingId];
  const [idx, setIdx] = useState(0);
  const [menu, setMenu] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  // 웹에서 새로 남긴 기록까지 최신으로
  useEffect(() => { act.loadBuilding(buildingId).catch(() => undefined); }, [buildingId, act]);
  usePullRefresh(() => act.loadBuilding(buildingId).catch(() => undefined));

  if (!b || !rec) {
    return (
      <Screen title="확인 결과" back>
        <p className="result__empty">아직 등록된 확인 결과가 없어요.</p>
        <TabBar />
      </Screen>
    );
  }

  // 사진 : 서버 사진 → 폰에 있는 사진 → 없으면 칸만 (외관 · 반지하 창문 · 우편함)
  const photos: { key: string; label: string; node: ReactNode }[] = rec.photoIds?.length
    ? rec.photoIds.map((id, i) => ({ key: `s${id}`, label: PHOTO_LABELS[i] ?? `현장 사진 ${i + 1}`, node: <ServerPhoto id={id} alt={`현장 사진 ${i + 1}`} /> }))
    : rec.photos.map((src, i) => ({ key: `l${i}`, label: PHOTO_LABELS[i] ?? `현장 사진 ${i + 1}`, node: <img src={src} alt={`현장 사진 ${i + 1}`} /> }));
  const empty = photos.length === 0;
  const slides = empty ? PHOTO_LABELS.map((l) => ({ key: l, label: l, node: <IconImage width={40} height={40} /> })) : photos;
  const go = (i: number) => {
    setIdx(i);
    const el = strip.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const factors = Object.entries(rec.factorChecks);
  const yes = factors.filter(([, v]) => v === true).length;
  const depts = deptsOf(rec);
  const at = doneAt(b, rec);
  const when = rec.savedAt ?? (at ? `${at.getMonth() + 1}월 ${at.getDate()}일` : '');
  const edit = () => navigate(`/record/${b.id}?edit=1`);

  const share = async () => {
    setMenu(false);
    const lines = [
      `[현장 확인 결과] ${b.gu} ${b.dong} ${b.type}`,
      `확인: ${[when, rec.author].filter(Boolean).join(' · ')}`,
      factors.length ? `사전 탐지 요인: ${factors.map(([n, v]) => `${n} ${v === true ? '맞음' : v === false ? '아님' : '미확인'}`).join(', ')}` : '',
      rec.supports.length ? `필요한 지원: ${rec.supports.join(', ')}${depts.length ? ` → ${depts.join(', ')}` : ''}` : '',
      rec.memo ? `메모: ${rec.memo}` : '',
    ].filter(Boolean).join('\n');
    try {
      if (navigator.share) await navigator.share({ title: '현장 확인 결과', text: lines });
      else { await navigator.clipboard.writeText(lines); act.toast('확인 결과를 복사했어요.'); }
    } catch {
      /* 사용자가 취소 */
    }
  };

  return (
    <Screen
      title="확인 결과"
      back
      className="result"
      right={
        <div className="result__tools">
          <button aria-label="공유하기" onClick={share}><IconShare /></button>
          <button aria-label="더 보기" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><IconMore /></button>
          {menu && (
            <>
              <button className="result__menu-dim" aria-label="닫기" onClick={() => setMenu(false)} />
              <ul className="result__menu" role="menu">
                <li><button role="menuitem" onClick={() => { setMenu(false); edit(); }}>확인 내용 수정</button></li>
                <li><button role="menuitem" onClick={share}>공유하기</button></li>
                <li><button role="menuitem" onClick={() => navigate('/done')}>확인 완료 목록</button></li>
              </ul>
            </>
          )}
        </div>
      }
    >
      <div className="result__gallery">
        <div
          className="result__strip"
          ref={strip}
          onScroll={(e) => { const el = e.currentTarget; const i = Math.round(el.scrollLeft / el.clientWidth); if (i !== idx) setIdx(i); }}
        >
          {slides.map((p) => <div key={p.key} className={`result__slide ${empty ? 'is-empty' : ''}`}>{p.node}</div>)}
        </div>
        <span className="result__count">{idx + 1} / {slides.length} · {slides[idx]?.label}{empty && ' (사진 없음)'}</span>
      </div>
      <div className="result__thumbs">
        {slides.map((p, i) => (
          <button key={p.key} className={`${i === idx ? 'is-on' : ''} ${empty ? 'is-empty' : ''}`} aria-label={`${i + 1}번째 사진 · ${p.label}`} onClick={() => go(i)}>
            {empty ? <IconImage width={18} height={18} /> : p.node}
          </button>
        ))}
      </div>

      <span className="result__badge"><i />확인 완료</span>
      <h2 className="result__title">{b.gu} {b.dong}</h2>
      <p className="result__sub">{[b.type, when, rec.author].filter(Boolean).join(' · ')}{rec.fromWeb && ' · 웹에서 등록'}</p>

      <section className="card result__card">
        <div className="result__card-head">
          <h3>사전 탐지 요인</h3>
          {factors.length > 0 && <b>{yes} / {factors.length} 맞음</b>}
        </div>
        <ul className="result__rows">
          {factors.length === 0 && <li><span className="result__none">체크한 요인 없음</span></li>}
          {factors.map(([name, v]) => (
            <li key={name}>
              <span>{name}</span>
              {v === true ? <span className="result__chip is-yes"><IconCheck16 color="currentColor" width={12} height={12} />맞음</span>
                : v === false ? <span className="result__chip is-no">아님</span>
                : <span className="result__chip">미확인</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card result__card">
        <div className="result__card-head">
          <h3>건물 상태</h3>
          {rec.resident && <span className={`result__resident is-${rec.resident}`}>거주자 {rec.resident}</span>}
        </div>
        <ul className="result__rows">
          {SECTIONS.flatMap((s) => s.items).map((it) => {
            const v = rec.scores[it.key];
            return (
              <li key={it.key}>
                <span>{it.label}</span>
                {v != null ? <span className={`result__score lv${v}`}>{v} · {SCORE_LABEL[v]}</span> : <span className="result__chip">선택 안 함</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card result__card">
        <div className="result__card-head"><h3>필요한 지원 · 부서 이관</h3></div>
        {rec.supports.length ? (
          <>
            <div className="result__supports">{rec.supports.map((s) => <span key={s}>{s}</span>)}</div>
            <div className="result__depts">{depts.map((d) => <i key={d} className={DEPT_CLASS[d] ?? ''}>{d}</i>)}</div>
          </>
        ) : <p className="result__none">넘김 없음</p>}
      </section>

      <section className="card result__card">
        <div className="result__card-head"><h3>메모</h3></div>
        <p className="result__memo">{rec.memo || '메모 없음'}</p>
      </section>

      <Btn className="result__edit" onClick={edit}>확인 내용 수정</Btn>
      <TabBar />
    </Screen>
  );
}
