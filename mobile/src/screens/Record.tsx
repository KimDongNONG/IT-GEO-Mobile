// M3 현장 기록(건물) · M3-1 현장 기록(가구) · M4/M4-1 제출 확인
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { FieldRecord, ResidentStatus } from '../data/types';
import { useStore } from '../store/AppStore';
import { IconBuilding, IconCamera, IconCheck16, IconDown, IconUp, IconUpload, IconUsers } from '../components/icons';
import { ActionBar, Btn, Modal, Screen, SummaryRows } from '../components/ui';
import './Record.css';

const SECTIONS = [
  { key: 'safety', title: '안전', items: [{ key: 'around', label: '건물 주변' }, { key: 'flood', label: '침수 흔적·배수' }, { key: 'exit', label: '비상 탈출로' }] },
  { key: 'hygiene', title: '위생', items: [{ key: 'clean', label: '내부 청결' }, { key: 'mold', label: '곰팡이·습기' }] },
];
const RESIDENT: ResidentStatus[] = ['양호', '주의', '긴급', '부재'];
const SUPPORTS = ['집 수리', '주거 이전', '긴급복지', '돌봄 연계', '의료', '안부 확인'];
const SCORE_R = [23, 19, 16, 19, 23];
const SCORE_C = ['var(--score-1)', 'var(--score-2)', 'var(--score-3)', 'var(--score-4)', 'var(--score-5)'];

function emptyRecord(buildingId: string): FieldRecord {
  return { buildingId, scores: {}, supports: [], memo: '', photos: [], factorChecks: {} };
}

