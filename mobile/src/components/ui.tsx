import { useEffect, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  const tabs = [
    { to: '/', label: '홈', Icon: IconTabHome, end: true },
    { to: state.groups[0] ? `/route/${state.groups[0].id}` : '/', label: '동선', Icon: IconTabRoute, match: '/route' },
    { to: state.lastResultId ? `/result/${state.lastResultId}` : '/', label: '확인', Icon: IconTabCheck, match: '/result' },
    { to: '/talk', label: '소통지원', Icon: IconTabChat },
  ];
  return (
    <nav className="tabbar" aria-label="하단 메뉴">
      {tabs.map(({ to, label, Icon, end, match }) => (
        <NavLink
          key={label}
          to={to}
          end={end}
          className={({ isActive }) =>
            `tabbar__item ${isActive || (match && pathname.startsWith(match)) ? 'is-active' : ''}`
          }
        >
          {({ isActive }) => {
            const on = isActive || (!!match && pathname.startsWith(match));
            return (
              <>
                <Icon color={on ? 'var(--primary)' : 'var(--sub)'} />
                <span>{label}</span>
              </>
            );
          }}
        </NavLink>
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
