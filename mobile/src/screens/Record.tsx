// M3 현장 기록 · M4 제출 확인
//   위 = 건물 요약(방문 순번 · 점검 진행 n / 5 항목), 사전 탐지 요인 확인(맞음 / 아님), 건물 | 가구 세그먼트
//   건물 탭 : 섹션 카드(안전 · 위생)마다 1~5 점 큰 버튼 (1 양호 ~ 5 위험). 다 고른 섹션은 접히고 초록 체크
//   가구 탭 : 거주자 상태 · 필요한 지원
//   사진 · 메모 섹션은 두 탭 모두 맨 아래. 오른쪽 위 '임시 저장' = 폰에 잠깐 보관 (사진 제외), 다시 들어오면 이어서 쓴다
//   '저장하고 완료' → 요인을 다 고르지 않았으면 토스트로 알리고 요인 칸으로 이동, 다 골랐으면 제출 확인 시트(M4)
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import type { FieldRecord, ResidentStatus } from '../data/types';
import { useStore } from '../store/AppStore';
import { FIG, Ico } from '../components/figma';
import { ActionBar, Bar, Btn, Screen, Sheet } from '../components/ui';
import { SECTIONS, SUPPORTS } from '../lib/fieldcheck';
import './Record.css';

const RESIDENT: ResidentStatus[] = ['양호', '주의', '긴급', '부재'];
const ITEM_COUNT = SECTIONS.reduce((n, s) => n + s.items.length, 0);
const draftKey = (buildingId: string) => `itgeo.mobile.draft.${buildingId}`;

/** 임시 저장한 기록 (사진은 용량 때문에 빼고 저장) */
function loadDraft(buildingId: string): FieldRecord | null {
  try {
    const v = localStorage.getItem(draftKey(buildingId));
    return v ? { ...JSON.parse(v), photos: [] } : null;
  } catch { return null; }
}

function emptyRecord(buildingId: string): FieldRecord {
  return { buildingId, scores: {}, supports: [], memo: '', photos: [], factorChecks: {} };
}

/** 점수 합 / 만점 비율로 색 (낮을수록 양호) */
function tone(sum: number, max: number) {
  const r = max ? sum / max : 0;
  return r <= 0.4 ? 'good' : r <= 0.7 ? 'warn' : 'bad';
}

