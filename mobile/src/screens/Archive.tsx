// M1-2 보관함에서 불러오기: 그룹의 건물 하나를 보관함의 다른 건물로 바꾼다
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ArchiveState } from '../data/types';
import { useStore } from '../store/AppStore';
import { IconDownSm, IconSearch } from '../components/icons';
import { ActionBar, Btn, Screen } from '../components/ui';
import './Archive.css';

const TABS: { key: 'all' | 'new' | 'doing' | 'done'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'new', label: '신규' },
  { key: 'doing', label: '진행중' },
  { key: 'done', label: '완료됨' },
];
const STATE_LABEL: Record<ArchiveState, string> = { new: '신규', doing: '진행중', done: '완료됨', inGroup: '그룹에 있음' };

export default function Archive() {
  const { state, act } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('group') ?? state.groups[0]?.id ?? '';
  const counts = state.archiveCounts;
  const [busy, setBusy] = useState(false);
  useEffect(() => { act.refresh(); }, [act]);
  const replaceId = params.get('replace') ?? '';
  const target = state.buildings[replaceId];

  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('all');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string | null>(null);

  const list = useMemo(
    () =>
      state.archive
        .filter((a) => tab === 'all' || a.state === tab || (tab === 'doing' && a.state === 'inGroup'))
        .filter((a) => !q || a.name.includes(q.trim()))
        .sort((a, b) => b.score - a.score),
    [state.archive, tab, q],
  );

  const apply = async () => {
    if (!picked || !replaceId || busy) return;
    setBusy(true);
    try {
      await act.replace(groupId, replaceId, picked);
      navigate('/');
    } catch (e) {
      act.toast(e instanceof Error ? e.message : '바꾸지 못했어요.');
    } finally {
      setBusy(false);
    }
  };
  // 이미 이 리스트에 담긴 건물은 고를 수 없음
  const inThisGroup = (a: (typeof state.archive)[number]) =>
    a.state === 'inGroup' || (!!a.groupId && a.groupId === groupId) || (!!a.bldId && !!state.groups.find((g) => g.id === groupId)?.buildingIds.includes(a.bldId));

  return (
    <Screen title="보관함" back bottom="actions" className="archive">
      {target && (
        <div className="archive__target">
          <span>바꿀 건물</span>
          <b>{target.dong} {target.type}</b>
        </div>
      )}

      <label className="archive__search">
        <IconSearch />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="건물명, 주소 검색" />
      </label>

      <div className="archive__tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-on' : ''} onClick={() => setTab(t.key)}>
            {t.label} <span>{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="archive__bar">
        <span>{tab === 'all' ? counts.all : list.length}건</span>
        <button className="archive__sort">
          취약도 높은 순 <IconDownSm />
        </button>
      </div>

      <ul className="archive__list card">
        {list.map((a) => {
          const disabled = inThisGroup(a);
          const on = picked === a.id;
          return (
            <li key={a.id}>
              <button
                className={`arow ${on ? 'is-on' : ''}`}
                disabled={disabled}
                onClick={() => setPicked(on ? null : a.id)}
                aria-pressed={on}
              >
                <span className="arow__radio" />
                <span className="arow__text">
                  <span className="arow__name">{a.name}</span>
                  <span className="arow__meta">
                    <span className={`arow__state arow__state--${disabled ? 'inGroup' : a.state}`}>{disabled ? STATE_LABEL.inGroup : STATE_LABEL[a.state]}</span>
                    <span className="arow__factors">{a.factors.join(' · ')}</span>
                  </span>
                </span>
                <span className="arow__score">
                  <b>{a.score}</b>
                  <span>취약도</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <ActionBar>
        <Btn onClick={() => navigate(-1)}>취소</Btn>
        <Btn variant={picked && !busy ? 'primary' : 'disabled'} disabled={!picked || busy} onClick={apply}>
          {busy ? '바꾸는 중…' : '이 건물로 바꾸기'}
        </Btn>
      </ActionBar>
    </Screen>
  );
}
