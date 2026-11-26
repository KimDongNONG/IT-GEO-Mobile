// M7 현장 소통지원 : 주민과 짧게 이야기할 때 쓰는 보조 도구 (대화 내용은 저장하지 않음)
//   맨 위 고정 = 노란 안내 '대화 내용은 저장하지 않습니다.'
//   번역 · 현장 표현 탭 : 다국어 안내 카드 → 한 카드 안에서 문장 번역(번역 결과는 스피커로 들려주기) + 자주 쓰는 현장 표현
//   큰 글씨 탭 : 다른 창 없이 작성 칸에 바로 큰 글씨로 쓴다. 칸 위 버튼으로 보통 · 크게 · 더 크게 · 매우 크게
//   번역 = 앱은 기기 안 번역(ML Kit), 브라우저는 현장 표현 사전에 있는 문장만 (lib/talk.ts)
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/AppStore';
import { Ico } from '../components/figma';
import { Screen, Segment, TabBar } from '../components/ui';
import { ALL, INTRO, LANGS, PHRASES, canTranslateOnDevice, langName, papagoCode, papagoUrl, speak, speechCode, translate, type Any, type Lang } from '../lib/talk';
import './Talk.css';

const MAX = 450;
const SIZES = [
  { key: 'm', label: '보통', px: 22 },
  { key: 'l', label: '크게', px: 30 },
  { key: 'xl', label: '더 크게', px: 40 },
  { key: 'xxl', label: '매우 크게', px: 54 },
] as const;
type SizeKey = (typeof SIZES)[number]['key'];
const SIZE_KEY = 'itgeo.mobile.talk.size';   // 고른 글씨 크기 (폰에만 저장)

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
  const [size, setSize] = useState<SizeKey>(() => {
    try { return (localStorage.getItem(SIZE_KEY) as SizeKey) || 'l'; } catch { return 'l'; }
  });
  const [listening, setListening] = useState(false);
  const recog = useRef<{ stop: () => void } | null>(null);
  useEffect(() => { try { localStorage.setItem(SIZE_KEY, size); } catch { /* 무시 */ } }, [size]);
  useEffect(() => () => { recog.current?.stop(); }, []);

  const say = (s: string, l: Any) => { speak(s, l).catch((e) => act.toast(e instanceof Error ? e.message : '읽어주지 못했어요.')); };

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

  // 음성 입력 : 브라우저 음성 인식이 있는 기기에서만 (없으면 안내)
  const listen = () => {
    if (listening) { recog.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { act.toast('이 기기에서는 음성 입력을 쓸 수 없어요. 키보드의 마이크를 써 주세요.'); return; }
    const r = new Ctor();
    r.lang = speechCode(from);
    r.interimResults = false;
    r.onresult = (e) => {
      const said = Array.from(e.results).map((x) => x[0].transcript).join(' ');
      setText((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}${said}`.slice(0, MAX));
    };
    r.onend = () => { setListening(false); recog.current = null; };
    r.onerror = () => { setListening(false); recog.current = null; };
    recog.current = r;
    setListening(true);
    r.start();
  };

  // 현장 표현을 누르면 : 번역 결과 칸에 넣고 바로 들려준다
  const pickPhrase = (p: Record<Any, string>) => {
    setFrom('ko'); setTo(lang); setText(p.ko); setNoTr(false); setOut({ text: p[lang], lang });
    say(p[lang], lang);
  };
  const toLarge = (s: string) => { setBig(s); setMode('large'); window.scrollTo({ top: 0 }); };
  const copy = async (s: string) => {
    try { await navigator.clipboard.writeText(s); act.toast('복사했어요.'); } catch { act.toast('복사하지 못했어요.'); }
  };

  const chips = LANGS.filter((l) => !l.more || more || l.key === lang);
  const px = SIZES.find((s) => s.key === size)!.px;

  return (
    <Screen title="소통지원" right={state.mode === 'demo' ? <span className="talk__demo">시연</span> : undefined} className="talk">
      <p className="talk__lock" role="note"><Ico name="lock" size={18} />대화 내용은 저장하지 않습니다.</p>

      <Segment
        value={mode}
        onChange={setMode}
        options={[{ key: 'tr', label: '번역 · 현장 표현' }, { key: 'large', label: '큰 글씨' }]}
      />

      {mode === 'tr' && (
        <>
          <section className="card talk__card">
            <div className="talk__card-head">
              <h2>다국어 안내 카드</h2>
              <button className="talk__speak" onClick={() => say(INTRO[lang], lang)} aria-label="안내 문장 들려주기"><Ico name="volume" size={22} /></button>
            </div>
            <p className="talk__ko">{INTRO.ko}</p>
            <hr className="divider" />
            <p className="talk__tr" lang={papagoCode(lang)}>{INTRO[lang]}</p>
            <div className="talk__langs">
              {chips.map((l) => (
                <button key={l.key} className={`pill ${lang === l.key ? 'is-on' : ''}`} onClick={() => { setLang(l.key); if (from === 'ko') setTo(l.key); }}>{l.label}</button>
              ))}
              <button className="pill" aria-expanded={more} onClick={() => setMore((v) => !v)}>{more ? '접기' : '더보기'}</button>
            </div>
            <button className="talk__link" onClick={() => toLarge(INTRO[lang])}><Ico name="text" size={18} />큰 글씨 탭에서 보여주기</button>
          </section>

          {/* 번역 + 현장 표현 : 번역한 내용과 현장 표현 모두 스피커로 바로 들려준다 */}
          <section className="card talk__card">
            <h2 className="talk__h">번역하고 들려주기</h2>
            <div className="talk__pair">
              <label className="talk__sel">
                <select value={from} onChange={(e) => setFrom(e.target.value as Any)} aria-label="원문 언어">
                  {ALL.map((l) => <option key={l} value={l}>{langName(l)}</option>)}
                </select>
                <Ico name="chevDown18" size={18} />
              </label>
              <button className="talk__swap" onClick={() => { setFrom(to); setTo(from); if (out) { setText(out.text); setOut(null); } }} aria-label="언어 바꾸기"><Ico name="swap" size={24} /></button>
              <label className="talk__sel">
                <select value={to} onChange={(e) => setTo(e.target.value as Any)} aria-label="번역 언어">
                  {ALL.map((l) => <option key={l} value={l}>{langName(l)}</option>)}
                </select>
                <Ico name="chevDown18" size={18} />
              </label>
            </div>
            <div className="talk__box">
              <textarea className="talk__input" maxLength={MAX} value={text} onChange={(e) => { setText(e.target.value); setNoTr(false); }} placeholder="번역할 내용을 입력하세요" aria-label="번역할 내용" />
              <span className="talk__count">{text.length} / {MAX}</span>
              <button className={`talk__mic ${listening ? 'is-on' : ''}`} onClick={listen} aria-label={listening ? '음성 입력 멈추기' : '음성으로 입력'} aria-pressed={listening}><Ico name="mic" size={20} /></button>
            </div>
            <button className="btn btn--primary talk__go" onClick={doTranslate} disabled={!!busy}>{busy ?? '번역하기'}</button>

            {out && (
              <div className="talk__out" aria-live="polite">
                <div className="talk__out-head">
                  <span>{langName(out.lang)}</span>
                  <button className="talk__speak talk__speak--big" onClick={() => say(out.text, out.lang)} aria-label="번역한 내용 들려주기"><Ico name="volume" size={26} /></button>
                </div>
                <p className="talk__out-tx" lang={papagoCode(out.lang)}>{out.text}</p>
                <div className="talk__tools">
                  <button className="btn btn--line" onClick={() => copy(out.text)}><Ico name="copy" size={18} />복사</button>
                  <button className="btn btn--line" onClick={() => toLarge(out.text)}><Ico name="text" size={18} />큰 글씨로</button>
                </div>
              </div>
            )}
            {noTr && (
              <div className="talk__out talk__out--none">
                <p>이 화면(브라우저)에서는 현장 표현에 있는 문장만 바로 번역돼요. 앱에서는 기기 안에서 번역하고 스피커로 들려줘요.</p>
                <button className="btn btn--line" onClick={() => window.open(papagoUrl(from, to, text), '_blank', 'noopener')}>파파고에서 번역하기</button>
              </div>
            )}

            <hr className="divider" />
            <h3 className="talk__sub">자주 쓰는 현장 표현 <small>{LANGS.find((l) => l.key === lang)!.name}</small></h3>
            <ul className="talk__phrases">
              {PHRASES.map((p) => (
                <li key={p.ko}>
                  <button className="talk__phrase" onClick={() => pickPhrase(p)}>
                    <span>{p.ko}</span>
                    <small lang={papagoCode(lang)}>{p[lang]}</small>
                  </button>
                  <button className="talk__speak" onClick={() => say(p[lang], lang)} aria-label="들려주기"><Ico name="volume" size={22} /></button>
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
        <Ico name="infoSub" size={18} />
        <span>이름·주소·연락처 같은 개인정보는 입력하지 마세요. {canTranslateOnDevice() ? '번역은 기기 안에서 해요.' : '사전에 없는 문장은 외부 번역(파파고) 화면에서 열려요.'}</span>
      </p>
      <TabBar />
    </Screen>
  );
}

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
}
