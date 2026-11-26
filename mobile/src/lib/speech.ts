// 말 → 글자 (녹음해서 녹취록 만들기 · 소통지원 음성 입력)
//   앱(안드로이드) : @capacitor-community/speech-recognition (기기 음성 인식, 녹음 파일은 남기지 않음)
//   브라우저(개발 · 시연) : Web Speech API (Chrome 계열 webkitSpeechRecognition)
//   안드로이드 음성 인식은 말이 잠깐 끊기면 저절로 멈춘다 → 녹음 중이면 이어서 다시 듣는다
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

export interface Dictation { stop: () => Promise<void> }
interface Handlers {
  onFinal: (text: string) => void;        // 확정된 문장 (녹취록에 붙인다)
  onPartial?: (text: string) => void;     // 말하는 중인 문장 (화면에만 잠깐)
  onEnd?: () => void;                     // 완전히 끝남 (stop 또는 오류)
  onError?: (msg: string) => void;
}

type WebRec = {
  lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null;
};
const WebSpeech = (window as unknown as { SpeechRecognition?: new () => WebRec; webkitSpeechRecognition?: new () => WebRec }).SpeechRecognition
  ?? (window as unknown as { webkitSpeechRecognition?: new () => WebRec }).webkitSpeechRecognition;

export const canDictate = () => Capacitor.isNativePlatform() || !!WebSpeech;

export async function startDictation(lang: string, h: Handlers): Promise<Dictation> {
  if (Capacitor.isNativePlatform()) return startNative(lang, h);
  if (WebSpeech) return startWeb(lang, h);
  throw new Error('이 기기에서는 음성 인식을 쓸 수 없어요.');
}

async function startNative(lang: string, h: Handlers): Promise<Dictation> {
  const { available } = await SpeechRecognition.available();
  if (!available) throw new Error('이 기기에서는 음성 인식을 쓸 수 없어요. (Google 음성 인식 앱 필요)');
  let perm = await SpeechRecognition.checkPermissions();
  if (perm.speechRecognition !== 'granted') perm = await SpeechRecognition.requestPermissions();
  if (perm.speechRecognition !== 'granted') throw new Error('마이크 권한을 허용해야 녹음할 수 있어요.');

  let active = true;
  let partial = '';
  const commit = () => { const t = partial.trim(); partial = ''; h.onPartial?.(''); if (t) h.onFinal(t); };
  const listen = () => SpeechRecognition.start({ language: lang, partialResults: true, popup: false, maxResults: 1 })
    .catch((e) => { if (active) { active = false; h.onError?.(e?.message ?? '음성 인식이 멈췄어요.'); h.onEnd?.(); } });

  await SpeechRecognition.removeAllListeners();
  await SpeechRecognition.addListener('partialResults', (d) => { partial = d.matches?.[0] ?? ''; h.onPartial?.(partial); });
  await SpeechRecognition.addListener('listeningState', (d) => {
    if (d.status !== 'stopped') return;
    commit();
    if (active) setTimeout(() => { if (active) listen(); }, 250);   // 말이 끊겨서 멈춘 것 → 이어서 듣기
  });
  listen();
  return {
    async stop() {
      if (!active) return;
      active = false;
      await SpeechRecognition.stop().catch(() => undefined);
      commit();
      await SpeechRecognition.removeAllListeners().catch(() => undefined);
      h.onEnd?.();
    },
  };
}

function startWeb(lang: string, h: Handlers): Dictation {
  let active = true;
  let r: WebRec;
  const make = () => {
    r = new WebSpeech!();
    r.lang = lang; r.interimResults = true; r.continuous = true;
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const x = e.results[i];
        if (x.isFinal) { const t = x[0].transcript.trim(); if (t) h.onFinal(t); } else interim += x[0].transcript;
      }
      h.onPartial?.(interim.trim());
    };
    r.onerror = (e) => {
      if (e?.error === 'no-speech' || e?.error === 'aborted') return;
      active = false; h.onError?.(e?.error === 'not-allowed' ? '마이크 권한을 허용해야 녹음할 수 있어요.' : '음성 인식이 멈췄어요.');
    };
    r.onend = () => { h.onPartial?.(''); if (active) { try { make(); r.start(); } catch { active = false; h.onEnd?.(); } } else h.onEnd?.(); };
    r.start();
  };
  make();
  return { async stop() { active = false; try { r.stop(); } catch { h.onEnd?.(); } } };
}
