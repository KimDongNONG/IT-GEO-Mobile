// M7 소통지원에서 쓰는 언어 · 준비된 표현 (번역문 + 한글 발음)
//   번역 API 를 쓰지 않아도 안내 문구와 자주 쓰는 표현은 바로 보여줄 수 있게 미리 넣어 둔다

export type Lang = 'zh' | 'vi' | 'en' | 'ja' | 'ru' | 'th';
export type AnyLang = 'ko' | Lang;

export const LANGS: { key: Lang; name: string; papago: string; tts: string }[] = [
  { key: 'zh', name: '중국어(간체)', papago: 'zh-CN', tts: 'zh-CN' },
  { key: 'vi', name: '베트남어', papago: 'vi', tts: 'vi-VN' },
  { key: 'en', name: '영어', papago: 'en', tts: 'en-US' },
  { key: 'ja', name: '일본어', papago: 'ja', tts: 'ja-JP' },
  { key: 'ru', name: '러시아어', papago: 'ru', tts: 'ru-RU' },
  { key: 'th', name: '태국어', papago: 'th', tts: 'th-TH' },
];
export const ALL_LANGS: AnyLang[] = ['ko', ...LANGS.map((l) => l.key)];

const langOf = (l: AnyLang) => LANGS.find((x) => x.key === l);
export const langName = (l: AnyLang) => (l === 'ko' ? '한국어' : langOf(l)!.name);
export const langCode = (l: AnyLang) => (l === 'ko' ? 'ko' : langOf(l)!.papago);
export const ttsCode = (l: AnyLang) => (l === 'ko' ? 'ko-KR' : langOf(l)!.tts);

/** 한 표현의 언어별 문장과 한글 발음 (한국어는 발음 없음) */
export interface Phrase {
  text: Record<AnyLang, string>;
  pron: Record<Lang, string>;
}

/** 다국어 안내 카드 : 결과 카드에 처음 보이는 문구 */
export const INTRO: Phrase = {
  text: {
    ko: '구청에서 건물 상태를 확인하러 왔습니다. 이름이나 개인정보는 묻지 않습니다.',
    zh: '我们是区政府的工作人员，来确认建筑状况。不会询问姓名或个人信息。',
    vi: 'Chúng tôi đến từ văn phòng quận để kiểm tra tình trạng tòa nhà. Chúng tôi sẽ không hỏi tên hay thông tin cá nhân.',
    en: 'We are from the district office to check the building condition. We will not ask for your name or personal information.',
    ja: '区役所から建物の状態を確認しに来ました。お名前や個人情報はお聞きしません。',
    ru: 'Мы из районной администрации и пришли проверить состояние здания. Мы не спрашиваем имя и личные данные.',
    th: 'เราเป็นเจ้าหน้าที่จากสำนักงานเขต มาตรวจสอบสภาพอาคาร จะไม่ถามชื่อหรือข้อมูลส่วนตัว',
  },
  pron: {
    zh: '워먼 스 취정푸 더 궁쭤런위안, 라이 췌런 젠주 좡쾅.\n부후이 쉰원 싱밍 훠 거런 신시.',
    vi: '쭝 또이 덴 뜨 반 퐁 꾸언 데 끼엠 짜 띵 짱 또아 냐.\n쭝 또이 쌔 콩 호이 뗀 하이 통 띤 까 년.',
    en: '위 아 프럼 더 디스트릭트 오피스 투 체크 더 빌딩 컨디션.\n위 윌 낫 애스크 포 유어 네임 오어 퍼스널 인포메이션.',
    ja: '쿠야쿠쇼카라 다테모노노 조타이오 카쿠닌시니 키마시타.\n오나마에야 코진조호와 오키키시마센.',
    ru: '므 이즈 라요너이 아드미니스트라치이 이 프리슐리 프라베리치 사스타야니예 즈다니야.\n므 녜 스프라시바옘 이먀 이 리치느예 단느예.',
    th: '라오 뻰 짜오나티 짝 쌈낙응안 켓 마 뜨루엇썹 싸팝 아칸.\n짜 마이 탐 츠 르 커문 쑤언뚜어.',
  },
};

