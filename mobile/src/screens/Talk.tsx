// M7 현장 소통지원 : 주민과 짧게 이야기할 때 쓰는 보조 도구 (대화 내용은 저장하지 않음)
//   입력 번역 | 자주 쓰는 표현
//   입력 번역 = 문장 직접 입력(언어 두 개 · 바꾸기 · 마이크 · 글씨 크게 보기) → 번역하기 → 결과 카드
//   자주 쓰는 표현 = 준비된 문장을 누르면 결과 카드에 그 언어로
//   결과 카드 = 번역문 + 한글 발음, 복사 · 읽어주기(폰 음성 합성) · 큰 글씨. 처음엔 다국어 안내 문구가 보인다
import { useRef, useState } from 'react';
import { useStore } from '../store/AppStore';
import { Ico } from '../components/figma';
import { Screen, Segment, TabBar } from '../components/ui';
import { ALL_LANGS, LANGS, PHRASES, langCode, langName, phraseIn, ttsCode, type AnyLang } from '../data/talk';
import { translate } from '../lib/translate';
import './Talk.css';

/** 결과 카드에 보일 것 : 준비된 표현(언어를 바꾸면 따라 바뀜) 또는 직접 번역한 문장 */
type Src = { kind: 'phrase'; idx: number } | { kind: 'free'; text: string; pron?: string; lang: AnyLang };
interface Big { text: string; pron?: string; lang: AnyLang }

