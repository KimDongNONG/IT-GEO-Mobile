// M1 홈 · M1-1 건물 선택 · M1-3 건물 삭제 확인
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Building, Group, WorkStatus } from '../data/types';
import { useStore } from '../store/AppStore';
import { IconDown, IconUp } from '../components/icons';
import { Btn, Modal, Notice, StatusBadge, StatusDot, TabBar } from '../components/ui';
import './Home.css';

function groupStatus(bs: Building[]): WorkStatus {
  if (bs.length && bs.every((b) => b.status === 'done')) return 'done';
  if (bs.some((b) => b.status !== 'before')) return 'doing';
  return 'before';
}

export default function Home() {
  const { state, act } = useStore();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | undefined>(state.groups[0]?.id);
  useEffect(() => { act.refresh(); }, [act]);           // 웹에서 바꾼 리스트까지 다시 읽기
  useEffect(() => { if (!openId && state.groups[0]) setOpenId(state.groups[0].id); }, [openId, state.groups]);
  const [selected, setSelected] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ group: Group; building: Building } | null>(null);

  const all = state.groups.flatMap((g) => g.buildingIds.map((id) => state.buildings[id]).filter(Boolean));
  const count = (s?: WorkStatus) => (s ? all.filter((b) => b.status === s).length : all.length);
  const totalVisit = state.groups.reduce((n, g) => n + (g.buildingIds.length || g.size || 0), 0);
  const stats: { label: string; value: number; status: WorkStatus | 'all' }[] = [
    { label: '방문 시설', value: totalVisit, status: 'all' },
    { label: '조사 전', value: totalVisit - count('done'), status: 'before' },
    { label: '확인 완료', value: count('done'), status: 'done' },
  ];

  return (
    <div className="screen screen--tabs home">
      <div className="home__top">
        <p className="home__logo">
          <b>W</b>ell<b>FAIR</b>
        </p>
        <span className="home__me">
          {state.member?.name}{state.mode === 'demo' && ' · 시연'}
          <button onClick={act.logout}>{state.mode === 'demo' ? '나가기' : '로그아웃'}</button>
        </span>
      </div>

      <div className="home__stats">
        {stats.map((s) => (
          <div key={s.label} className="home__stat">
            <p className="home__stat-label">
              <StatusDot status={s.status} />
              {s.label}
            </p>
            <p className="home__stat-value">{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="home__heading">방문그룹</h2>

      {state.groups.length === 0 && (
        <Notice>진행 중인 현장확인 리스트가 없어요.<br />웹 WellFAIR 의 현장확인 메뉴에서 리스트를 만들면 여기에 나타나요.</Notice>
      )}

      <ul className="home__groups">
        {state.groups.map((g) => {
          const bs = g.buildingIds.map((id) => state.buildings[id]).filter(Boolean);
          const size = bs.length || g.size || 0;
          const done = bs.filter((b) => b.status === 'done').length;
          const open = openId === g.id;
          return (
            <li key={g.id} className={`group card ${open ? 'is-open' : ''}`}>
              <button className="group__head" onClick={() => { setOpenId(open ? undefined : g.id); setSelected(null); }} aria-expanded={open}>
                <span className="group__text">
                  <span className="group__title">{g.title}</span>
                  <span className="group__meta">{g.date} · {size}개 건물 · {done}개 완료</span>
                </span>
                {open && bs.length > 0 && <StatusBadge status={groupStatus(bs)} />}
                {open ? <IconUp /> : <IconDown />}
              </button>

              {open && (
                <div className="group__body">
                  {bs.length === 0 && <p className="group__empty">아직 불러온 건물이 없어요.</p>}
                  <ul>
                    {bs.map((b) => {
                      const isSel = selected === b.id;
                      return (
                        <li key={b.id} className={`brow ${isSel ? 'is-selected' : ''}`}>
                          <button className="brow__main" onClick={() => setSelected(isSel ? null : b.id)}>
                            <StatusDot status={b.status} />
                            <span>{b.gu} {b.dong}</span>
                          </button>
                          {isSel && (
                            <span className="brow__actions">
                              <button className="brow__btn" onClick={() => navigate(`/archive?group=${g.id}&replace=${b.id}`)}>수정</button>
                              <button className="brow__btn brow__btn--danger" onClick={() => setDeleting({ group: g, building: b })}>삭제</button>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {bs.length > 0 && (
                    <button className="group__go" onClick={() => navigate(`/route/${g.id}`)}>이 그룹 확인하기 →</button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {deleting && (
        <Modal onDismiss={() => setDeleting(null)}>
          <h2 className="dlg__title">이 건물을 삭제할까요?</h2>
          <p className="dlg__desc">
            '{deleting.group.title}' 그룹에서 빠지고,
            <br />
            보관함에는 그대로 남아 있어요.
          </p>
          <div className="dlg__target">
            <StatusDot status={deleting.building.status} />
            <div>
              <p className="dlg__target-name">{deleting.building.gu} {deleting.building.dong}</p>
              <p className="dlg__target-sub">
                {deleting.building.type} · {{ before: '조사 전', doing: '조사 중', done: '확인 완료' }[deleting.building.status]}
              </p>
            </div>
          </div>
          <div className="dlg__actions">
            <Btn onClick={() => setDeleting(null)}>취소</Btn>
            <Btn
              variant="danger"
              onClick={() => {
                act.remove(deleting.group.id, deleting.building.id);
                setDeleting(null);
                setSelected(null);
              }}
            >
              삭제하기
            </Btn>
          </div>
        </Modal>
      )}

      <TabBar />
    </div>
  );
}
