// M7 소통지원 : 주민과 짧게 이야기할 때 쓰는 도구 (대화 내용은 저장하지 않음)
//   맨 위 고정 = 노란 안내 '대화 내용은 저장하지 않습니다.'
//   번역 탭 : 다국어 안내 카드 → 문장 입력(언어 · 바꾸기 · 0 / 450 · 음성 입력 · 번역하기) → 번역 결과(스피커로 들려주기)
//             → 자주 쓰는 현장 표현 (누르면 번역 결과로, 스피커로 바로 들려주기)
//   큰 글씨 탭 : 작성 칸에 바로 큰 글씨로 쓴다. 칸 위 버튼으로 보통 · 크게 · 더 크게 · 매우 크게
import { useEffect, useRef, useState } from 'react';
import { Screen, TabBar } from '../components/ui';
import { useStore } from '../store/AppStore';
import { IconDown } from '../components/icons';
import { canDictate, startDictation, type Dictation } from '../lib/speech';
import { ALL, INTRO, LANGS, PHRASES, canTranslateOnDevice, langName, papagoCode, papagoUrl, speak, speechCode, translate, type Any, type Lang } from '../lib/talk';
import './Talk.css';

const MAX = 450;
const SIZES = [{ key: 'm', label: '보통', px: 22 }, { key: 'l', label: '크게', px: 30 }, { key: 'xl', label: '더 크게', px: 40 }, { key: 'xxl', label: '매우 크게', px: 54 }] as const;
type SizeKey = (typeof SIZES)[number]['key'];
const SIZE_KEY = 'itgeo.mobile.talk.size';

const IcoSpeaker = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

