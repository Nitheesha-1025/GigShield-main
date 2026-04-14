import { Link, NavLink } from "react-router-dom";

const navItems = [
  { to: "/overview", label: "Dashboard" },
  { to: "/ml-pipeline", label: "ML Pipeline" },
  { to: "/worker-dashboard", label: "Worker Dashboard" },
  { to: "/admin-dashboard", label: "Admin Dashboard" },
  { to: "/plans", label: "Insurance Plans" },
  { to: "/disruption", label: "Disruption Monitor" },
  { to: "/payout", label: "Payout Calculator" },
  { to: "/claims", label: "Claim History" },
  { to: "/notifications", label: "Notifications" },
  { to: "/profile", label: "Profile" },
  { to: "/settings", label: "Settings" }
];

export default function Layout({ title, onLogout, children, toast, role = "worker" }) {
  const visibleNavItems =
    role === "admin"
      ? [
          { to: "/admin-dashboard", label: "Admin Dashboard" },
          { to: "/ml-pipeline", label: "ML Pipeline" }
        ]
      : navItems.filter((item) => item.to !== "/admin-dashboard" && item.to !== "/ml-pipeline");

  return (
    <div className="min-h-screen bg-white md:flex">
      <aside className="w-full md:w-56 border-r border-slate-100 bg-white p-4 md:min-h-screen">
        <Link to="/" className="flex items-center gap-2 font-bold text-slate-900 text-xl mb-8">
          <div className="h-8 w-8 rounded-xl bg-brand-500 text-white grid place-items-center text-sm">G</div>
          GigShield
        </Link>
        <p className="text-[11px] tracking-wider text-slate-400 mb-2">OVERVIEW</p>
        <nav className="flex md:flex-col gap-2 overflow-auto">
          {visibleNavItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                  isActive ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <p className="text-[11px] tracking-wider text-slate-400 mt-6 mb-2">ACCOUNT</p>
        <nav className="flex md:flex-col gap-2 overflow-auto">
          {visibleNavItems.slice(5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                  isActive ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <button onClick={onLogout} className="text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100">
            Sign Out
          </button>
        </nav>
      </aside>

      <div className="flex-1">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-100">
          <div className="px-6 py-3 flex items-center justify-between">
            <div />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800">Rahul</p>
                <p className="text-xs text-slate-500">Zepto Partner</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-brand-500 text-white grid place-items-center text-xs">R</div>
            </div>
          </div>
        </header>

        <main className="p-6 space-y-4">
          <h1 className="text-4xl md:text-[38px] font-black text-slate-900">{title}</h1>
          {toast && <div className="card border-brand-100 bg-brand-50 text-brand-800">{toast}</div>}
          {children}
        </main>
      </div>
    </div>
  );
}
