import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "../api";
import { useAuth, useMe } from "../auth";
import { formatDate } from "../dates";
import type { Role } from "../types";

interface NavItem {
  to: string;
  label: string;
  roles: Role[];
}

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "My work",
    items: [
      { to: "/dashboard", label: "Dashboard", roles: ["manager", "hr_admin"] },
      { to: "/leave", label: "My leave", roles: ["employee", "manager"] },
      { to: "/shifts", label: "My shifts & swaps", roles: ["employee", "manager"] },
      { to: "/calendar", label: "Team calendar", roles: ["employee", "manager", "hr_admin"] },
      { to: "/notifications", label: "Notifications", roles: ["employee", "manager", "hr_admin"] },
    ],
  },
  {
    title: "Manage",
    items: [
      { to: "/approvals", label: "Approvals", roles: ["manager", "hr_admin"] },
      { to: "/roster", label: "Roster builder", roles: ["manager", "hr_admin"] },
      { to: "/shift-templates", label: "Shift templates", roles: ["manager", "hr_admin"] },
      { to: "/audit", label: "Audit log", roles: ["manager", "hr_admin"] },
    ],
  },
  {
    title: "Admin",
    items: [
      { to: "/admin/users", label: "Users", roles: ["hr_admin"] },
      { to: "/admin/teams", label: "Teams", roles: ["hr_admin"] },
      { to: "/admin/leave-types", label: "Leave types & accrual", roles: ["hr_admin"] },
    ],
  },
];

const ROLE_LABEL: Record<Role, string> = { employee: "Employee", manager: "Manager", hr_admin: "HR Admin" };

export function navFor(role: Role): { title: string; items: NavItem[] }[] {
  return GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length);
}

export default function Layout() {
  const me = useMe();
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [navOpen, setNavOpen] = useState(false);

  // Unread count: on every navigation, every 60 s, and when the inbox page says it changed.
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

  useEffect(() => setNavOpen(false), [location.pathname]);

  return (
    <div className={`shell${navOpen ? " nav-open" : ""}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>Leave &amp; Shifts</span>
        </div>
        <nav className="nav">
          {navFor(me.role).map((group) => (
            <div key={group.title}>
              <div className="nav-group">{group.title}</div>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to}>
                  {item.label}
                  {item.to === "/notifications" && unread > 0 && (
                    <span className="bell-count" aria-label={`${unread} unread`}>{unread}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="user-box">
          <div><strong>{me.name}</strong></div>
          <div className="role">{ROLE_LABEL[me.role]}{me.team_name ? ` · ${me.team_name}` : ""}</div>
        </div>
      </aside>
      {navOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <div className="main">
        <div className="topbar">
          <button type="button" className="menu-toggle ghost" aria-label="Open menu" aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}>☰ Menu</button>
          <span className="today">Today: {formatDate(me.today)} {me.today.slice(0, 4)} (IST)</span>
          <Link to="/notifications" className="button ghost bell" aria-label={`Notifications, ${unread} unread`}>
            <span aria-hidden="true">🔔</span>
            {unread > 0 && <span className="bell-count" aria-hidden="true">{unread}</span>}
          </Link>
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              await logout();
              navigate("/login", { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
        <main id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
