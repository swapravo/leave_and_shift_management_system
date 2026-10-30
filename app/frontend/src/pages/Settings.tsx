import { NavLink, Navigate, Outlet } from "react-router";
import { useMe } from "../auth";
import { NestedPage, PageHeader } from "../components/ui";
import type { Role } from "../types";

const TABS: { to: string; label: string; roles: Role[] }[] = [
  { to: "/settings/users", label: "People", roles: ["hr_admin"] },
  { to: "/settings/teams", label: "Teams", roles: ["hr_admin"] },
  { to: "/settings/leave-types", label: "Leave types", roles: ["hr_admin"] },
  { to: "/settings/shift-templates", label: "Shift templates", roles: ["manager", "hr_admin"] },
  { to: "/settings/audit", label: "Audit log", roles: ["manager", "hr_admin"] },
];

export function settingsTabs(role: Role) {
  return TABS.filter((t) => t.roles.includes(role));
}

/** Everything that sets the system up lives behind one door, split into tabs by what you can change. */
export default function Settings() {
  const me = useMe();
  const tabs = settingsTabs(me.role);
  if (tabs.length === 0) return <Navigate to="/home" replace />;
  return (
    <div className="page settings">
      <PageHeader title="Settings" subtitle={me.role === "hr_admin" ? "People, teams, leave rules and shift setup" : "Your team's shift setup and history"} />
      <nav className="tabs" aria-label="Settings sections">
        {tabs.map((t) => <NavLink key={t.to} to={t.to}>{t.label}</NavLink>)}
      </nav>
      <NestedPage.Provider value><Outlet /></NestedPage.Provider>
    </div>
  );
}

export function SettingsIndex() {
  const me = useMe();
  return <Navigate to={settingsTabs(me.role)[0]?.to ?? "/home"} replace />;
}