/** 자주 쓰는 표현 */
export const PHRASES: Phrase[] = [
  INTRO,
  {
    text: {
      ko: '집 안에 물이 샌 적이 있나요?',
      zh: '家里漏过水吗？',
      vi: 'Nhà bạn đã từng bị dột nước chưa?',
      en: 'Has water ever leaked inside your home?',
      ja: '家の中で水漏れしたことはありますか？',
      ru: 'В доме когда-нибудь протекала вода?',
      th: 'เคยมีน้ำรั่วในบ้านไหม',
    },
    pron: {
      zh: '자리 러우궈 수이 마?',
      vi: '냐 반 다 뜽 비 줏 느억 쯔어?',
      en: '해즈 워터 에버 릭트 인사이드 유어 홈?',
      ja: '이에노 나카데 미즈모레 시타 코토와 아리마스카?',
      ru: '브 도메 카그다 니부치 프라치칼라 바다?',
      th: '커이 미 남 루어 나이 반 마이?',
    },
  },
  {
    text: {
      ko: '혼자 사시나요?',
      zh: '您一个人住吗？',
      vi: 'Bạn sống một mình phải không?',
      en: 'Do you live alone?',
      ja: 'お一人でお住まいですか？',
      ru: 'Вы живёте один?',
      th: 'คุณอาศัยอยู่คนเดียวหรือไม่',
    },
    pron: {
      zh: '닌 이거런 주 마?',
      vi: '반 쏭 못 밍 파이 콩?',
      en: '두 유 리브 얼론?',
      ja: '오히토리데 오스마이데스카?',
      ru: '브 쥐뵤체 아딘?',
      th: '쿤 아싸이 유 콘 디여우 르 마이?',
    },
  },
  {
    text: {
      ko: '사진을 찍어도 될까요? 얼굴은 찍지 않습니다.',
      zh: '可以拍照吗？不会拍脸。',
      vi: 'Tôi có thể chụp ảnh không? Tôi sẽ không chụp mặt.',
      en: 'May I take a photo? I will not photograph faces.',
      ja: '写真を撮ってもいいですか？顔は撮りません。',
      ru: 'Можно сфотографировать? Лица снимать не будем.',
      th: 'ขอถ่ายรูปได้ไหม จะไม่ถ่ายใบหน้า',
    },
    pron: {
      zh: '커이 파이자오 마?\n부후이 파이 롄.',
      vi: '또이 꺼 테 쭙 아잉 콩?\n또이 쌔 콩 쭙 맛.',
      en: '메이 아이 테이크 어 포토?\n아이 윌 낫 포토그래프 페이시즈.',
      ja: '샤신오 톳테모 이이데스카?\n카오와 토리마센.',
      ru: '모쥐나 스파타그라피라바치?\n리차 스니마치 녜 부졤.',
      th: '커 타이 룹 다이 마이?\n짜 마이 타이 바이나.',
    },
  },
  {
    text: {
      ko: '도움이 필요하면 구청으로 연락 주세요.',
      zh: '如需帮助，请联系区政府。',
      vi: 'Nếu cần giúp đỡ, hãy liên hệ văn phòng quận.',
      en: 'Please contact the district office if you need help.',
      ja: 'お困りのことがあれば区役所にご連絡ください。',
      ru: 'Если нужна помощь, обратитесь в районную администрацию.',
      th: 'หากต้องการความช่วยเหลือ กรุณาติดต่อสำนักงานเขต',
    },
    pron: {
      zh: '루 쉬 방주, 칭 롄시 취정푸.',
      vi: '네우 껀 줍 더, 하이 리엔 헤 반 퐁 꾸언.',
      en: '플리즈 컨택트 더 디스트릭트 오피스 이프 유 니드 헬프.',
      ja: '오코마리노 코토가 아레바 쿠야쿠쇼니 고렌라쿠 쿠다사이.',
      ru: '예슬리 누쥐나 포모쉬, 아브라치치시 브 라요누유 아드미니스트라치유.',
      th: '학 떵깐 쾀 추어이르아, 까루나 띳떠 쌈낙응안 켓.',
    },
  },
];

/** 준비된 표현을 to 언어로 (발음은 한국어로 바꿀 때 없음) */
export function phraseIn(p: Phrase, to: AnyLang): { text: string; pron?: string } {
  return { text: p.text[to], pron: to === 'ko' ? undefined : p.pron[to] };
}

/** 입력한 문장이 준비된 표현과 같으면 그 표현 (어느 언어로 썼든) */
export function findPhrase(s: string, from: AnyLang): Phrase | undefined {
  const t = s.trim();
  return t ? PHRASES.find((p) => p.text[from] === t) : undefined;
}
