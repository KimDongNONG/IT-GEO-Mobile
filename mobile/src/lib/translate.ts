// 문장 번역 (M7 소통지원)
//   준비된 표현이면 바로 돌려주고, 그 밖의 문장은 번역 API 로 보낸다.
//   번역 API 는 아직 연결 전 : translateApi 만 채우면 화면은 그대로 동작한다.
import { findPhrase, phraseIn, type AnyLang } from '../data/talk';

export interface Translation {
  text: string;
  pron?: string;   // 한글 발음 (없으면 결과 카드에서 빠짐)
}

export class TranslateNotReady extends Error {
  constructor() { super('번역 기능을 연결하는 중이에요. 지금은 자주 쓰는 표현만 번역돼요.'); }
}

/** 번역 API 연결 자리 */
async function translateApi(text: string, from: AnyLang, to: AnyLang): Promise<Translation> {
  void text; void from; void to;
  throw new TranslateNotReady();
}

export async function translate(text: string, from: AnyLang, to: AnyLang): Promise<Translation> {
  if (from === to) return { text: text.trim() };
  const preset = findPhrase(text, from);
  if (preset) return phraseIn(preset, to);
  return translateApi(text.trim(), from, to);
}