export default function Talk() {
  const { state, act } = useStore();
  const [mode, setMode] = useState<'input' | 'phrase'>('input');
  const [from, setFrom] = useState<AnyLang>('ko');
  const [to, setTo] = useState<AnyLang>('zh');
  const [text, setText] = useState('');
  const [src, setSrc] = useState<Src>({ kind: 'phrase', idx: 0 });
  const [busy, setBusy] = useState(false);
  const [large, setLarge] = useState<Big | null>(null);
  const [listening, setListening] = useState(false);
  const recog = useRef<{ stop: () => void } | null>(null);

  const out: Big = src.kind === 'phrase' ? { ...phraseIn(PHRASES[src.idx], to), lang: to } : src;

  const changeMode = (m: 'input' | 'phrase') => {
    setMode(m);
    // 자주 쓰는 표현은 한국어 → 외국어로 보여준다
    if (m === 'phrase' && to === 'ko') { setTo(from === 'ko' ? 'zh' : from); setFrom('ko'); }
  };

  const run = async () => {
    if (!text.trim()) { act.toast('번역할 내용을 입력해 주세요.'); return; }
    if (busy) return;
    setBusy(true);
    try {
      const r = await translate(text, from, to);
      setSrc({ kind: 'free', ...r, lang: to });
    } catch (e) {
      act.toast(e instanceof Error ? e.message : '번역하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };
  const speak = (s: string, l: AnyLang) => {
    if (!s.trim()) return;
    if (!('speechSynthesis' in window)) { act.toast('이 기기에서는 읽어주기를 쓸 수 없어요.'); return; }
    const u = new SpeechSynthesisUtterance(s);
    u.lang = ttsCode(l);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(out.text); act.toast('복사했어요.'); } catch { act.toast('복사하지 못했어요.'); }
  };
  // 음성 입력 : 브라우저 음성 인식이 있는 기기에서만 (없으면 안내)
  const listen = () => {
    if (listening) { recog.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { act.toast('이 기기에서는 음성 입력을 쓸 수 없어요. 키보드의 마이크를 써 주세요.'); return; }
    const r = new Ctor();
    r.lang = ttsCode(from);
    r.interimResults = false;
    r.onresult = (e) => {
      const said = Array.from(e.results).map((x) => x[0].transcript).join(' ');
      setText((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}${said}`.slice(0, 450));
    };
    r.onend = () => { setListening(false); recog.current = null; };
    r.onerror = () => { setListening(false); recog.current = null; };
    recog.current = r;
    setListening(true);
    r.start();
  };

  const langSelect = (value: AnyLang, onChange: (l: AnyLang) => void, label: string, langs: AnyLang[] = ALL_LANGS) => (
    <label className="talk__sel">
      <select value={value} onChange={(e) => onChange(e.target.value as AnyLang)} aria-label={label}>
        {langs.map((l) => <option key={l} value={l}>{langName(l)}</option>)}
      </select>
      <Ico name="chevDown18" size={18} />
    </label>
  );

  return (
    <Screen title="소통지원" right={state.mode === 'demo' ? <span className="talk__demo">시연</span> : undefined} className="talk">
      <p className="talk__lock"><Ico name="lock" size={18} />대화 내용은 저장하지 않아요</p>

      <Segment
        value={mode}
        onChange={changeMode}
        options={[{ key: 'input', label: '입력 번역' }, { key: 'phrase', label: '자주 쓰는 표현' }]}
      />

      {mode === 'input' && (
        <section className="card talk__in">
          <div className="talk__head">
            <h2>문장 직접 입력</h2>
            <button className="minibtn" onClick={() => (text.trim() ? setLarge({ text: text.trim(), lang: from }) : act.toast('크게 볼 문장을 입력해 주세요.'))}>
              <Ico name="expand" size={14} />글씨 크게 보기
            </button>
          </div>
          <div className="talk__pair">
            {langSelect(from, setFrom, '원문 언어')}
            <button className="talk__swap" onClick={() => { setFrom(to); setTo(from); }} aria-label="언어 바꾸기"><Ico name="swap" size={22} /></button>
            {langSelect(to, setTo, '번역 언어')}
          </div>
          <div className="talk__box">
            <textarea className="talk__input" maxLength={450} value={text} onChange={(e) => setText(e.target.value)} placeholder="번역할 내용을 입력하세요" lang={langCode(from)} />
            <span className="talk__count">{text.length} / 450</span>
            <button className={`talk__mic ${listening ? 'is-on' : ''}`} onClick={listen} aria-label={listening ? '음성 입력 멈추기' : '음성으로 입력'}><Ico name="mic" size={18} /></button>
          </div>
          <button className="btn btn--primary talk__go" onClick={run} disabled={busy}>{busy ? '번역하는 중…' : '번역하기'}</button>
        </section>
      )}

      {mode === 'phrase' && (
        <section className="card talk__in">
          <div className="talk__head">
            <h2>자주 쓰는 표현</h2>
          </div>
          <div className="talk__pair">
            {langSelect(to, setTo, '보여줄 언어', LANGS.map((l) => l.key))}
          </div>
          <ul className="talk__phrases">
            {PHRASES.map((p, i) => {
              const on = src.kind === 'phrase' && src.idx === i;
              return (
                <li key={p.text.ko}>
                  <button className={`talk__phrase ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => setSrc({ kind: 'phrase', idx: i })}>
                    {p.text.ko}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card talk__out" aria-live="polite">
        <div className="talk__res">
          <p className="talk__tr" lang={langCode(out.lang)}>{out.text}</p>
          {out.pron && <p className="talk__pron">{out.pron}</p>}
        </div>
        <div className="talk__tools">
          <button className="btn btn--ghost" onClick={copy}><Ico name="copy" size={18} />복사</button>
          <button className="btn btn--ghost" onClick={() => speak(out.text, out.lang)}><Ico name="volume" size={18} />읽어주기</button>
          <button className="btn btn--ghost" onClick={() => setLarge(out)}><Ico name="text" size={18} />큰 글씨</button>
        </div>
      </section>

      <p className="talk__notice">
        <Ico name="infoSub" size={16} />
        <span>이름·주소·연락처 같은 개인정보는 입력하지 마세요. 입력한 문장은 외부 번역 서비스로 보내질 수 있어요.</span>
      </p>

      {large && (
        <button className="talk__large" onClick={() => setLarge(null)} aria-label="닫기">
          <span lang={langCode(large.lang)}>{large.text}</span>
          {large.pron && <em>{large.pron}</em>}
          <small>화면을 누르면 닫혀요</small>
        </button>
      )}
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
