// M7 현장 소통지원 : 주민과 짧게 이야기할 때 쓰는 보조 도구 (대화 내용은 저장하지 않음)
//   입력 번역 | 현장 표현 | 큰 글씨, 다국어 안내 카드(크게 보여주기 · 언어 칩 · 더보기)
//   번역은 외부 번역(파파고) 페이지를 연다. 읽어주기 = 폰의 음성 합성, 마이크 = 음성 입력(되는 기기에서만)
import { useRef, useState } from 'react';
import { useStore } from '../store/AppStore';
import { Ico } from '../components/figma';
import { Screen, Segment, TabBar } from '../components/ui';
import './Talk.css';

type Lang = 'zh' | 'vi' | 'en' | 'ja' | 'ru' | 'th';
type Any = 'ko' | Lang;
const LANGS: { key: Lang; label: string; name: string; papago: string; tts: string }[] = [
  { key: 'zh', label: '中文', name: '중국어(간체)', papago: 'zh-CN', tts: 'zh-CN' },
  { key: 'vi', label: 'Tiếng Việt', name: '베트남어', papago: 'vi', tts: 'vi-VN' },
  { key: 'en', label: 'English', name: '영어', papago: 'en', tts: 'en-US' },
  { key: 'ja', label: '日本語', name: '일본어', papago: 'ja', tts: 'ja-JP' },
  { key: 'ru', label: 'Русский', name: '러시아어', papago: 'ru', tts: 'ru-RU' },
  { key: 'th', label: 'ไทย', name: '태국어', papago: 'th', tts: 'th-TH' },
];
const MAIN_LANGS = 3;   // 칩 줄에 처음 보이는 언어 수 (나머지는 '더보기')

const INTRO: Record<Any, string> = {
  ko: '구청에서 건물 상태를 확인하러 왔습니다. 이름이나 개인정보는 묻지 않습니다.',
  zh: '我们是区政府的工作人员，来确认建筑状况。不会询问姓名或个人信息。',
  vi: 'Chúng tôi đến từ văn phòng quận để kiểm tra tình trạng tòa nhà. Chúng tôi sẽ không hỏi tên hay thông tin cá nhân.',
  en: 'We are from the district office to check the building condition. We will not ask for your name or personal information.',
  ja: '区役所から建物の状態を確認しに来ました。お名前や個人情報はお聞きしません。',
  ru: 'Мы из районной администрации и пришли проверить состояние здания. Мы не спрашиваем имя и личные данные.',
  th: 'เราเป็นเจ้าหน้าที่จากสำนักงานเขต มาตรวจสอบสภาพอาคาร จะไม่ถามชื่อหรือข้อมูลส่วนตัว',
};

const PHRASES: Record<Any, string>[] = [
  { ko: '집 안에 물이 샌 적이 있나요?', zh: '家里漏过水吗？', vi: 'Nhà bạn đã từng bị dột nước chưa?', en: 'Has water ever leaked inside your home?', ja: '家の中で水漏れしたことはありますか？', ru: 'В доме когда-нибудь протекала вода?', th: 'เคยมีน้ำรั่วในบ้านไหม' },
  { ko: '혼자 사시나요?', zh: '您一个人住吗？', vi: 'Bạn sống một mình phải không?', en: 'Do you live alone?', ja: 'お一人でお住まいですか？', ru: 'Вы живёте один?', th: 'คุณอาศัยอยู่คนเดียวหรือไม่' },
  { ko: '도움이 필요하면 구청으로 연락 주세요.', zh: '如需帮助，请联系区政府。', vi: 'Nếu cần giúp đỡ, hãy liên hệ văn phòng quận.', en: 'Please contact the district office if you need help.', ja: 'お困りのことがあれば区役所にご連絡ください。', ru: 'Если нужна помощь, обратитесь в районную администрацию.', th: 'หากต้องการความช่วยเหลือ กรุณาติดต่อสำนักงานเขต' },
  { ko: '사진을 찍어도 될까요? 얼굴은 찍지 않습니다.', zh: '可以拍照吗？不会拍脸。', vi: 'Tôi có thể chụp ảnh không? Tôi sẽ không chụp mặt.', en: 'May I take a photo? I will not photograph faces.', ja: '写真を撮ってもいいですか？顔は撮りません。', ru: 'Можно сфотографировать? Лица снимать не будем.', th: 'ขอถ่ายรูปได้ไหม จะไม่ถ่ายใบหน้า' },
];

const langOf = (l: Any) => LANGS.find((x) => x.key === l);
const langName = (l: Any) => (l === 'ko' ? '한국어' : langOf(l)!.name);
const papagoCode = (l: Any) => (l === 'ko' ? 'ko' : langOf(l)!.papago);
const ttsCode = (l: Any) => (l === 'ko' ? 'ko-KR' : langOf(l)!.tts);
const ALL: Any[] = ['ko', ...LANGS.map((l) => l.key)];

