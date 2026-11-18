import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'kr.wellfair.mobile',
  appName: 'WellFAIR',
  webDir: 'dist',
  backgroundColor: '#0b0b0c',
  plugins: {
    // fetch 를 네이티브 통신으로: 다른 주소의 스프링 서버에도 CORS 없이 붙고, 세션 쿠키(JSESSIONID)가 유지돼요
    CapacitorHttp: { enabled: true },
    CapacitorCookies: { enabled: true },
  },
};

export default config;