export default function Record() {
  const { buildingId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const groupId = params.get('group') ?? '';
  const tab = params.get('tab') === 'household' ? 'household' : 'building';
  const { state, act } = useStore();
  const navigate = useNavigate();
  const b = state.buildings[buildingId];
  // 서버 모드는 방문할 때마다 새 기록 (웹 05 타임라인에 한 줄씩 쌓임). 시연 모드는 저장한 기록을 이어서 고침
  const [rec, setRec] = useState<FieldRecord>(() => (state.mode === 'demo' && state.records[buildingId]) || emptyRecord(buildingId));
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);   // 저장 중 안내 문구
  // 사전 탐지 요인 근거 · 대장은 서버 상세에서
  useEffect(() => {
    if (b && !b.detailLoaded) act.loadBuilding(b.id).catch(() => undefined);
  }, [b, act]);
  if (!b) return null;

  const submit = async () => {
    if (saving) return;
    setSaving('저장하는 중…');
    try {
      const { failedPhotos } = await act.saveRecord(rec, (done, total) => setSaving(`사진 올리는 중… ${done} / ${total}`));
      if (failedPhotos) act.toast(`사진 ${failedPhotos}장은 올리지 못했어요. 기록은 저장됐어요.`);
      navigate(`/record/${b.id}/saved?group=${groupId}`, { replace: true });
    } catch (e) {
      act.toast(e instanceof Error ? e.message : '저장하지 못했어요.');
      setSaving(null);
    }
  };

  const back = () => (groupId ? navigate(`/route/${groupId}`) : navigate(-1));
  const setScore = (k: string, v: number) => setRec((r) => ({ ...r, scores: { ...r.scores, [k]: v } }));
  const toggle = (k: string) => setClosed((c) => ({ ...c, [k]: !c[k] }));

  const addPhoto = async (source: CameraSource) => {
    try {
      const p = await Camera.getPhoto({ source, resultType: CameraResultType.DataUrl, quality: 70, width: 1280 });
      if (p.dataUrl) setRec((r) => ({ ...r, photos: [...r.photos, p.dataUrl!] }));
    } catch {
      /* 사용자가 취소 */
    }
  };

  const memoSection = (num: number) => (
    <Section num={num} title="메모" closed={closed.memo} onToggle={() => toggle('memo')}>
      <div className="rec__photo-btns">
        <button className="rec__photo-btn" onClick={() => addPhoto(CameraSource.Camera)}><IconCamera />사진 촬영</button>
        <button className="rec__photo-btn" onClick={() => addPhoto(CameraSource.Photos)}><IconUpload />사진 업로드</button>
      </div>
      {rec.photos.length > 0 && (
        <ul className="rec__photos">
          {rec.photos.map((src, i) => (
            <li key={i}>
              <img src={src} alt={`현장 사진 ${i + 1}`} />
              <button aria-label="사진 지우기" onClick={() => setRec((r) => ({ ...r, photos: r.photos.filter((_, j) => j !== i) }))}>×</button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        className="rec__memo"
        value={rec.memo}
        onChange={(e) => setRec((r) => ({ ...r, memo: e.target.value }))}
        placeholder="현장에서 본 내용을 적어 주세요"
      />
    </Section>
  );

  return (
    <Screen title="현장 기록" back={back} right={<span className="badge badge--plain">진행 중</span>} bottom="actions" className="rec">
      <div className="rec__bld card">
        <p className="rec__bld-name">{b.gu} {b.dong} {b.type}</p>
        <p className="rec__bld-sub">취약도 {b.score} · {b.households}</p>
      </div>

      <div className="rec__tabs card" role="tablist">
        <button role="tab" aria-selected={tab === 'building'} className={tab === 'building' ? 'is-on' : ''} onClick={() => setParams({ group: groupId }, { replace: true })}>
          <IconBuilding color={tab === 'building' ? '#fff' : 'var(--sub)'} /> 건물
        </button>
        <button role="tab" aria-selected={tab === 'household'} className={tab === 'household' ? 'is-on' : ''} onClick={() => setParams({ group: groupId, tab: 'household' }, { replace: true })}>
          <IconUsers color={tab === 'household' ? '#fff' : 'var(--sub)'} /> 가구
        </button>
      </div>

      {tab === 'building' ? (
        <>
          {SECTIONS.map((s, si) => (
            <Section
              key={s.key}
              num={si + 1}
              title={s.title}
              closed={closed[s.key]}
              onToggle={() => toggle(s.key)}
              extra={
                <button className="rec__allgood" onClick={() => s.items.forEach((it) => setScore(it.key, 1))}>모두 양호</button>
              }
            >
              {s.items.map((it) => (
                <ScoreRow key={it.key} label={it.label} value={rec.scores[it.key]} onChange={(v) => setScore(it.key, v)} />
              ))}
            </Section>
          ))}
          {memoSection(3)}
        </>
      ) : (
        <>
          <Section num={4} title="거주자" closed={closed.resident} onToggle={() => toggle('resident')}>
            <p className="rec__q">거주자 상태</p>
            <div className="seg" role="radiogroup">
              {RESIDENT.map((r) => (
                <button key={r} role="radio" aria-checked={rec.resident === r} className={rec.resident === r ? 'is-on' : ''} onClick={() => setRec((x) => ({ ...x, resident: r }))}>
                  {r}
                </button>
              ))}
            </div>
            <p className="rec__q rec__q--row">필요한 지원 <span>여러 개 고를 수 있어요</span></p>
            <div className="supports">
              {SUPPORTS.map((s) => {
                const on = rec.supports.includes(s);
                return (
                  <button
                    key={s}
                    className={on ? 'is-on' : ''}
                    aria-pressed={on}
                    onClick={() => setRec((x) => ({ ...x, supports: on ? x.supports.filter((y) => y !== s) : [...x.supports, s] }))}
                  >
                    <span className="supports__box">{on && <IconCheck16 color="#E2E2E5" />}</span>
                    {s}
                  </button>
                );
              })}
            </div>
          </Section>
          {memoSection(5)}
        </>
      )}

      <ActionBar>
        <Btn onClick={back}>이전 화면으로</Btn>
        <Btn variant="primary" onClick={() => setConfirming(true)}>저장하고 완료</Btn>
      </ActionBar>

      {confirming && (
        <SubmitDialog
          rec={rec}
          setRec={setRec}
          onCancel={() => !saving && setConfirming(false)}
          onSubmit={submit}
          saving={saving}
        />
      )}
    </Screen>
  );
}

function Section({
  num, title, closed, onToggle, extra, children,
}: { num: number; title: string; closed?: boolean; onToggle: () => void; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="sec card">
      <header className="sec__head">
        <span className="sec__num">{num}</span>
        <h2 className="sec__title">{title}</h2>
        {extra}
        <button className="sec__toggle" onClick={onToggle} aria-label={closed ? '펼치기' : '접기'} aria-expanded={!closed}>
          {closed ? <IconDown /> : <IconUp />}
        </button>
      </header>
      {!closed && <div className="sec__body">{children}</div>}
    </section>
  );
}

function ScoreRow({ label, value, onChange }: { label: string; value?: number; onChange: (v: number) => void }) {
  return (
    <div className="score">
      <p className="score__label">{label}</p>
      <div className="score__opts" role="radiogroup" aria-label={label}>
        {SCORE_R.map((r, i) => {
          const v = i + 1;
          const on = value === v;
          return (
            <button key={v} role="radio" aria-checked={on} aria-label={`${v}점`} onClick={() => onChange(v)}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r={r} stroke={SCORE_C[i]} strokeWidth="2" fill={on ? SCORE_C[i] : 'none'} />
                {on && (r === 23
                  ? <path d="M17.5312 24.7188L21.8438 29.0312L30.4688 19.6875" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  : <path d="M18.6562 24.5938L22.2188 28.1562L29.3438 20.4375" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />)}
              </svg>
            </button>
          );
        })}
      </div>
      <div className="score__ends"><span>양호</span><span>위험</span></div>
    </div>
  );
}

function SubmitDialog({
  rec, setRec, onCancel, onSubmit, saving,
}: { rec: FieldRecord; setRec: React.Dispatch<React.SetStateAction<FieldRecord>>; onCancel: () => void; onSubmit: () => void; saving: string | null }) {
  const { state } = useStore();
  const b = state.buildings[rec.buildingId];
  const itemCount = SECTIONS.reduce((n, s) => n + s.items.length, 0);
  const warn = Object.values(rec.scores).filter((v) => v >= 4).length;
  const picked = b.factorEvidence.filter((f) => rec.factorChecks[f.name] !== undefined).length;
  const ready = picked === b.factorEvidence.length;

  return (
    <Modal onDismiss={onCancel} className="submit">
      <h2 className="dlg__title">확인 결과를 제출할까요?</h2>
      <div className="submit__rows">
        <SummaryRows
          rows={[
            ['건물', b.dong],
            ['건물 점검', `${itemCount}개 항목 · 주의 ${warn}`],
            ['거주자 상태', rec.resident ?? '-'],
            ['필요한 지원', rec.supports.length ? rec.supports.map((x) => x.replace(/ /g, '')).join(' · ') : '-'],
            ['사진 · 메모', `사진 ${rec.photos.length}장 · 메모 ${rec.memo.trim() ? 1 : 0}건`],
          ]}
        />
      </div>
      <div className="submit__div" />
      <p className="submit__h">사전 탐지 요인 확인</p>
      <p className="submit__desc">결과는 분석 점수에 반영돼요.</p>
      <ul className="factors">
        {b.factorEvidence.map((f) => {
          const v = rec.factorChecks[f.name];
          const set = (x: boolean) => setRec((r) => ({ ...r, factorChecks: { ...r.factorChecks, [f.name]: x } }));
          return (
            <li key={f.name}>
              <div>
                <p className="factors__name">{f.name}</p>
                <p className="factors__ev">{f.evidence}</p>
              </div>
              <div className="factors__btns">
                <button className={v === true ? 'is-yes' : ''} onClick={() => set(true)}>맞음</button>
                <button className={v === false ? 'is-no' : ''} onClick={() => set(false)}>아님</button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className={`submit__state ${ready ? 'is-ready' : ''}`}>
        {ready ? `${picked} / ${b.factorEvidence.length} 선택 완료` : `${picked} / ${b.factorEvidence.length} 선택 · 모두 고르면 제출할 수 있어요`}
      </p>
      <div className="dlg__actions">
        <Btn className="submit__cancel" onClick={onCancel}>취소</Btn>
        <Btn variant={ready && !saving ? 'primary' : 'disabled'} className="submit__go" disabled={!ready || !!saving} onClick={onSubmit}>
          {saving ?? '제출하기'}
        </Btn>
      </div>
    </Modal>
  );
}
