import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { homeFor, useAuth } from "../auth";
import { ErrorBox } from "../components/ui";
import { useAction } from "../hooks";
import type { Role } from "../types";

export default function Login() {
  const { me, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, run } = useAction();

  if (!loading && me) return <Navigate to={from ?? homeFor(me.role)} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    let role: Role = "employee";
    const ok = await run(async () => {
      role = (await login(email, password)).role;
    });
    if (ok) navigate(from ?? homeFor(role), { replace: true });
  }

  return (
    <main className="login-page">
      <div className="card login-card">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>Leave &amp; Shifts</span>
        </div>
        <h1>Sign in</h1>
        <p className="muted">Leave, rosters and shift swaps in one place.</p>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" value={email} required
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password} required
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          <ErrorBox error={error} />
          <button type="submit" className="primary" disabled={busy || !email || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
