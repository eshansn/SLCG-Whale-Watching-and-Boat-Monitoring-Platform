import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth";
import { Icon } from "../../../components/ui/icon";

interface NavigationItem {
  label: string;
  path: string;
}

const adminNavigationItems: NavigationItem[] = [
  {
    label: "Users",
    path: "/admin/manage-users",
  },
  {
    label: "Boats",
    path: "/admin/boats",
  },
  {
    label: "Trips",
    path: "/admin/trips",
  },
  {
    label: "Staff",
    path: "/admin/manage-staff",
  },
  {
    label: "Owners",
    path: "/admin/manage-boat-owners",
  },
  {
    label: "Complaints",
    path: "/admin/complaints",
  },
];

const AdminNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = (): void => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/admin" className="flex shrink-0 items-center" aria-label="Go to admin dashboard">
          <img
            src="/SLCG.png"
            alt="Sri Lanka Coast Guard Logo"
            className="h-9 w-auto object-contain sm:h-10"
          />
        </Link>

        <nav className="hidden items-center gap-6 text-sm lg:flex" aria-label="Admin navigation">
          <button
            type="button"
            aria-label="Notifications"
            className="flex items-center justify-center text-slate-500 transition-colors hover:text-[#14223d]"
          >
            <Icon name="notification" size={20} />
          </button>

          {adminNavigationItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.path}
                to={isActive ? "/admin" : item.path}
                className={`whitespace-nowrap font-medium tracking-wide transition-colors hover:text-[#14223d] ${
                  isActive ? "font-bold text-[#14223d]" : "text-slate-500"
                }`}
              >
                {isActive ? "Home" : item.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md bg-[#14223d] px-6 py-2.5 font-semibold text-white shadow-sm transition hover:bg-[#22375f] hover:shadow"
          >
            Log Out
          </button>
        </nav>

        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="inline-flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-md text-[#14223d] transition hover:bg-slate-100 lg:hidden"
          aria-label="Toggle admin navigation"
          aria-expanded={isMenuOpen}
        >
          <span className={`h-0.5 w-5 bg-current transition-transform ${isMenuOpen ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`h-0.5 w-5 bg-current transition-opacity ${isMenuOpen ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-5 bg-current transition-transform ${isMenuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </div>

      {isMenuOpen && (
        <nav className="border-t border-slate-200 bg-white px-4 py-4 shadow-lg lg:hidden" aria-label="Mobile admin navigation">
          <div className="mx-auto grid max-w-7xl gap-1">
            {adminNavigationItems.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  to={isActive ? "/admin" : item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`rounded-md px-3 py-3 text-sm font-medium transition-colors ${
                    isActive ? "bg-slate-100 text-[#14223d]" : "text-slate-600 hover:bg-slate-50 hover:text-[#14223d]"
                  }`}
                >
                  {isActive ? "Home" : item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 rounded-md bg-[#14223d] px-4 py-3 text-left text-sm font-semibold text-white"
            >
              Log Out
            </button>
          </div>
        </nav>
      )}
    </header>
  );
};

export default AdminNavbar;