export default function Talk() {
  const { state, act } = useStore();
  const [mode, setMode] = useState<'tr' | 'large'>('tr');
  const [lang, setLang] = useState<Lang>('zh');
  const [more, setMore] = useState(false);
  const [from, setFrom] = useState<Any>('ko');
  const [to, setTo] = useState<Any>('zh');
  const [text, setText] = useState('');
  const [out, setOut] = useState<{ text: string; lang: Any } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [noTr, setNoTr] = useState(false);          // 브라우저 : 사전에 없는 문장 → 파파고 안내
  const [big, setBig] = useState('');
  const [size, setSize] = useState<SizeKey>(() => { try { return (localStorage.getItem(SIZE_KEY) as SizeKey) || 'l'; } catch { return 'l'; } });
  const [listening, setListening] = useState(false);
  const dict = useRef<Dictation | null>(null);
  useEffect(() => () => { dict.current?.stop(); }, []);
  useEffect(() => { try { localStorage.setItem(SIZE_KEY, size); } catch { /* 무시 */ } }, [size]);

  const say = (s: string, l: Any) => speak(s, l).catch((e) => act.toast(e instanceof Error ? e.message : '읽어주지 못했어요.'));
  const doTranslate = async () => {
    if (!text.trim()) { act.toast('번역할 내용을 입력해 주세요.'); return; }
    setBusy('번역하는 중…'); setNoTr(false);
    try {
      const r = await translate(text, from, to, () => setBusy('번역 모델을 내려받는 중… (언어마다 처음 한 번)'));
      if (r == null) { setOut(null); setNoTr(true); } else setOut({ text: r, lang: to });
    } catch {
      act.toast('번역하지 못했어요. 인터넷 연결을 확인해 주세요. (처음에는 번역 모델을 내려받아야 해요)');
    } finally { setBusy(null); }
  };
  const mic = async () => {
    if (listening) { await dict.current?.stop(); dict.current = null; setListening(false); return; }
    if (!canDictate()) { act.toast('이 기기에서는 음성 입력을 쓸 수 없어요. 키보드의 마이크를 써 주세요.'); return; }
    try {
      dict.current = await startDictation(speechCode(from), {
        onFinal: (t) => setText((x) => `${x}${x && !x.endsWith(' ') ? ' ' : ''}${t}`.slice(0, MAX)),
        onEnd: () => setListening(false),
        onError: (m) => act.toast(m),
      });
      setListening(true);
    } catch (e) { act.toast(e instanceof Error ? e.message : '음성 입력을 시작하지 못했어요.'); }
  };
  const pickPhrase = (p: Record<Any, string>) => {
    setFrom('ko'); setTo(lang); setText(p.ko); setNoTr(false); setOut({ text: p[lang], lang });
    say(p[lang], lang);
  };
  const toLarge = (s: string) => { setBig(s); setMode('large'); window.scrollTo({ top: 0 }); };
  const chips = LANGS.filter((l) => !l.more || more || l.key === lang);
  const px = SIZES.find((s) => s.key === size)!.px;

  return (
    <Screen title="소통지원" right={state.mode === 'server' ? undefined : <span className="talk__demo">시연</span>} className="talk">
      <p className="talk__lock" role="note">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
        대화 내용은 저장하지 않습니다.
      </p>

      <div className="talk__modes" role="tablist">
        {([['tr', '번역 · 현장 표현'], ['large', '큰 글씨']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? 'is-on' : ''} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>

      {mode === 'tr' && (
        <>
          <section className="card talk__card">
            <div className="talk__card-head">
              <h2>다국어 안내 카드</h2>
              <button className="talk__icon" onClick={() => say(INTRO[lang], lang)} aria-label="안내 문장 들려주기"><IcoSpeaker /></button>
            </div>
            <p className="talk__intro-ko">{INTRO.ko}</p>
            <p className="talk__intro-tr" lang={papagoCode(lang)}>{INTRO[lang]}</p>
            <div className="talk__langs">
              {chips.map((l) => (
                <button key={l.key} className={lang === l.key ? 'is-on' : ''} onClick={() => { setLang(l.key); if (from === 'ko') setTo(l.key); }}>{l.label}</button>
              ))}
              <button className="talk__more" aria-expanded={more} onClick={() => setMore((v) => !v)}>{more ? '접기' : '더보기'}</button>
            </div>
            <button className="talk__link" onClick={() => toLarge(INTRO[lang])}>큰 글씨 탭에서 보여주기 ›</button>
          </section>

          <section className="card talk__card">
            <h2 className="talk__h">문장 번역</h2>
            <div className="talk__pair">
              <label className="talk__select">
                <select value={from} onChange={(e) => setFrom(e.target.value as Any)} aria-label="원문 언어">
                  {ALL.map((l) => <option key={l} value={l}>{langName(l)}</option>)}
                </select>
                <IconDown />
              </label>
              <button className="talk__swap" onClick={() => { setFrom(to); setTo(from); if (out) { setText(out.text); setOut(null); } }} aria-label="언어 바꾸기">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 8h15l-4-4M20 16H5l4 4" /></svg>
              </button>
              <label className="talk__select">
                <select value={to} onChange={(e) => setTo(e.target.value as Any)} aria-label="번역 언어">
                  {ALL.map((l) => <option key={l} value={l}>{langName(l)}</option>)}
                </select>
                <IconDown />
              </label>
            </div>
            <div className="talk__box">
              <textarea className="talk__input" maxLength={MAX} value={text} onChange={(e) => { setText(e.target.value); setNoTr(false); }} placeholder="번역할 내용을 입력하세요" aria-label="번역할 내용" />
              <div className="talk__box-foot">
                <span>{text.length} / {MAX}</span>
                <button className={`talk__mic ${listening ? 'is-on' : ''}`} onClick={mic} aria-label={listening ? '음성 입력 멈추기' : '음성으로 입력'} aria-pressed={listening}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5" /></svg>
                </button>
              </div>
            </div>
            <button className="talk__go" onClick={doTranslate} disabled={!!busy}>{busy ?? '번역하기'}</button>

            {out && (
              <div className="talk__out" aria-live="polite">
                <div className="talk__out-head">
                  <span>{langName(out.lang)}</span>
                  <button className="talk__icon talk__icon--big" onClick={() => say(out.text, out.lang)} aria-label="번역한 내용 들려주기"><IcoSpeaker /></button>
                </div>
                <p lang={papagoCode(out.lang)}>{out.text}</p>
                <div className="talk__tools">
                  <button onClick={() => { navigator.clipboard?.writeText(out.text); act.toast('복사했어요.'); }}>복사</button>
                  <button onClick={() => toLarge(out.text)}>큰 글씨로</button>
                </div>
              </div>
            )}
            {noTr && (
              <div className="talk__out talk__out--none">
                <p>이 화면(브라우저)에서는 현장 표현에 있는 문장만 바로 번역돼요. 앱에서는 기기 안에서 번역하고 스피커로 들려줘요.</p>
                <button onClick={() => window.open(papagoUrl(from, to, text), '_blank', 'noopener')}>파파고에서 번역하기 ↗</button>
              </div>
            )}
          </section>

          <section className="card talk__card">
            <h2 className="talk__h">자주 쓰는 현장 표현 <small>{LANGS.find((l) => l.key === lang)!.name}</small></h2>
            <ul className="talk__phrases">
              {PHRASES.map((p) => (
                <li key={p.ko}>
                  <button onClick={() => pickPhrase(p)}>
                    <span>{p.ko}</span>
                    <span className="talk__phrase-tr" lang={papagoCode(lang)}>{p[lang]}</span>
                  </button>
                  <button className="talk__icon" onClick={() => say(p[lang], lang)} aria-label="들려주기"><IcoSpeaker /></button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {mode === 'large' && (
        <section className="card talk__card">
          <h2 className="talk__h">큰 글씨로 쓰기</h2>
          <div className="talk__sizes" role="radiogroup" aria-label="글씨 크기">
            {SIZES.map((s) => (
              <button key={s.key} role="radio" aria-checked={size === s.key} className={size === s.key ? 'is-on' : ''} onClick={() => setSize(s.key)}>{s.label}</button>
            ))}
          </div>
          <textarea
            className="talk__big"
            style={{ fontSize: px }}
            maxLength={MAX}
            value={big}
            onChange={(e) => setBig(e.target.value)}
            placeholder="주민에게 보여줄 문장을 쓰세요"
            aria-label="큰 글씨로 쓰기"
          />
          <div className="talk__big-foot">
            <span>{big.length} / {MAX}</span>
            <button onClick={() => setBig('')} disabled={!big}>지우기</button>
          </div>
        </section>
      )}

      <p className="talk__notice">
        이름·주소·연락처 등 개인정보는 입력하지 마세요. {canTranslateOnDevice() ? '번역은 기기 안에서 하고' : '번역은 외부 번역 화면에서 열리며'} 이 앱은 대화 내용을 저장하지 않습니다. 전문 통역·수어통역을 대체하지 않습니다.
      </p>
      <TabBar />
    </Screen>
  );
}
