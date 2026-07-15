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
import AdminDashboard from './screens/Admin/AdminDashboard';
import ManageUsers from './screens/Admin/ManageUsers';
import SelectUsers from './screens/Admin/selectusers';
import ManageStaff from './screens/Admin/managestaff';
import ManageBoatOwners from './screens/Admin/manageboatowners';
import ManageBoatCrew from './screens/Admin/manageboatcrew';
import ManageFleets from './screens/Admin/managefleets';
import FleetInfo from './screens/Admin/fleetinfo';
import Trips from './screens/Admin/Trips';
import TripInfo from './screens/Admin/tripinfo';
import OPSDashboard from './screens/OPS/OPSdashboard';
import OPSMonitor from './screens/OPS/OPSmonitor';
import OPSNotifications from './screens/OPS/OPSnotifications';
import OPSSOS from './screens/OPS/OPSsos';
import OPSTrips from './screens/OPS/OPStrips';
import OPSTripdetails from './screens/OPS/OPSTripdetails';
import AdminNavbar from './screens/Admin/components/AdminNavbar';
import ShoreDashboard from './screens/Shore/ShoreDashboard';
import ShoreTrips from './screens/Shore/ShoreTrips';
import ShoreTripInfo from './screens/Shore/ShoreTripInfo';
import ShoreNavbar from './screens/Shore/components/ShoreNavbar';
import PassengerLandingPage from './screens/Passenger/PassengerLandingPage';
import PassengerVerificationPage from './screens/Passenger/PassengerVerificationPage';
import PassengerRegistrationPage from './screens/Passenger/PassengerRegistrationPage';
import PassengerOnboardingPage from './screens/Passenger/PassengerOnboardingPage';

const OPS_ROLES = ['OPS'] as const;
const ADMIN_ROLES = ['Admin'] as const;
const SHORE_ROLES = ['ShoreCrew'] as const;

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

function AdminRoute({ children }: { children: ReactElement }) {
  return (
    <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
      <div className="admin-portal min-h-screen overflow-x-hidden bg-[#f8f9fb] font-[Poppins] text-[#14223d]">
        <AdminNavbar />
        {children}
      </div>
    </ProtectedRoute>
  );
}

function ShoreRoute({ children }: { children: ReactElement }) {
  return (
    <ProtectedRoute allowedRoles={[...SHORE_ROLES]}>
      <div className="shore-portal min-h-screen overflow-x-hidden bg-[#f8f9fb] font-[Poppins] text-[#14223d]">
        <ShoreNavbar />
        {children}
      </div>
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

            <Route path="/passenger" element={<PassengerLandingPage />} />
            <Route path="/passenger/verification" element={<PassengerVerificationPage />} />
            <Route path="/passenger/register" element={<PassengerRegistrationPage />} />
            <Route path="/passenger/onboarding" element={<PassengerOnboardingPage />} />
            <Route path="/passenger/details" element={<Navigate to="/passenger/onboarding" replace />} />

            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/manage-users" element={<AdminRoute><ManageUsers /></AdminRoute>} />
            <Route path="/admin/select-users" element={<AdminRoute><SelectUsers /></AdminRoute>} />
            <Route path="/admin/manage-staff" element={<AdminRoute><ManageStaff /></AdminRoute>} />
            <Route path="/admin/manage-boat-owners" element={<AdminRoute><ManageBoatOwners /></AdminRoute>} />
            <Route path="/admin/manage-boat-crew" element={<AdminRoute><ManageBoatCrew /></AdminRoute>} />
            <Route path="/admin/manage-fleets" element={<AdminRoute><ManageFleets /></AdminRoute>} />
            <Route path="/admin/fleet-info/:fleetId" element={<AdminRoute><FleetInfo /></AdminRoute>} />
            <Route path="/admin/trips" element={<AdminRoute><Trips /></AdminRoute>} />
            <Route path="/admin/trip-info/:tripId" element={<AdminRoute><TripInfo /></AdminRoute>} />

            <Route path="/ops" element={<OpsRoute><OPSDashboard /></OpsRoute>} />
            <Route path="/ops/monitor" element={<OpsRoute><OPSMonitor /></OpsRoute>} />
            <Route path="/ops/sos" element={<OpsRoute><OPSSOS /></OpsRoute>} />
            <Route path="/ops/trips" element={<OpsRoute><OPSTrips /></OpsRoute>} />
            <Route path="/ops/trip-info/:tripId" element={<OpsRoute><OPSTripdetails /></OpsRoute>} />
            <Route path="/ops/notifications" element={<OpsRoute><OPSNotifications /></OpsRoute>} />

            <Route path="/shore" element={<ShoreRoute><ShoreDashboard /></ShoreRoute>} />
            <Route path="/shore/trips" element={<ShoreRoute><ShoreTrips /></ShoreRoute>} />
            <Route path="/shore/trips/:tripId" element={<ShoreRoute><ShoreTripInfo /></ShoreRoute>} />

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
