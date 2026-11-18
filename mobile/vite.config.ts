import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// 개발 중에는 /api 요청을 로컬 스프링 서버(웹 WellFAIR)로 넘겨요. 주소는 .env.local 의 VITE_SERVER 로 바꿀 수 있어요.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const server = new URL(env.VITE_SERVER || 'http://localhost:8080/wellfair')
  const ctx = server.pathname.replace(/\/$/, '') // 예: /wellfair (Tomcat 컨텍스트 경로)
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: server.origin,
          changeOrigin: true,
          rewrite: (p) => ctx + p,
          // 세션 쿠키 경로(/wellfair)를 개발 서버 경로(/)로 바꿔야 로그인이 유지돼요
          cookiePathRewrite: ctx ? { [ctx]: '/' } : undefined,
        },
      },
    },
  }
})
