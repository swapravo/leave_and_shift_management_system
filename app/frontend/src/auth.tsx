import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { api, ApiError, setUnauthorizedHandler } from "./api";
import type { Me, Role } from "./types";

interface AuthState {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe(await api.me());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
      else throw e;
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setMe(null));
    refresh().catch(() => setMe(null)).finally(() => setLoading(false));
    return () => setUnauthorizedHandler(null);
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const user = await api.login(email, password);
    setMe(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setMe(null);
    }
  }, []);

  const value = useMemo(() => ({ me, loading, login, logout, refresh }), [me, loading, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** The signed-in user; only call under <RequireRole>. */
export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error("Not signed in");
  return me;
}

export function homeFor(_role: Role): string {
  return "/home";
}

export function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-loading" role="status">Loading…</div>;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(me.role)) return <NotAllowed />;
  return <>{children}</>;
}

export function NotAllowed() {
  return (
    <div className="page narrow">
      <h1>Not allowed</h1>
      <p>Your role doesn't have access to this page.</p>
    </div>
  );
}
