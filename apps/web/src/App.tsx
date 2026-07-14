import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';

import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import Navbar from './components/Navbar';
import About from './screens/publicweb/About';
import AuthLanding from './screens/publicweb/AuthLanding';
import Contact from './screens/publicweb/Contact';
import Footer from './screens/publicweb/Footer';
import Gallery from './screens/publicweb/Gallery';
import Hero from './screens/publicweb/Hero';
import Login from './screens/publicweb/Login';
import SignUp from './screens/publicweb/SignUp';
import OPSDashboard from './screens/OPS/OPSdashboard';
import OPSMonitor from './screens/OPS/OPSmonitor';
import OPSNotifications from './screens/OPS/OPSnotifications';
import OPSSOS from './screens/OPS/OPSsos';
import OPSTrips from './screens/OPS/OPStrips';
import OPSTripdetails from './screens/OPS/OPSTripdetails';

const OPS_ROLES = ['OPS'] as const;

function PublicLandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Gallery />
        <Contact />
      </main>
      <Footer />
    </>
  );
}

function OpsRoute({ children }: { children: ReactElement }) {
  return (
    <ProtectedRoute allowedRoles={[...OPS_ROLES]}>
      {children}
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-slate-900 font-sans">
          <Routes>
            <Route path="/" element={<PublicLandingPage />} />
            <Route path="/auth" element={<AuthLanding />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />

            <Route path="/ops" element={<OpsRoute><OPSDashboard /></OpsRoute>} />
            <Route path="/ops/monitor" element={<OpsRoute><OPSMonitor /></OpsRoute>} />
            <Route path="/ops/sos" element={<OpsRoute><OPSSOS /></OpsRoute>} />
            <Route path="/ops/trips" element={<OpsRoute><OPSTrips /></OpsRoute>} />
            <Route path="/ops/trip-info/:tripId" element={<OpsRoute><OPSTripdetails /></OpsRoute>} />
            <Route path="/ops/notifications" element={<OpsRoute><OPSNotifications /></OpsRoute>} />

            <Route
              path="/access-denied"
              element={
                <div className="flex min-h-screen items-center justify-center bg-slate-900 px-6 text-center text-white">
                  <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-8">
                    <h1 className="text-2xl font-semibold">Access denied</h1>
                    <p className="mt-3 text-sm text-slate-400">
                      Your account does not have permission to access this portal.
                    </p>
                    <Link to="/" className="mt-6 inline-block text-cyan-400 hover:text-cyan-300">
                      Return home
                    </Link>
                  </div>
                </div>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
