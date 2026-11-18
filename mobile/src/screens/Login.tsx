// 로그인 (웹 WellFAIR 와 같은 계정 · 같은 세션)
import { useState } from 'react';
import { useStore } from '../store/AppStore';
import { API_BASE } from '../api/client';
import { Btn } from '../components/ui';
import './Login.css';

export default function Login() {
  const { act } = useStore();
  const [loginId, setLoginId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !pw) { setErr('아이디와 비밀번호를 입력해 주세요.'); return; }
    setBusy(true);
    setErr('');
    try {
      await act.login(loginId.trim(), pw);
    } catch (x) {
      setErr(x instanceof Error ? x.message : '로그인하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen screen--none login">
      <p className="login__logo"><b>W</b>ell<b>FAIR</b></p>
      <p className="login__desc">웹 WellFAIR 와 같은 계정으로 로그인하면<br />현장확인 리스트와 기록이 그대로 이어져요.</p>

      <form className="login__form" onSubmit={submit}>
        <label className="login__field">
          <span>아이디</span>
          <input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} />
        </label>
        <label className="login__field">
          <span>비밀번호</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
        </label>
        {err && <p className="login__err" role="alert">{err}</p>}
        <Btn variant={busy ? 'disabled' : 'primary'} disabled={busy} className="login__go" type="submit">
          {busy ? '로그인 중…' : '로그인'}
        </Btn>
      </form>

      <button className="login__demo" onClick={act.startDemo}>서버 없이 시연 모드로 둘러보기</button>
      <p className="login__server">서버 {API_BASE || '(개발 프록시)'}</p>
    </div>
  );
}
