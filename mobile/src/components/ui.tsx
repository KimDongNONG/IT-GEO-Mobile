import { useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { STATUS_LABEL, type WorkStatus } from '../data/types';
import { IconBack, IconTabChat, IconTabCheck, IconTabHome, IconTabRoute } from './icons';
import './ui.css';

/** 화면 틀: 상단 안전영역 + (뒤로가기) + 제목 + 본문 + 하단(탭바/버튼바) 여백 */
export function Screen({
  title, back, right, bottom = 'tabs', children, className = '',
}: {
  title?: ReactNode;
  back?: string | (() => void) | true;
  right?: ReactNode;
  bottom?: 'tabs' | 'actions' | 'none';
  children: ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  const onBack = () => {
    if (typeof back === 'function') back();
    else if (typeof back === 'string') navigate(back);
    else navigate(-1);
  };
  return (
    <div className={`screen screen--${bottom} ${className}`}>
      {back && (
        <button className="screen__back" onClick={onBack} aria-label="뒤로 가기">
          <IconBack />
        </button>
      )}
      {title && (
        <div className={`screen__head ${back ? '' : 'screen__head--noback'}`}>
          <h1 className="screen__title">{title}</h1>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function TabBar() {
  const { state } = useStore();
  const { pathname } = useLocation();
  // 켜짐 여부는 지금 경로(pathname)만 보고 정한다.
  // 예전에는 NavLink 의 isActive 도 같이 봤는데, 이동할 곳이 없을 때 to 가 '/' 로 바뀌어서
  // 홈 화면에서 '동선' · '확인' 아이콘까지 같이 켜지는 문제가 있었다.
  const tabs = [
    { to: '/', label: '홈', Icon: IconTabHome, on: pathname === '/' },
    { to: state.groups[0] ? `/route/${state.groups[0].id}` : '/', label: '동선', Icon: IconTabRoute, on: pathname.startsWith('/route') },
    { to: '/calendar', label: '일정', Icon: IconTabCheck, on: pathname.startsWith('/calendar') || pathname.startsWith('/result') },
    { to: '/talk', label: '소통지원', Icon: IconTabChat, on: pathname.startsWith('/talk') },
  ];
  return (
    <nav className="tabbar" aria-label="하단 메뉴">
      {tabs.map(({ to, label, Icon, on }) => (
        <Link key={label} to={to} className={`tabbar__item ${on ? 'is-active' : ''}`} aria-current={on ? 'page' : undefined}>
          <Icon color={on ? 'var(--primary)' : 'var(--sub)'} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** 화면 하단 고정 버튼 두 개 (취소 · 확인 류) */
export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="actionbar">{children}</div>;
}

export function Btn({
  variant = 'ghost', className = '', ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'white' | 'disabled' }) {
  return <button className={`btn btn--${variant} ${className}`} {...p} />;
}

export function StatusDot({ status, size = 8 }: { status: WorkStatus | 'all'; size?: number }) {
  return <span className={`dot dot--${status}`} style={{ width: size, height: size }} />;
}

export function StatusBadge({ status }: { status: WorkStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABEL[status]}</span>;
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="chip">{children}</span>;
}

export function Modal({ onDismiss, children, className = '' }: { onDismiss: () => void; children: ReactNode; className?: string }) {
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__dim" onClick={onDismiss} />
      <div className={`modal__box ${className}`}>{children}</div>
    </div>
  );
}

export function SummaryRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="rows">
      {rows.map(([k, v]) => (
        <div key={k} className="rows__row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 화면 아래 잠깐 뜨는 알림 (서버 오류 등) */
export function Toast() {
  const { state, act } = useStore();
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => act.toast(null), 3500);
    return () => clearTimeout(t);
  }, [state.toast, act]);
  if (!state.toast) return null;
  return (
    <div className="toast" role="status" onClick={() => act.toast(null)}>
      {state.toast}
    </div>
  );
}

/** 불러오는 중 · 빈 화면 안내 */
export function Notice({ children }: { children: ReactNode }) {
  return <p className="notice">{children}</p>;
}
