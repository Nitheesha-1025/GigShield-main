import { Navigate, Route, Routes } from "react-router-dom";
import { useMemo, useState } from "react";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";

export default function App() {
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem("gigshield_session");
    return raw ? JSON.parse(raw) : null;
  });

  const auth = useMemo(
    () => ({
      session,
      login: (next) => {
        localStorage.setItem("gigshield_session", JSON.stringify(next));
        setSession(next);
      },
      logout: () => {
        localStorage.removeItem("gigshield_session");
        setSession(null);
      }
    }),
    [session]
  );
  const homePath =
    (session?.selectedRole || session?.user?.role || "worker") === "admin"
      ? "/admin-dashboard"
      : "/claims";

  return (
    <Routes>
      <Route
        path="/auth"
        element={session ? <Navigate to={homePath} replace /> : <AuthPage onAuth={auth.login} />}
      />
      <Route
        path="/*"
        element={
          session ? (
            <DashboardPage session={session} onLogout={auth.logout} preferredDashboard={homePath} />
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />
    </Routes>
  );
}