export default function Talk() {
  const { state, act } = useStore();
  const [mode, setMode] = useState<'input' | 'phrase' | 'large'>('input');
  const [lang, setLang] = useState<Lang>('zh');
  const [more, setMore] = useState(false);
  const [from, setFrom] = useState<Any>('ko');
  const [to, setTo] = useState<Any>('zh');
  const [text, setText] = useState('');
  const [large, setLarge] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recog = useRef<{ stop: () => void } | null>(null);

  const translate = () => {
    if (!text.trim()) { act.toast('번역할 내용을 입력해 주세요.'); return; }
    const url = `https://papago.naver.com/?sk=${papagoCode(from)}&tk=${papagoCode(to)}&st=${encodeURIComponent(text.trim())}`;
    window.open(url, '_blank', 'noopener');
  };
  const speak = (s: string, l: Any) => {
    if (!s.trim()) return;
    if (!('speechSynthesis' in window)) { act.toast('이 기기에서는 읽어주기를 쓸 수 없어요.'); return; }
    const u = new SpeechSynthesisUtterance(s);
    u.lang = ttsCode(l);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };
  const copy = async () => {
    if (!text.trim()) return;
    try { await navigator.clipboard.writeText(text); act.toast('복사했어요.'); } catch { act.toast('복사하지 못했어요.'); }
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

  const chips = more ? LANGS : LANGS.slice(0, MAIN_LANGS);

  return (
    <Screen title="소통지원" right={state.mode === 'demo' ? <span className="talk__demo">시연</span> : undefined} className="talk">
      <p className="talk__lock"><Ico name="lock" size={18} />대화 내용은 저장하지 않아요</p>

      <Segment
        value={mode}
        onChange={setMode}
        options={[{ key: 'input', label: '입력 번역' }, { key: 'phrase', label: '현장 표현' }, { key: 'large', label: '큰 글씨' }]}
      />

      <section className="card talk__card">
        <div className="talk__card-head">
          <h2>다국어 안내 카드</h2>
          <button className="minibtn" onClick={() => setLarge(INTRO[lang])}><Ico name="expand" size={14} />크게 보여주기</button>
        </div>
        <p className="talk__ko">{INTRO.ko}</p>
        <hr className="divider" />
        <p className="talk__tr" lang={papagoCode(lang)}>{INTRO[lang]}</p>
        <div className="talk__langs">
          {chips.map((l) => (
            <button key={l.key} className={`pill ${lang === l.key ? 'is-on' : ''}`} onClick={() => setLang(l.key)}>{l.label}</button>
          ))}
          <button className="pill" onClick={() => setMore((v) => !v)}>{more ? '접기' : '더보기'}</button>
        </div>
      </section>

      {mode === 'input' && (
        <section className="card talk__card">
          <h2 className="talk__h">문장 직접 입력</h2>
          <div className="talk__pair">
            <label className="talk__sel">
              <select value={from} onChange={(e) => setFrom(e.target.value as Any)} aria-label="원문 언어">
                {ALL.map((l) => <option key={l} value={l}>{langName(l)}</option>)}
              </select>
              <Ico name="chevDown18" size={18} />
            </label>
            <button className="talk__swap" onClick={() => { setFrom(to); setTo(from); }} aria-label="언어 바꾸기"><Ico name="swap" size={22} /></button>
            <label className="talk__sel">
              <select value={to} onChange={(e) => setTo(e.target.value as Any)} aria-label="번역 언어">
                {ALL.map((l) => <option key={l} value={l}>{langName(l)}</option>)}
              </select>
              <Ico name="chevDown18" size={18} />
            </label>
          </div>
          <div className="talk__box">
            <textarea className="talk__input" maxLength={450} value={text} onChange={(e) => setText(e.target.value)} placeholder="번역할 내용을 입력하세요" />
            <span className="talk__count">{text.length} / 450</span>
            <button className={`talk__mic ${listening ? 'is-on' : ''}`} onClick={listen} aria-label={listening ? '음성 입력 멈추기' : '음성으로 입력'}><Ico name="mic" size={18} /></button>
          </div>
          <button className="btn btn--primary talk__go" onClick={translate}>번역하기</button>
          <div className="talk__tools">
            <button className="btn btn--ghost" onClick={copy}><Ico name="copy" size={18} />복사</button>
            <button className="btn btn--ghost" onClick={() => speak(text, from)}><Ico name="volume" size={18} />읽어주기</button>
            <button className="btn btn--ghost" onClick={() => text.trim() && setLarge(text)}><Ico name="text" size={18} />큰 글씨</button>
          </div>
        </section>
      )}

      {mode === 'phrase' && (
        <section className="card talk__card">
          <h2 className="talk__h">자주 쓰는 현장 표현</h2>
          <ul className="talk__phrases">
            {PHRASES.map((p) => (
              <li key={p.ko}>
                <button className="talk__phrase" onClick={() => setLarge(p[lang])}>
                  <span>{p.ko}</span>
                  <small lang={papagoCode(lang)}>{p[lang]}</small>
                </button>
                <button className="talk__speak" onClick={() => speak(p[lang], lang)} aria-label="읽어주기"><Ico name="volume" size={18} /></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mode === 'large' && (
        <section className="card talk__card">
          <h2 className="talk__h">큰 글씨로 보여주기</h2>
          <div className="talk__box">
            <textarea className="talk__input" value={text} onChange={(e) => setText(e.target.value)} placeholder="주민에게 보여줄 문장" />
          </div>
          <button className="btn btn--primary talk__go" onClick={() => text.trim() && setLarge(text)}>크게 보기</button>
        </section>
      )}

      <p className="talk__notice">
        <Ico name="infoSub" size={16} />
        <span>이름·주소·연락처 같은 개인정보는 입력하지 마세요. 입력한 문장은 외부 번역 서비스로 보내질 수 있어요.</span>
      </p>

      {large && (
        <button className="talk__large" onClick={() => setLarge(null)} aria-label="닫기">
          <span>{large}</span>
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
