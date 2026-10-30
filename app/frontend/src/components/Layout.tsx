import { useEffect, useRef, useState, type ComponentType } from "react";
import { CalendarDays, ClipboardList, House, Inbox, LayoutGrid, LogOut, Settings, type LucideProps } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "../api";
import { useAuth, useMe } from "../auth";
import type { Role } from "../types";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<LucideProps>;
  roles: Role[];
}

const ALL: Role[] = ["employee", "manager", "hr_admin"];

// Order is the order shown. Each role gets at most five, so it fits a phone's tab bar.
const NAV: NavItem[] = [
  { to: "/home", label: "Home", icon: House, roles: ALL },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, roles: ALL },
  { to: "/requests", label: "Requests", icon: ClipboardList, roles: ["employee", "manager"] },
  { to: "/roster", label: "Roster", icon: LayoutGrid, roles: ["manager", "hr_admin"] },
  { to: "/inbox", label: "Inbox", icon: Inbox, roles: ALL },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["hr_admin"] },
];

const ROLE_LABEL: Record<Role, string> = { employee: "Employee", manager: "Manager", hr_admin: "HR Admin" };

export function navFor(role: Role): NavItem[] {
  return NAV.filter((i) => i.roles.includes(role));
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

export default function Layout() {
  const me = useMe();
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const menu = useRef<HTMLDetailsElement>(null);

  // Unread count: on every navigation, every 60 s, and when the inbox says it changed.
  useEffect(() => {
    let alive = true;
    const load = () => api.notifications(true).then((n) => alive && setUnread(n.unread)).catch(() => undefined);
    load();
    const timer = window.setInterval(load, 60_000);
    window.addEventListener("lsm:notifications", load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("lsm:notifications", load);
    };
  }, [location.pathname]);

  // The user menu closes on navigation and on any click outside it.
  useEffect(() => menu.current?.removeAttribute("open"), [location.pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menu.current && !menu.current.contains(e.target as Node)) menu.current.removeAttribute("open");
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const items = navFor(me.role);
  const hasSettings = me.role !== "employee";
  const badge = (to: string) => to === "/inbox" && unread > 0 ? <span className="nav-count" aria-label={`${unread} unread`}>{unread}</span> : null;

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/home" className="brand">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>Leave &amp; Shifts</span>
        </Link>
        <nav className="topnav" aria-label="Main navigation">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              <Icon size={19} aria-hidden="true" className="icon" />
              {label}
              {badge(to)}
            </NavLink>
          ))}
        </nav>
        <details className="usermenu" ref={menu}>
          <summary aria-label="Account menu">
            <span className="avatar" aria-hidden="true">{initials(me.name)}</span>
            <span className="usermenu-name">
              <strong>{me.name}</strong>
              <small>{ROLE_LABEL[me.role]}{me.team_name ? ` · ${me.team_name}` : ""}</small>
            </span>
          </summary>
          <div className="usermenu-panel">
            <div className="who">
              <strong>{me.name}</strong>
              <div className="muted small">{me.email}</div>
            </div>
            {hasSettings && me.role !== "hr_admin" && (
              <Link to="/settings"><Settings size={18} aria-hidden="true" className="icon" />Team settings</Link>
            )}
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate("/login", { replace: true });
              }}
            >
              <LogOut size={18} aria-hidden="true" className="icon" />Sign out
            </button>
          </div>
        </details>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Main navigation">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}>
            <span className="tab-icon"><Icon size={22} aria-hidden="true" className="icon" />{badge(to)}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
