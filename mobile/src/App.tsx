import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { AppStoreProvider, useStore } from './store/AppStore';
import { Toast } from './components/ui';
import Loading from './screens/Loading';
import Login from './screens/Login';
import Home from './screens/Home';
import Archive from './screens/Archive';
import RoutePlan from './screens/RoutePlan';
import { NavigateAll, NavigateOne } from './screens/Navigate';
import Record from './screens/Record';
import Saved from './screens/Saved';
import Result from './screens/Result';
import Talk from './screens/Talk';
import Calendar from './screens/Calendar';
import Done from './screens/Done';
import Emergency from './components/Emergency';
import PullToRefresh from './components/PullToRefresh';

// Capacitor 앱 안에서는 파일 기반으로 열리므로 HashRouter를 씀
export default function App() {
  return (
    <AppStoreProvider>
      <HashRouter>
        <div className="app">
          <BackButton />
          <Gate />
          <Toast />
          {/* 긴급신고 SOS : 로그인 화면을 포함한 모든 화면 오른쪽 위 */}
          <Emergency />
        </div>
      </HashRouter>
    </AppStoreProvider>
  );
}

/** 폰의 뒤로가기 버튼 : 언제나 전 페이지로. 더 갈 곳이 없으면 홈으로, 홈(또는 로그인)에서는 앱을 닫는다 */
function BackButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useStore();
  const loggedOut = state.mode === 'none';
  useEffect(() => {
    const sub = CapApp.addListener('backButton', () => {
      if (loggedOut) CapApp.exitApp();
      else if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
      else if (pathname !== '/') navigate('/', { replace: true });
      else CapApp.exitApp();
    });
    return () => { sub.then((h) => h.remove()); };
  }, [navigate, pathname, loggedOut]);
  return null;
}

/** 로그인 상태 확인 중 = M0 로딩, 로그인(또는 시연 모드) 전에는 로그인 화면만 */
function Gate() {
  const { state } = useStore();
  if (!state.ready) return <Loading />;
  if (state.mode === 'none') return <Login />;
  return (
    <>
          {/* 화면 맨 위에서 아래로 당기면 새로고침 */}
          <PullToRefresh />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/route/:groupId" element={<RoutePlan />} />
            <Route path="/route/:groupId/nav/:buildingId" element={<NavigateOne />} />
            <Route path="/route/:groupId/guide" element={<NavigateAll />} />
            <Route path="/record/:buildingId" element={<Record />} />
            <Route path="/record/:buildingId/saved" element={<Saved />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/done" element={<Done />} />
            <Route path="/result/:buildingId" element={<Result />} />
            <Route path="/talk" element={<Talk />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
    </>
  );
}
