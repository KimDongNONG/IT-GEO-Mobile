import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppStoreProvider, useStore } from './store/AppStore';
import { Toast } from './components/ui';
import Login from './screens/Login';
import Home from './screens/Home';
import Archive from './screens/Archive';
import RoutePlan from './screens/RoutePlan';
import { NavigateAll, NavigateOne } from './screens/Navigate';
import Record from './screens/Record';
import Saved from './screens/Saved';
import Result from './screens/Result';
import Talk from './screens/Talk';

// Capacitor 앱 안에서는 파일 기반으로 열리므로 HashRouter를 씀
export default function App() {
  return (
    <AppStoreProvider>
      <HashRouter>
        <div className="app">
          <Gate />
          <Toast />
        </div>
      </HashRouter>
    </AppStoreProvider>
  );
}

/** 로그인(또는 시연 모드) 전에는 로그인 화면만 */
function Gate() {
  const { state } = useStore();
  if (!state.ready) return <div className="screen screen--none" />;
  if (state.mode === 'none') return <Login />;
  return (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/route/:groupId" element={<RoutePlan />} />
            <Route path="/route/:groupId/nav/:buildingId" element={<NavigateOne />} />
            <Route path="/route/:groupId/guide" element={<NavigateAll />} />
            <Route path="/record/:buildingId" element={<Record />} />
            <Route path="/record/:buildingId/saved" element={<Saved />} />
            <Route path="/result/:buildingId" element={<Result />} />
            <Route path="/talk" element={<Talk />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
  );
}
