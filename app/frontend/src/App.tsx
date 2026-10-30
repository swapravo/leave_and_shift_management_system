import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { AuthProvider, RequireRole } from "./auth";
import Layout from "./components/Layout";
import AuditLog from "./pages/AuditLog";
import Calendar from "./pages/Calendar";
import Home from "./pages/Home";
import Inbox from "./pages/Inbox";
import Landing from "./pages/Landing";
import LeaveTypes from "./pages/LeaveTypes";
import Login from "./pages/Login";
import Requests from "./pages/Requests";
import Roster from "./pages/Roster";
import Settings, { SettingsIndex } from "./pages/Settings";
import ShiftTemplates from "./pages/ShiftTemplates";
import Teams from "./pages/Teams";
import Users from "./pages/Users";

function NotFound() {
  return (
    <div className="page narrow">
      <h1>Page not found</h1>
      <p>That page doesn't exist.</p>
    </div>
  );
}

// Addresses from before the redesign (bookmarks, and the links stored in older notifications) land on their new home.
const MOVED: Record<string, string> = {
  "/dashboard": "/home",
  "/approvals": "/inbox",
  "/notifications": "/inbox",
  "/leave": "/requests",
  "/shifts": "/requests?tab=swaps",
  "/shift-templates": "/settings/shift-templates",
  "/audit": "/settings/audit",
  "/admin/users": "/settings/users",
  "/admin/teams": "/settings/teams",
  "/admin/leave-types": "/settings/leave-types",
};

function Moved() {
  const { pathname } = useLocation();
  return <Navigate to={MOVED[pathname]} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Landing />} />
          {Object.keys(MOVED).map((from) => <Route key={from} path={from} element={<Moved />} />)}
          <Route element={<RequireRole><Layout /></RequireRole>}>
            <Route path="/home" element={<Home />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/requests" element={<RequireRole roles={["employee", "manager"]}><Requests /></RequireRole>} />
            <Route path="/roster" element={<RequireRole roles={["manager", "hr_admin"]}><Roster /></RequireRole>} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/settings" element={<RequireRole roles={["manager", "hr_admin"]}><Settings /></RequireRole>}>
              <Route index element={<SettingsIndex />} />
              <Route path="users" element={<RequireRole roles={["hr_admin"]}><Users /></RequireRole>} />
              <Route path="teams" element={<RequireRole roles={["hr_admin"]}><Teams /></RequireRole>} />
              <Route path="leave-types" element={<RequireRole roles={["hr_admin"]}><LeaveTypes /></RequireRole>} />
              <Route path="shift-templates" element={<ShiftTemplates />} />
              <Route path="audit" element={<AuditLog />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
