// 소통지원 : 번역 · 읽어주기
//   번역 : 앱(안드로이드)은 기기 안 번역(ML Kit, 언어별 모델을 처음 한 번 내려받음 · 대화 내용은 밖으로 나가지 않음)
//          브라우저(개발 · 시연)는 현장 표현 사전에 있는 문장만 바로 번역, 나머지는 파파고 화면으로
//   읽어주기 : 앱은 기기 TTS(@capacitor-community/text-to-speech), 브라우저는 speechSynthesis
import { Capacitor } from '@capacitor/core';
import { Translation, type Language } from '@capacitor-mlkit/translation';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export type Lang = 'zh' | 'vi' | 'en' | 'ja' | 'ru' | 'th';
export type Any = 'ko' | Lang;

export const LANGS: { key: Lang; label: string; name: string; papago: string; speech: string; more?: true }[] = [
  { key: 'zh', label: '中文', name: '중국어(간체)', papago: 'zh-CN', speech: 'zh-CN' },
  { key: 'vi', label: 'Tiếng Việt', name: '베트남어', papago: 'vi', speech: 'vi-VN' },
  { key: 'en', label: 'English', name: '영어', papago: 'en', speech: 'en-US' },
  { key: 'ja', label: '日本語', name: '일본어', papago: 'ja', speech: 'ja-JP', more: true },
  { key: 'ru', label: 'Русский', name: '러시아어', papago: 'ru', speech: 'ru-RU', more: true },
  { key: 'th', label: 'ภาษาไทย', name: '태국어', papago: 'th', speech: 'th-TH', more: true },
];
export const ALL: Any[] = ['ko', ...LANGS.map((l) => l.key)];
const info = (l: Any) => LANGS.find((x) => x.key === l);
export const langName = (l: Any) => (l === 'ko' ? '한국어' : info(l)!.name);
export const papagoCode = (l: Any) => (l === 'ko' ? 'ko' : info(l)!.papago);
export const speechCode = (l: Any) => (l === 'ko' ? 'ko-KR' : info(l)!.speech);
export const papagoUrl = (from: Any, to: Any, text: string) =>
  `https://papago.naver.com/?sk=${papagoCode(from)}&tk=${papagoCode(to)}&st=${encodeURIComponent(text.trim())}`;

export const INTRO: Record<Any, string> = {
  ko: '구청에서 건물 상태를 확인하러 왔습니다. 이름이나 개인정보는 묻지 않습니다.',
  zh: '我们是区政府的工作人员，来确认建筑状况。不会询问姓名或个人信息。',
  vi: 'Chúng tôi đến từ văn phòng quận để kiểm tra tình trạng tòa nhà. Chúng tôi sẽ không hỏi tên hay thông tin cá nhân.',
  en: 'We are from the district office to check the building condition. We will not ask for your name or personal information.',
  ja: '区役所から建物の状態を確認しに来ました。お名前や個人情報はお聞きしません。',
  ru: 'Мы из районной администрации, пришли проверить состояние здания. Мы не будем спрашивать ваше имя или личные данные.',
  th: 'เราเป็นเจ้าหน้าที่จากสำนักงานเขต มาตรวจสอบสภาพอาคาร เราจะไม่ถามชื่อหรือข้อมูลส่วนตัว',
};

export const PHRASES: Record<Any, string>[] = [
  { ko: '집 안에 물이 샌 적이 있나요?', zh: '家里漏过水吗？', vi: 'Nhà bạn đã từng bị dột nước chưa?', en: 'Has water ever leaked inside your home?',
    ja: '家の中で水漏れしたことはありますか？', ru: 'У вас дома когда-нибудь протекала вода?', th: 'ในบ้านเคยมีน้ำรั่วไหม' },
  { ko: '혼자 사시나요?', zh: '您一个人住吗？', vi: 'Bạn sống một mình phải không?', en: 'Do you live alone?',
    ja: 'お一人で住んでいますか？', ru: 'Вы живёте один?', th: 'คุณอยู่คนเดียวหรือเปล่า' },
  { ko: '도움이 필요하면 구청으로 연락 주세요.', zh: '如需帮助，请联系区政府。', vi: 'Nếu cần giúp đỡ, hãy liên hệ văn phòng quận.', en: 'Please contact the district office if you need help.',
    ja: '助けが必要なときは区役所にご連絡ください。', ru: 'Если нужна помощь, обратитесь в районную администрацию.', th: 'หากต้องการความช่วยเหลือ กรุณาติดต่อสำนักงานเขต' },
  { ko: '사진을 찍어도 될까요? 얼굴은 찍지 않습니다.', zh: '可以拍照吗？不会拍脸。', vi: 'Tôi có thể chụp ảnh không? Tôi sẽ không chụp mặt.', en: 'May I take a photo? I will not photograph faces.',
    ja: '写真を撮ってもいいですか？顔は撮りません。', ru: 'Можно сфотографировать? Лица снимать не будем.', th: 'ขอถ่ายรูปได้ไหม เราจะไม่ถ่ายใบหน้า' },
];

const norm = (s: string) => s.replace(/[\s?？.。!！,，]/g, '');
/** 안내 카드 · 현장 표현 사전에 있는 문장이면 바로 번역 */
function fromDictionary(text: string, from: Any, to: Any): string | null {
  const k = norm(text);
  for (const row of [INTRO, ...PHRASES]) if (norm(row[from]) === k) return row[to];
  return null;
}

export const canTranslateOnDevice = () => Capacitor.isNativePlatform();

/** 번역. 기기 번역을 못 쓰고 사전에도 없으면 null (→ 파파고 화면 안내) */
export async function translate(text: string, from: Any, to: Any, onDownloading?: () => void): Promise<string | null> {
  const t = text.trim();
  if (!t) return '';
  if (from === to) return t;
  const dict = fromDictionary(t, from, to);
  if (dict) return dict;
  if (!canTranslateOnDevice()) return null;
  const { languages } = await Translation.getDownloadedModels();
  if (!languages.includes(from as Language) || !languages.includes(to as Language)) onDownloading?.();
  const res = await Translation.translate({ text: t, sourceLanguage: from as Language, targetLanguage: to as Language });
  return res.text;
}

/** 소리 내어 읽기 */
export async function speak(text: string, lang: Any) {
  if (!text.trim()) return;
  if (Capacitor.isNativePlatform()) {
    await TextToSpeech.stop().catch(() => undefined);
    await TextToSpeech.speak({ text, lang: speechCode(lang), rate: 0.9 });
    return;
  }
  if (!('speechSynthesis' in window)) throw new Error('이 기기에서는 읽어주기를 쓸 수 없어요.');
  const u = new SpeechSynthesisUtterance(text);
  u.lang = speechCode(lang);
  u.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