export default function Record() {
  const { buildingId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const groupId = params.get('group') ?? '';
  const editing = params.get('edit') === '1';   // 확인 결과 → '확인 내용 수정' : 마지막 기록 내용을 채운 채로 연다
  const tab = params.get('tab') === 'household' ? 'household' : 'building';
  const { state, act } = useStore();
  const navigate = useNavigate();
  const b = state.buildings[buildingId];
  // 서버 모드는 방문할 때마다 새 기록 (웹 05 타임라인에 한 줄씩 쌓임). 시연 모드는 저장한 기록을 이어서 고침
  //   임시 저장이 있으면 그것부터
  //   수정으로 들어오면 마지막 기록 내용부터 (서버에 이미 올린 사진은 다시 올리지 않으므로 빼고 시작)
  const [rec, setRec] = useState<FieldRecord>(() => {
    const last = state.records[buildingId];
    if (editing && last) return state.mode === 'demo' ? last : { ...last, photos: [], photoIds: undefined, recordId: undefined };
    return loadDraft(buildingId) ?? ((state.mode === 'demo' && last) || emptyRecord(buildingId));
  });
  // 처음에는 다 고른 섹션만 접어 둔다
  const [closed, setClosed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.key, s.items.every((it) => rec.scores[it.key] != null)])));
  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState(false);               // 사진 추가 : 촬영 / 앨범
  const [saving, setSaving] = useState<string | null>(null);   // 저장 중 안내 문구
  const factorRef = useRef<HTMLElement>(null);
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
      try { localStorage.removeItem(draftKey(b.id)); } catch { /* 무시 */ }
      if (editing) {
        // 수정은 확인 결과 화면으로 돌아간다 (서버 모드는 새 기록으로 쌓여서 웹 기록 타임라인에도 한 줄 추가됨)
        act.toast('수정한 내용을 저장했어요.');
        navigate(`/result/${b.id}`, { replace: true });
        return;
      }
      navigate(`/record/${b.id}/saved?group=${groupId}`, { replace: true });
    } catch (e) {
      act.toast(e instanceof Error ? e.message : '저장하지 못했어요.');
      setSaving(null);
    }
  };

  // 뒤로 = 들어온 화면으로 (홈 · 동선 · 캘린더 …). 바로 열린 경우(이전 기록 없음)만 홈으로
  const back = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/', { replace: true }));
  const saveDraft = () => {
    try {
      localStorage.setItem(draftKey(b.id), JSON.stringify({ ...rec, photos: [] }));
      act.toast(rec.photos.length ? '임시 저장했어요. 사진은 저장되지 않으니 제출 전에 다시 붙여 주세요.' : '임시 저장했어요. 다시 들어오면 이어서 쓸 수 있어요.');
    } catch {
      act.toast('임시 저장하지 못했어요.');
    }
  };
  const answered = SECTIONS.reduce((n, s) => n + s.items.filter((it) => rec.scores[it.key] != null).length, 0);
  const visitNo = groupId ? (state.groups.find((g) => g.id === groupId)?.buildingIds.indexOf(b.id) ?? -1) + 1 : 0;
  const toggle = (k: string) => setClosed((c) => ({ ...c, [k]: !c[k] }));
  /** 점수 고르기 : 그 섹션을 다 채우면 접는다 ('모두 양호'는 접지 않음 : 바로 고쳐 고를 수 있게) */
  const setScores = (sectionKey: string, values: Record<string, number>, autoClose = true) => {
    const next = { ...rec.scores, ...values };
    const sec = SECTIONS.find((s) => s.key === sectionKey);
    if (autoClose && sec && sec.items.every((it) => next[it.key] != null) && sec.items.some((it) => rec.scores[it.key] == null)) {
      setClosed((c) => ({ ...c, [sectionKey]: true }));
    }
    setRec((r) => ({ ...r, scores: { ...r.scores, ...values } }));
  };

  const factors = b.factorEvidence;
  const picked = factors.filter((f) => rec.factorChecks[f.name] != null).length;
  const factorsReady = picked === factors.length;
  const setFactor = (name: string, v: boolean) => setRec((r) => ({ ...r, factorChecks: { ...r.factorChecks, [name]: v } }));

  const finish = () => {
    if (!factorsReady) {
      act.toast(`사전 탐지 요인을 모두 골라 주세요. (${picked} / ${factors.length})`);
      factorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setConfirming(true);
  };

  const addPhoto = async (source: CameraSource) => {
    setPicking(false);
    try {
      const p = await Camera.getPhoto({ source, resultType: CameraResultType.DataUrl, quality: 70, width: 1280 });
      if (p.dataUrl) setRec((r) => ({ ...r, photos: [...r.photos, p.dataUrl!] }));
    } catch {
      /* 사용자가 취소 */
    }
  };

  const memoSection = (num: number) => (
    <section className="sec card">
      <header className="sec__head">
        <span className="sec__num">{num}</span>
        <h2 className="sec__title">사진 · 메모<small>사진 {rec.photos.length}장</small></h2>
      </header>
      <div className="sec__body sec__body--memo">
        <ul className="rec__photos">
          <li>
            <button className="rec__add" onClick={() => setPicking(true)}>
              <Ico name="camera" size={24} />
              사진 추가
            </button>
          </li>
          {rec.photos.map((src, i) => (
            <li key={i} className="rec__photo">
              <img src={src} alt={`현장 사진 ${i + 1}`} />
              <button aria-label="사진 지우기" onClick={() => setRec((r) => ({ ...r, photos: r.photos.filter((_, j) => j !== i) }))}>×</button>
            </li>
          ))}
        </ul>
        <textarea
          className="rec__memo"
          value={rec.memo}
          onChange={(e) => setRec((r) => ({ ...r, memo: e.target.value }))}
          placeholder="현장에서 본 내용을 적어 주세요 (선택)"
        />
      </div>
    </section>
  );

  return (
    <Screen title="현장 기록" back={back} right={<button className="topbar__link" onClick={saveDraft}>임시 저장</button>} bottom="actions" className="rec">
      {/* 건물 요약 */}
      <section className="rec__bld card">
        <div className="rec__bld-top">
          {visitNo > 0 && <span className="rec__bld-no">{visitNo}</span>}
          <div className="rec__bld-tx">
            <p className="rec__bld-name">{b.gu} {b.dong}</p>
            <p className="rec__bld-sub">{b.type} · 취약도 {b.score}{b.households && b.households !== '-' ? ` · ${b.households.split(' (')[0]}` : ''}</p>
          </div>
        </div>
        <div className="rec__prog">
          <span>점검 진행</span>
          <b>{answered} / {ITEM_COUNT} 항목</b>
        </div>
        <Bar value={answered} total={ITEM_COUNT} />
      </section>

      {/* 사전 탐지 요인 확인 */}
      {factors.length > 0 && (
        <section className="fac" ref={factorRef}>
          <div className="fac__head">
            <h2>사전 탐지 요인 확인</h2>
            <p>분석에서 찾은 요인이 현장과 맞는지 골라 주세요.</p>
          </div>
          {factors.map((f) => {
            const v = rec.factorChecks[f.name];
            return (
              <div key={f.name} className={`fac__item ${v != null ? 'is-picked' : ''}`}>
                <div className="fac__tx">
                  <p className="fac__name">{f.name}</p>
                  <p className="fac__ev">{f.evidence.replace(/^분석 근거:\s*/, '분석 근거 · ')}</p>
                </div>
                <div className="fac__btns" role="radiogroup" aria-label={f.name}>
                  <button role="radio" aria-checked={v === true} className={v === true ? 'is-yes' : ''} onClick={() => setFactor(f.name, true)}>맞음</button>
                  <button role="radio" aria-checked={v === false} className={v === false ? 'is-no' : ''} onClick={() => setFactor(f.name, false)}>아님</button>
                </div>
              </div>
            );
          })}
          <p className={`fac__state ${factorsReady ? 'is-ready' : ''}`}>
            <Ico name={factorsReady ? 'checkGreen' : 'infoWarn'} size={16} />
            {factorsReady ? `${picked} / ${factors.length} 선택 완료` : `${picked} / ${factors.length} 선택 · 요인부터 확인하고 점검을 이어가요`}
          </p>
        </section>
      )}

      <div className="seg rec__tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'building'} className={tab === 'building' ? 'is-on' : ''} onClick={() => setParams({ group: groupId, ...(editing ? { edit: '1' } : {}) }, { replace: true })}>
          <img src={FIG.segBuildingOn} width={18} height={18} alt="" className={tab === 'building' ? '' : 'ico--off'} /> 건물
        </button>
        <button role="tab" aria-selected={tab === 'household'} className={tab === 'household' ? 'is-on' : ''} onClick={() => setParams({ group: groupId, tab: 'household', ...(editing ? { edit: '1' } : {}) }, { replace: true })}>
          <img src={FIG.segUsersOff} width={18} height={18} alt="" className={tab === 'household' ? 'ico--on' : ''} /> 가구
        </button>
      </div>

      {tab === 'building' ? (
        <>
          {SECTIONS.map((s, si) => {
            const n = s.items.filter((it) => rec.scores[it.key] != null).length;
            const full = n === s.items.length;
            return (
              <Section
                key={s.key}
                num={si + 1}
                title={s.title}
                done={full}
                count={full ? `${n} / ${s.items.length} 완료` : `${n} / ${s.items.length}`}
                closed={closed[s.key]}
                onToggle={() => toggle(s.key)}
                extra={<button className="minibtn" onClick={() => setScores(s.key, Object.fromEntries(s.items.map((it) => [it.key, 1])), false)}>모두 양호</button>}
              >
                {s.items.map((it) => (
                  <ScoreRow key={it.key} label={it.label} value={rec.scores[it.key]} onChange={(v) => setScores(s.key, { [it.key]: v })} />
                ))}
              </Section>
            );
          })}
          {memoSection(SECTIONS.length + 1)}
        </>
      ) : (
        <>
          <Section num={1} title="거주자" done={!!rec.resident} count={rec.resident ? '입력 완료' : undefined} closed={closed.resident} onToggle={() => toggle('resident')}>
            <div className="hh">
              <p className="hh__q">거주자 상태</p>
              <div className="hh__opts" role="radiogroup">
                {RESIDENT.map((r) => (
                  <button key={r} role="radio" aria-checked={rec.resident === r} className={`opt ${rec.resident === r ? 'is-on' : ''}`} onClick={() => setRec((x) => ({ ...x, resident: r }))}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="hh">
              <p className="hh__q">필요한 지원 <small>여러 개 고를 수 있어요</small></p>
              <div className="hh__grid">
                {SUPPORTS.map((s) => {
                  const on = rec.supports.includes(s);
                  return (
                    <button
                      key={s}
                      className={`opt ${on ? 'is-on' : ''}`}
                      aria-pressed={on}
                      onClick={() => setRec((x) => ({ ...x, supports: on ? x.supports.filter((y) => y !== s) : [...x.supports, s] }))}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>
          {memoSection(2)}
        </>
      )}

      <ActionBar>
        <Btn onClick={back}>이전</Btn>
        <Btn variant="primary" onClick={finish}>저장하고 완료</Btn>
      </ActionBar>

      {picking && (
        <Sheet onDismiss={() => setPicking(false)} title="사진 추가" close>
          <div className="rec__pick">
            <button className="btn btn--ghost" onClick={() => addPhoto(CameraSource.Camera)}><Ico name="camera" size={24} />사진 촬영</button>
            <button className="btn btn--ghost" onClick={() => addPhoto(CameraSource.Photos)}><Ico name="image" size={24} />앨범에서 고르기</button>
          </div>
        </Sheet>
      )}

      {confirming && (
        <SubmitSheet rec={rec} onCancel={() => !saving && setConfirming(false)} onSubmit={submit} saving={saving} />
      )}
    </Screen>
  );
}

function Section({
  num, title, done, count, closed, onToggle, extra, children,
}: { num: number; title: string; done?: boolean; count?: string; closed?: boolean; onToggle: () => void; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className={`sec card ${closed ? 'is-closed' : ''}`}>
      <header className="sec__head">
        <button className="sec__toggle" onClick={onToggle} aria-expanded={!closed}>
          <span className={`sec__num ${done ? 'is-done' : ''}`}>{done ? <Ico name="checkGreen" size={15} /> : num}</span>
          <span className={`sec__title ${done ? 'is-done' : ''}`}>{title}{count && <small>{count}</small>}</span>
        </button>
        {closed
          ? <button className="sec__chev" onClick={onToggle} aria-label="펼치기"><Ico name="chevDown" size={22} /></button>
          : extra}
      </header>
      {!closed && <div className="sec__body">{children}</div>}
    </section>
  );
}

/** 1 ~ 5 점 큰 버튼 : 고른 칸은 점수 색 + 흰 체크 (1·2 초록, 3 노랑, 4 주황, 5 빨강) */
function ScoreRow({ label, value, onChange }: { label: string; value?: number; onChange: (v: number) => void }) {
  return (
    <div className="score">
      <p className="score__label">
        <span>{label}</span>
        {value == null && <small>선택 안 함</small>}
      </p>
      <div className="score__opts" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((v) => {
          const on = value === v;
          return (
            <button key={v} role="radio" aria-checked={on} aria-label={`${v}점`} className={on ? `is-on lv${v}` : ''} onClick={() => onChange(v)}>
              {on ? <Ico name="checkWhite16" size={16} /> : v}
            </button>
          );
        })}
      </div>
      <div className="score__ends"><span>양호</span><span>위험</span></div>
    </div>
  );
}

/** M4 제출 확인 (아래에서 올라오는 시트) : 요약 · 항목별 점수 */
function SubmitSheet({ rec, onCancel, onSubmit, saving }: { rec: FieldRecord; onCancel: () => void; onSubmit: () => void; saving: string | null }) {
  const { state } = useStore();
  const b = state.buildings[rec.buildingId];
  const answered = SECTIONS.reduce((n, s) => n + s.items.filter((it) => rec.scores[it.key] != null).length, 0);
  const secs = SECTIONS.map((s) => {
    const max = s.items.length * 5;
    const sum = s.items.reduce((n, it) => n + (rec.scores[it.key] ?? 0), 0);
    return { key: s.key, title: s.title, sum, max };
  });
  const total = secs.reduce((n, s) => n + s.sum, 0);
  const totalMax = secs.reduce((n, s) => n + s.max, 0);

  return (
    <Sheet onDismiss={onCancel} title="확인 결과를 제출할까요?" desc="제출하면 그룹 진행률과 분석 지도 점수에 바로 반영돼요." className="submit">
      <dl className="submit__sum">
        <div><dt>건물</dt><dd>{b.gu} {b.dong}</dd></div>
        <div><dt>점검 항목</dt><dd>{ITEM_COUNT}개 중 {answered}개 완료</dd></div>
        <div><dt>거주자 · 지원</dt><dd>{rec.resident ?? '-'} · 지원 {rec.supports.length}건</dd></div>
        <div><dt>사진 · 메모</dt><dd>사진 {rec.photos.length}장 · 메모 {rec.memo.trim() ? '있음' : '없음'}</dd></div>
      </dl>

      <div className="submit__scores">
        <div className="submit__sh">
          <div>
            <p className="submit__h">항목별 점수</p>
            <p className="submit__hd">점수가 높을수록 위험도가 높아요.</p>
          </div>
          <p className="submit__total">합계 <b>{total}</b> / {totalMax}</p>
        </div>
        <div className="submit__bars">
          {secs.map((s) => (
            <div key={s.key} className={`sbar is-${tone(s.sum, s.max)}`}>
              <p className="sbar__top"><span>{s.title}</span><b>{s.sum}</b><small>/ {s.max}</small></p>
              <span className="sbar__track"><i style={{ width: `${(s.sum / s.max) * 100}%` }} /></span>
            </div>
          ))}
        </div>
      </div>

      <div className="sheet__btns">
        <Btn onClick={onCancel}>취소</Btn>
        <Btn variant={saving ? 'disabled' : 'primary'} disabled={!!saving} onClick={onSubmit}>{saving ?? '제출하기'}</Btn>
      </div>
    </Sheet>
  );
}
