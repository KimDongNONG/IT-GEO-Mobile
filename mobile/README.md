# WellFAIR 모바일 앱

현장 조사원이 쓰는 WellFAIR 모바일 앱이에요. React + Vite로 화면을 만들고 Capacitor로 안드로이드/iOS 앱으로 감쌌어요.
화면은 Figma `WellFAIR-M1 ~ M7 (다크)` 모바일 프레임(390px 폭)을 따라 만들었어요.

## 실행하기

```bash
cd mobile
npm install
npm run dev          # 브라우저에서 http://localhost:5173 (개발자도구에서 모바일 크기로 보기)
```

- 웹 WellFAIR(스프링, Tomcat)을 먼저 켜 두면 웹과 **같은 계정으로 로그인**해서 같은 데이터로 동작해요.
  개발 서버가 `/api` 요청을 `http://localhost:8080/wellfair` 로 넘겨요. 주소가 다르면 `.env.example` 을 `.env.local` 로 복사해서 `VITE_SERVER` 를 고치세요.
- 서버 없이 화면만 볼 때는 로그인 화면 아래 **시연 모드로 둘러보기**를 누르면 Figma 값으로 동작해요.

## 웹과 연동 (처음 한 번)

1. DB: `reference/db/06_mobile_record.sql` 실행 (앱 기록 상세 · 사진 테이블 2개 추가, 기존 테이블은 그대로)
2. 사진 저장 폴더: `src/main/resources/app.properties` 의 `app.upload.dir` (비우면 `[사용자 홈]/wellfair-upload`)
3. 네이버 지도: 네이버 클라우드 콘솔 > Maps > Application > Web 서비스 URL 에 아래 주소 추가
   - 개발: `http://localhost:5173`
   - 안드로이드 앱: `https://localhost`
   등록 전에는 앱이 도식 지도로 대신 보여 줘요. 경로(TMAP)는 웹과 같은 `api/field/walk.do` 를 써요.

### 무엇이 이어지나요

| 웹 | 앱 |
| --- | --- |
| 현장확인 리스트 · 방문 순서 | 홈 방문그룹 · 동선 (순서 끌어서 바꾸면 웹에도 바로 반영) |
| 보관함 | 보관함에서 불러오기 (건물 바꾸기 · 빼기도 웹에 반영) |
| 건물 확인 이력(05) 타임라인 | 앱에서 저장한 기록이 한 줄로 쌓임: 요인 맞음/아님, 메모, 점수 보정 + 거주자 상태 · 항목 점수 · 필요한 지원 · 사진 |
| 05 에서 입력한 확인 결과 | 앱 확인 결과 상세에 '웹에서 등록'으로 보임 |

서버 쪽 API 는 `src/main/java/wellfair/controller/MobileRESTController.java` 맨 위 주석에 정리돼 있어요.

## 앱으로 빌드하기

```bash
# 폰이 접속할 서버 주소: .env.example 을 .env.production 으로 복사하고 VITE_API_BASE 를 PC IP 로 (예: http://192.168.0.10:8080/wellfair)
npm run build        # dist/ 에 웹 파일 생성
npx cap sync         # dist/ 를 android 프로젝트에 복사
npx cap open android # 안드로이드 스튜디오에서 열고 ▶ 실행 (에뮬레이터 또는 USB 연결 폰)
```

iOS는 Mac에서 `npm install @capacitor/ios@6 && npx cap add ios && npx cap open ios` 후 Xcode로 실행해요.

## 화면 구성

| Figma | 경로 | 파일 |
| --- | --- | --- |
| M1 홈 · M1-1 건물 선택 · M1-3 삭제 확인 | `/` | `src/screens/Home.tsx` |
| M1-2 보관함에서 불러오기 | `/archive?group=&replace=` | `src/screens/Archive.tsx` |
| M2 동선 · M2-1/2 순서 조정 · M2-3 건물 펼침 | `/route/:groupId` | `src/screens/RoutePlan.tsx` |
| M2-4 길찾기 | `/route/:groupId/nav/:buildingId` | `src/screens/Navigate.tsx` |
| M2-5 전체 경로 안내 | `/route/:groupId/guide` | `src/screens/Navigate.tsx` |
| M3 현장 기록(건물) · M3-1 (가구) · M4 제출 확인 | `/record/:buildingId` | `src/screens/Record.tsx` |
| M5 저장 완료 | `/record/:buildingId/saved` | `src/screens/Saved.tsx` |
| M6 결과 상세 | `/result/:buildingId` | `src/screens/Result.tsx` |
| M7 현장 소통지원 | `/talk` | `src/screens/Talk.tsx` |

- 색·간격 토큰: `src/styles/tokens.css`
- 공통 부품(하단 탭, 버튼, 뱃지, 모달): `src/components/ui.tsx`
- 아이콘: `src/components/icons.tsx` (Figma에서 SVG로 내보낸 경로 그대로)

## 지금 상태와 남은 일

- 서버 통신: `src/api/client.ts` (세션 · 오류), `src/api/wellfair.ts` (API 와 화면 모델 변환), 상태는 `src/store/AppStore.tsx`
- 앱 안에서는 `CapacitorHttp` 를 켜서 네이티브로 통신해요 (CORS 없음, 세션 쿠키 유지). 안드로이드는 http 서버 접속을 허용해 뒀어요 (`usesCleartextTraffic`). 실제 배포 때는 https 서버로 바꾸고 이 설정을 빼세요.
- 길찾기 화면은 TMAP 경로선 · 거리 · 시간까지 보여 줘요. 몇 m 앞 우회전 같은 턴 안내는 아직 없어요 (서버 응답에 턴 정보가 없음).
- 사진 촬영·업로드(`@capacitor/camera`), 현재 위치(`@capacitor/geolocation`)는 앱에서 실제로 동작해요.
- 소통지원의 번역하기는 파파고 웹으로 문장을 넘겨요 (외부 번역).
