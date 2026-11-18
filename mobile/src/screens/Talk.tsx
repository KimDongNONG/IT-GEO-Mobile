// M7 현장 소통지원: 주민과 짧게 이야기할 때 쓰는 보조 도구 (대화 내용은 저장하지 않음)
import { useState } from 'react';
import { Screen, TabBar } from '../components/ui';
import './Talk.css';

type Lang = 'zh' | 'vi' | 'en';
const LANGS: { key: Lang; label: string; name: string; papago: string }[] = [
  { key: 'zh', label: '中文', name: '중국어(간체)', papago: 'zh-CN' },
  { key: 'vi', label: 'Tiếng Việt', name: '베트남어', papago: 'vi' },
  { key: 'en', label: 'English', name: '영어', papago: 'en' },
];

const INTRO = {
  ko: '구청에서 건물 상태를 확인하러 왔습니다. 이름이나 개인정보는 묻지 않습니다.',
  zh: '我们是区政府职员，来确认建筑状况。不会询问个人信息。',
  vi: 'Chúng tôi đến từ văn phòng quận để kiểm tra tình trạng tòa nhà. Chúng tôi sẽ không hỏi tên hay thông tin cá nhân.',
  en: 'We are from the district office to check the building condition. We will not ask for your name or personal information.',
};

const PHRASES: Record<'ko' | Lang, string>[] = [
  { ko: '집 안에 물이 샌 적이 있나요?', zh: '家里漏过水吗？', vi: 'Nhà bạn đã từng bị dột nước chưa?', en: 'Has water ever leaked inside your home?' },
  { ko: '혼자 사시나요?', zh: '您一个人住吗？', vi: 'Bạn sống một mình phải không?', en: 'Do you live alone?' },
  { ko: '도움이 필요하면 구청으로 연락 주세요.', zh: '如需帮助，请联系区政府。', vi: 'Nếu cần giúp đỡ, hãy liên hệ văn phòng quận.', en: 'Please contact the district office if you need help.' },
  { ko: '사진을 찍어도 될까요? 얼굴은 찍지 않습니다.', zh: '可以拍照吗？不会拍脸。', vi: 'Tôi có thể chụp ảnh không? Tôi sẽ không chụp mặt.', en: 'May I take a photo? I will not photograph faces.' },
];

export default function Talk() {
  const [mode, setMode] = useState<'input' | 'phrase' | 'large'>('input');
  const [lang, setLang] = useState<Lang>('zh');
  const [from, setFrom] = useState<'ko' | Lang>('ko');
  const [to, setTo] = useState<'ko' | Lang>('zh');
  const [text, setText] = useState('');
  const [large, setLarge] = useState<string | null>(null);

  const langName = (l: 'ko' | Lang) => (l === 'ko' ? '한국어' : LANGS.find((x) => x.key === l)!.name);
  const papagoCode = (l: 'ko' | Lang) => (l === 'ko' ? 'ko' : LANGS.find((x) => x.key === l)!.papago);
  const translate = () => {
    if (!text.trim()) return;
    const url = `https://papago.naver.com/?sk=${papagoCode(from)}&tk=${papagoCode(to)}&st=${encodeURIComponent(text.trim())}`;
    window.open(url, '_blank', 'noopener');
  };
  const speak = (s: string, l: 'ko' | Lang) => {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(s);
    u.lang = { ko: 'ko-KR', zh: 'zh-CN', vi: 'vi-VN', en: 'en-US' }[l];
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };

  return (
    <Screen title="현장 소통지원" back right={<span className="badge badge--plain talk__demo">시연</span>} className="talk">
      <p className="talk__desc">주민과 짧게 이야기해야 할 때 쓰는 보조 도구입니다.</p>
      <p className="talk__lock">🔒 대화 내용은 저장하지 않습니다</p>

      <div className="talk__modes" role="tablist">
        {([['input', '입력 번역'], ['phrase', '현장 표현'], ['large', '큰 글씨']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? 'is-on' : ''} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>

      <section className="card talk__card">
        <div className="talk__card-head">
          <h2>다국어 안내 카드</h2>
          <button className="talk__show" onClick={() => setLarge(INTRO[lang])}>보여주기</button>
        </div>
        <div className="talk__intro">
          <p>{INTRO.ko}</p>
          <p className="talk__intro-tr">{INTRO[lang]}</p>
        </div>
        <div className="talk__langs">
          {LANGS.map((l) => (
            <button key={l.key} className={lang === l.key ? 'is-on' : ''} onClick={() => setLang(l.key)}>{l.label}</button>
          ))}
        </div>
      </section>

      {mode === 'input' && (
        <section className="card talk__card">
          <h2 className="talk__h">문장 직접 입력 · 번역</h2>
          <div className="talk__pair">
            <select value={from} onChange={(e) => setFrom(e.target.value as 'ko' | Lang)} aria-label="원문 언어">
              {(['ko', 'zh', 'vi', 'en'] as const).map((l) => <option key={l} value={l}>{langName(l)}</option>)}
            </select>
            <button className="talk__swap" onClick={() => { setFrom(to); setTo(from); }} aria-label="언어 바꾸기">⇄</button>
            <select value={to} onChange={(e) => setTo(e.target.value as 'ko' | Lang)} aria-label="번역 언어">
              {(['ko', 'zh', 'vi', 'en'] as const).map((l) => <option key={l} value={l}>{langName(l)}</option>)}
            </select>
          </div>
          <textarea className="talk__input" maxLength={450} value={text} onChange={(e) => setText(e.target.value)} placeholder="번역할 내용 (최대 450자)" />
          <button className="talk__go" onClick={translate}>번역하기</button>
          <p className="talk__tools">
            결과:{' '}
            <button onClick={() => navigator.clipboard?.writeText(text)}>복사</button> ·{' '}
            <button onClick={() => speak(text, from)}>읽어주기</button> ·{' '}
            <button onClick={() => text && setLarge(text)}>큰 글씨</button> ·{' '}
            <button onClick={translate}>외부 번역 ↗</button>
          </p>
        </section>
      )}

      {mode === 'phrase' && (
        <section className="card talk__card">
          <h2 className="talk__h">자주 쓰는 현장 표현</h2>
          <ul className="talk__phrases">
            {PHRASES.map((p) => (
              <li key={p.ko}>
                <button onClick={() => setLarge(p[lang])}>
                  <span>{p.ko}</span>
                  <span className="talk__intro-tr">{p[lang]}</span>
                </button>
                <button className="talk__speak" onClick={() => speak(p[lang], lang)} aria-label="읽어주기">🔊</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mode === 'large' && (
        <section className="card talk__card">
          <h2 className="talk__h">큰 글씨로 보여주기</h2>
          <textarea className="talk__input" value={text} onChange={(e) => setText(e.target.value)} placeholder="주민에게 보여줄 문장" />
          <button className="talk__go" onClick={() => text && setLarge(text)}>크게 보기</button>
        </section>
      )}

      <p className="talk__notice">
        이름·주소·연락처 등 개인정보는 입력하지 마세요. 외부 번역 서버로 전송되며 저장하지 않습니다. 전문 통역·수어통역을 대체하지 않습니다.
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
