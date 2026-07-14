import { useState, type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';

import Navbar from './components/Navbar';
import Hero from './screens/publicweb/Hero';
import About from './screens/publicweb/About';
import Gallery from './screens/publicweb/Gallery';
import Contact from './screens/publicweb/Contact';
import Footer from './screens/publicweb/Footer';
import AuthLanding from './screens/publicweb/AuthLanding';
import Login from './screens/publicweb/Login';
import SignUp from './screens/publicweb/SignUp';
import OPSDashboard from './screens/OPS/OPSdashboard';
import OPSMonitor from './screens/OPS/OPSmonitor';
import OPSSOS from './screens/OPS/OPSsos';
import OPSTrips from './screens/OPS/OPStrips';
import OPSNotifications from './screens/OPS/OPSnotifications';

type UserRole = 'guest' | 'ops_admin' | 'ops_operator';

interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  hasOpsAccess: boolean;
}

const DEMO_OPS_ACCOUNT: DemoUser = {
  id: 'ops-demo-admin',
  name: 'OPS Demo Admin',
  email: 'ops@whalewatch.com',
  role: 'ops_admin',
  hasOpsAccess: true,
};

const OPS_ACCESS_ROLES: UserRole[] = ['ops_admin', 'ops_operator'];

function RoleProtectedRoute({
  children,
  currentUser,
  allowedRoles,
}: {
  children: ReactElement;
  currentUser: DemoUser | null;
  allowedRoles: UserRole[];
}) {
  const storedUser = typeof window !== 'undefined' ? window.localStorage.getItem('ops-demo-user') : null;
  const effectiveUser = currentUser ?? (storedUser ? JSON.parse(storedUser) : null);

  if (!effectiveUser) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(effectiveUser.role)) {
    return <Navigate to="/access-denied" replace />;
  }

  return children;
}

function PublicLandingPage({
  currentUser,
  onLogin,
  onLogout,
}: {
  currentUser: DemoUser | null;
  onLogin: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <Navbar />

      <div className="fixed right-4 top-4 z-50 flex items-center gap-3">
        {currentUser ? (
          <>
            <span className="rounded-full bg-white/10 px-3 py-2 text-sm text-white">
              {currentUser.name} · {currentUser.role}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Logout
            </button>
          </>
        ) : null}
      </div>

      <main>
        <Hero />

        <section className="bg-slate-950 px-6 py-8 text-white">
          <div className="mx-auto max-w-5xl rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Hardcoded demo account</h3>
                <p className="mt-1 text-sm text-slate-400">
                  OPS portal access is enabled for a demo admin account for now.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <p><span className="font-semibold text-white">Email:</span> {DEMO_OPS_ACCOUNT.email}</p>
                <p><span className="font-semibold text-white">Password:</span> {DEMO_OPS_ACCOUNT.email.split('@')[0]}1234</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onLogin}
                className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-400"
              >
                Sign in as OPS admin
              </button>
              <Link to="/auth" className="text-sm text-cyan-400 transition hover:text-cyan-300">
                Go to authentication screen
              </Link>
            </div>
          </div>
        </section>

        <About />
        <Gallery />
        <Contact />
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const storedUser = window.localStorage.getItem('ops-demo-user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const handleLogin = () => {
    setCurrentUser(DEMO_OPS_ACCOUNT);
    window.localStorage.setItem('ops-demo-user', JSON.stringify(DEMO_OPS_ACCOUNT));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    window.localStorage.removeItem('ops-demo-user');
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 font-sans">
        <Routes>
          <Route path="/" element={<PublicLandingPage currentUser={currentUser} onLogin={handleLogin} onLogout={handleLogout} />} />
          <Route path="/auth" element={<AuthLanding />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/signup" element={<SignUp />} />

          <Route
            path="/ops"
            element={
              <RoleProtectedRoute currentUser={currentUser} allowedRoles={OPS_ACCESS_ROLES}>
                <OPSDashboard />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/ops/monitor"
            element={
              <RoleProtectedRoute currentUser={currentUser} allowedRoles={OPS_ACCESS_ROLES}>
                <OPSMonitor />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/ops/sos"
            element={
              <RoleProtectedRoute currentUser={currentUser} allowedRoles={OPS_ACCESS_ROLES}>
                <OPSSOS />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/ops/trips"
            element={
              <RoleProtectedRoute currentUser={currentUser} allowedRoles={OPS_ACCESS_ROLES}>
                <OPSTrips />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/ops/notifications"
            element={
              <RoleProtectedRoute currentUser={currentUser} allowedRoles={OPS_ACCESS_ROLES}>
                <OPSNotifications />
              </RoleProtectedRoute>
            }
          />

          <Route
            path="/access-denied"
            element={
              <div className="flex min-h-screen items-center justify-center bg-slate-900 px-6 text-center text-white">
                <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-8">
                  <h1 className="text-2xl font-semibold">Access denied</h1>
                  <p className="mt-3 text-sm text-slate-400">
                    This portal requires an OPS-enabled account.
                  </p>
                  <Link to="/" className="mt-6 inline-block text-cyan-400 hover:text-cyan-300">
                    Return home
                  </Link>
                </div>
              </div>
            }
          />

          <Route
            path="*"
            element={
              <div className="flex h-screen items-center justify-center text-white">
                <h1>404 - Page Not Found</h1>
              </div>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}