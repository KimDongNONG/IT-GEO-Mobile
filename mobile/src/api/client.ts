// WellFAIR 스프링 서버와 통신 (서버: src/main/java/wellfair/controller/MobileRESTController.java)
//
// 서버 주소
//   - 개발(npm run dev)  : 비워 둠. vite.config.ts 의 프록시가 /api 를 스프링 서버(VITE_SERVER)로 넘겨요.
//   - 앱(npx cap sync)   : .env.production 의 VITE_API_BASE (예: http://192.168.0.10:8080/wellfair)
// 앱 안에서는 capacitor.config.ts 의 CapacitorHttp 가 fetch 를 네이티브 통신으로 바꿔서
// 웹과 같은 세션 쿠키(JSESSIONID)가 그대로 유지돼요.

export const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

/** 로그인이 풀렸을 때 (서버 LoginInterceptor 가 401) */
export class AuthError extends Error {
  constructor() {
    super('로그인이 필요합니다.');
  }
}

/** 서버가 {ok:false, msg} 로 거절했을 때 */
export class ApiError extends Error {}

let onAuthLost: (() => void) | null = null;
export function setAuthLostHandler(fn: (() => void) | null) {
  onAuthLost = fn;
}

export const url = (path: string) => `${API_BASE}/${path.replace(/^\//, '')}`;

async function request(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url(path), { credentials: 'include', ...init });
  } catch {
    throw new ApiError('서버에 연결할 수 없어요. 인터넷 연결과 서버 주소를 확인해 주세요.');
  }
  if (res.status === 401) {
    if (!path.includes('login.do')) onAuthLost?.();
    let msg = '로그인이 필요합니다.';
    try { msg = (await res.json()).msg ?? msg; } catch { /* 본문 없음 */ }
    throw path.includes('login.do') ? new ApiError(msg) : new AuthError();
  }
  if (!res.ok) {
    let msg = `서버 오류 (${res.status})`;
    try { msg = (await res.json()).msg ?? msg; } catch { /* JSON 아님 */ }
    throw new ApiError(msg);
  }
  return res;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await request(path, init);
  const data = await res.json();
  if (data && typeof data === 'object' && data.ok === false) throw new ApiError(data.msg ?? '처리하지 못했어요.');
  return data as T;
}

/** 스프링 @RequestParam 형식(form-urlencoded)으로 POST. 배열은 같은 이름으로 여러 번 */
export function postForm<T>(path: string, params: Record<string, string | number | undefined | (string | number)[]>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    (Array.isArray(v) ? v : [v]).forEach((x) => body.append(k, String(x)));
  }
  return api<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: body.toString(),
  });
}

export function postJson<T>(path: string, data: unknown) {
  return api<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

/** 로그인이 필요한 이미지(현장 사진)를 blob URL 로 */
export async function blobUrl(path: string): Promise<string> {
  const res = await request(path);
  return URL.createObjectURL(await res.blob());
}
