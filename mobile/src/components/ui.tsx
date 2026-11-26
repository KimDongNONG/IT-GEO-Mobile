import { useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/AppStore';
import { STATUS_LABEL, type WorkStatus } from '../data/types';
import { FIG, Ico, type FigIcon } from './figma';
import './ui.css';

/** 화면 틀 : 상단 바(뒤로 · 제목 · 오른쪽) + 본문 + 하단(탭바/버튼바) 여백
 *   back 이 없으면 큰 제목(24 Bold) + 부제목, 있으면 상단 바(18 Bold) */
export function Screen({
  title, sub, back, right, bottom = 'tabs', children, className = '',
}: {
  title?: ReactNode;
  sub?: ReactNode;
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
    <div className={`screen screen--${bottom} ${back ? 'screen--bar' : ''} ${className}`}>
      {back ? (
        <header className="topbar">
          <button className="topbar__back" onClick={onBack} aria-label="뒤로 가기"><Ico name="back24" size={24} /></button>
          <h1 className="topbar__title">{title}</h1>
          {right}
        </header>
      ) : title ? (
        <header className="pagehead">
          <div className="pagehead__tx">
            <h1 className="pagehead__title">{title}</h1>
            {sub && <p className="pagehead__sub">{sub}</p>}
          </div>
          {right}
        </header>
      ) : null}
      {children}
    </div>
  );
}

const TABS: { to: string; label: string; on: FigIcon; off: FigIcon; match: (p: string) => boolean }[] = [
  { to: '/', label: '홈', on: 'tabHomeOn', off: 'tabHomeOff', match: (p) => p === '/' || p.startsWith('/route') },
  { to: '/calendar', label: '캘린더', on: 'tabCalendarOn', off: 'tabCalendarOff', match: (p) => p.startsWith('/calendar') },
  { to: '/done', label: '확인', on: 'tabCheckOn', off: 'tabCheckOff', match: (p) => p.startsWith('/done') || p.startsWith('/result') },
  { to: '/talk', label: '소통지원', on: 'tabTalkOn', off: 'tabTalkOff', match: (p) => p.startsWith('/talk') },
];

/** 하단 탭 : 홈 · 캘린더 · 확인 · 소통지원 (켜짐 여부는 지금 경로만 보고 정한다) */
export function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="tabbar" aria-label="하단 메뉴">
      {TABS.map((t) => {
        const on = t.match(pathname);
        return (
          <Link key={t.label} to={t.to} className={`tabbar__item ${on ? 'is-active' : ''}`} aria-current={on ? 'page' : undefined}>
            <img src={FIG[on ? t.on : t.off]} width={24} height={24} alt="" aria-hidden />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** 화면 하단 고정 버튼 (첫 버튼 100px 회색 · 나머지 메인) */
export function ActionBar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`actionbar ${className}`}>{children}</div>;
}

export function Btn({
  variant = 'ghost', className = '', ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'line' | 'soft' | 'danger' | 'disabled' }) {
  return <button className={`btn btn--${variant} ${className}`} {...p} />;
}

/** 상태 배지 : 점 + 글자 (조사 전 초록 · 조사 중 주황 · 확인 완료 파랑) */
const DOT: Record<WorkStatus, FigIcon> = { before: 'dotBefore', doing: 'dotDoing', done: 'dotDone' };
export function StatusBadge({ status }: { status: WorkStatus }) {
  return (
    <span className={`badge badge--${status}`}>
      <img src={FIG[DOT[status]]} width={6} height={6} alt="" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** 회색 칩 (아이콘 + 글자) */
export function Chip({ icon, children }: { icon?: FigIcon; children: ReactNode }) {
  return <span className="chip">{icon && <Ico name={icon} size={14} />}{children}</span>;
}

/** 진행 막대 */
export function Bar({ value, total, className = '' }: { value: number; total: number; className?: string }) {
  const pct = total ? Math.min(100, (value / total) * 100) : 0;
  return <span className={`bar ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}><i style={{ width: `${pct}%` }} /></span>;
}

/** 회색 바탕 위 흰 알약이 움직이는 세그먼트 */
export function Segment<T extends string>({ value, options, onChange, className = '' }: {
  value: T; options: { key: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div className={`seg ${className}`} role="tablist">
      {options.map((o) => (
        <button key={o.key} role="tab" aria-selected={value === o.key} className={value === o.key ? 'is-on' : ''} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 아래에서 올라오는 시트 (손잡이 · 제목 · 닫기) */
export function Sheet({ onDismiss, title, desc, close, children, className = '' }: {
  onDismiss: () => void; title?: ReactNode; desc?: ReactNode; close?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <div className="sheet" role="dialog" aria-modal="true">
      <div className="sheet__dim" onClick={onDismiss} />
      <div className={`sheet__box ${className}`}>
        <span className="sheet__grip" aria-hidden />
        {(title || close) && (
          <div className="sheet__head">
            <div className="sheet__tx">
              {title && <h2 className="sheet__title">{title}</h2>}
              {desc && <p className="sheet__desc">{desc}</p>}
            </div>
            {close && <button className="sheet__close" onClick={onDismiss} aria-label="닫기"><Ico name="close24" size={24} /></button>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** 가운데 뜨는 확인 창 */
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
