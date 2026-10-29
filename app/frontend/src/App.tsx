import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider, homeFor, RequireRole, useAuth } from "./auth";
import Layout from "./components/Layout";
import Approvals from "./pages/Approvals";
import AuditLog from "./pages/AuditLog";
import Calendar from "./pages/Calendar";
import Dashboard from "./pages/Dashboard";
import LeaveTypes from "./pages/LeaveTypes";
import Login from "./pages/Login";
import MyLeave from "./pages/MyLeave";
import MyShifts from "./pages/MyShifts";
import Notifications from "./pages/Notifications";
import Roster from "./pages/Roster";
import ShiftTemplates from "./pages/ShiftTemplates";
import Teams from "./pages/Teams";
import Users from "./pages/Users";

function Home() {
  const { me, loading } = useAuth();
  if (loading) return <div className="page-loading" role="status">Loading…</div>;
  return <Navigate to={me ? homeFor(me.role) : "/login"} replace />;
}

function NotFound() {
  return (
    <div className="page narrow">
      <h1>Page not found</h1>
      <p>That page doesn't exist.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Home />} />
          <Route element={<RequireRole><Layout /></RequireRole>}>
            <Route path="/dashboard" element={<RequireRole roles={["manager", "hr_admin"]}><Dashboard /></RequireRole>} />
            <Route path="/approvals" element={<RequireRole roles={["manager", "hr_admin"]}><Approvals /></RequireRole>} />
            <Route path="/leave" element={<RequireRole roles={["employee", "manager"]}><MyLeave /></RequireRole>} />
            <Route path="/shifts" element={<RequireRole roles={["employee", "manager"]}><MyShifts /></RequireRole>} />
            <Route path="/roster" element={<RequireRole roles={["manager", "hr_admin"]}><Roster /></RequireRole>} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/shift-templates" element={<RequireRole roles={["manager", "hr_admin"]}><ShiftTemplates /></RequireRole>} />
            <Route path="/audit" element={<RequireRole roles={["manager", "hr_admin"]}><AuditLog /></RequireRole>} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/admin/users" element={<RequireRole roles={["hr_admin"]}><Users /></RequireRole>} />
            <Route path="/admin/teams" element={<RequireRole roles={["hr_admin"]}><Teams /></RequireRole>} />
            <Route path="/admin/leave-types" element={<RequireRole roles={["hr_admin"]}><LeaveTypes /></RequireRole>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
