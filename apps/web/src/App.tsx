import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';

import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './auth/useAuth';
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
import ManageUsers from './screens/Admin/ManageUsersPage';
import UserCategoriesPage from './screens/Admin/UserCategoriesPage';
import StaffPage from './screens/Admin/StaffPage';
import StaffDetailsPage from './screens/Admin/StaffDetailsPage';
import BoatOwnersPage from './screens/Admin/BoatOwnersPage';
import BoatCrewPage from './screens/Admin/BoatCrewPage';
import BoatsPage from './screens/Admin/BoatsPage';
import BoatDetailsPage from './screens/Admin/BoatDetailsPage';
import OwnerDetailsPage from './screens/Admin/OwnerDetailsPage';
import CrewDetailsPage from './screens/Admin/CrewDetailsPage';
import { AdminRecordsProvider } from './screens/Admin/AdminRecordsContext';
import ComplaintsInquiriesPage from './screens/Admin/ComplaintsInquiriesPage';
import Trips from './screens/Admin/TripsPage';
import TripInfo from './screens/Admin/TripDetailsPage';
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
import WildlifeNavbar from './screens/Wildlife/WildlifeNavbar';
import OperationsPortal from './screens/Portal/OperationsPortal';

const OPS_ROLES = ['OPS'] as const;
const ADMIN_ROLES = ['Admin'] as const;
const SHORE_ROLES = ['ShoreCrew'] as const;
const WILDLIFE_ROLES = ['Wildlife'] as const;
const OWNER_ROLES = ['BoatOwner'] as const;
const CREW_ROLES = ['BoatCrew'] as const;

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

function AdminRoute({ children, adminOnly = false }: { children: ReactElement; adminOnly?: boolean }) {
  const { session } = useAuth();
  const isWildlife = session?.roles.includes('Wildlife') ?? false;
  return (
    <ProtectedRoute allowedRoles={adminOnly ? [...ADMIN_ROLES] : ['Admin', 'Wildlife']}>
      <div className={`${isWildlife ? 'wildlife-portal ' : ''}admin-portal min-h-screen overflow-x-hidden bg-[#f8f9fb] font-[Poppins] text-[#14223d]`}>
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

function WildlifeRoute({ children }: { children: ReactElement }) {
  return <ProtectedRoute allowedRoles={[...WILDLIFE_ROLES]}><div className="wildlife-portal admin-portal min-h-screen bg-[#f8f9fb] font-[Poppins] text-[#14223d]"><WildlifeNavbar />{children}</div></ProtectedRoute>;
}

function OwnerRoute({children}:{children:ReactElement}) { return <ProtectedRoute allowedRoles={[...OWNER_ROLES]}>{children}</ProtectedRoute>; }
function CrewRoute({children}:{children:ReactElement}) { return <ProtectedRoute allowedRoles={[...CREW_ROLES]}>{children}</ProtectedRoute>; }

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminRecordsProvider>
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
            <Route path="/admin/select-users" element={<AdminRoute><UserCategoriesPage /></AdminRoute>} />
            <Route path="/admin/manage-staff" element={<AdminRoute adminOnly><StaffPage /></AdminRoute>} />
            <Route path="/admin/staff-info/:staffId" element={<AdminRoute adminOnly><StaffDetailsPage /></AdminRoute>} />
            <Route path="/admin/manage-boat-owners" element={<AdminRoute><BoatOwnersPage /></AdminRoute>} />
            <Route path="/admin/manage-boat-crew" element={<AdminRoute><BoatCrewPage /></AdminRoute>} />
            <Route path="/admin/boats" element={<AdminRoute><BoatsPage /></AdminRoute>} />
            <Route path="/admin/manage-fleets" element={<Navigate to="/admin/boats" replace />} />
            <Route path="/admin/boats/:boatId" element={<AdminRoute><BoatDetailsPage /></AdminRoute>} />
            <Route path="/admin/owners/:ownerId" element={<AdminRoute><OwnerDetailsPage /></AdminRoute>} />
            <Route path="/admin/crew/:crewId" element={<AdminRoute><CrewDetailsPage /></AdminRoute>} />
            <Route path="/admin/fleet-info/:fleetId" element={<AdminRoute><BoatDetailsPage /></AdminRoute>} />
            <Route path="/admin/boat-owner-info/:ownerId" element={<AdminRoute><OwnerDetailsPage /></AdminRoute>} />
            <Route path="/admin/boat-crew-info/:crewId" element={<AdminRoute><CrewDetailsPage /></AdminRoute>} />
            <Route path="/admin/trips" element={<AdminRoute><Trips /></AdminRoute>} />
            <Route path="/admin/complaints" element={<AdminRoute><ComplaintsInquiriesPage /></AdminRoute>} />
            <Route path="/admin/complaints-inquiries" element={<Navigate to="/admin/complaints" replace />} />
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
            <Route path="/owner" element={<OwnerRoute><OperationsPortal kind="owner" /></OwnerRoute>} />
            <Route path="/owner/boats" element={<OwnerRoute><OperationsPortal kind="owner" /></OwnerRoute>} />
            <Route path="/owner/trips" element={<OwnerRoute><OperationsPortal kind="owner" /></OwnerRoute>} />
            <Route path="/owner/crew" element={<OwnerRoute><OperationsPortal kind="owner" /></OwnerRoute>} />
            <Route path="/crew" element={<CrewRoute><OperationsPortal kind="crew" /></CrewRoute>} />
            <Route path="/crew/trips" element={<CrewRoute><OperationsPortal kind="crew" /></CrewRoute>} />
            <Route path="/wildlife" element={<WildlifeRoute><AdminDashboard /></WildlifeRoute>} />
            <Route path="/wildlife/manage-users" element={<WildlifeRoute><ManageUsers /></WildlifeRoute>} />
            <Route path="/wildlife/select-users" element={<WildlifeRoute><UserCategoriesPage /></WildlifeRoute>} />
            <Route path="/wildlife/manage-boat-owners" element={<WildlifeRoute><BoatOwnersPage /></WildlifeRoute>} />
            <Route path="/wildlife/manage-boat-crew" element={<WildlifeRoute><BoatCrewPage /></WildlifeRoute>} />
            <Route path="/wildlife/boats" element={<WildlifeRoute><BoatsPage /></WildlifeRoute>} />
            <Route path="/wildlife/boats/:boatId" element={<WildlifeRoute><BoatDetailsPage /></WildlifeRoute>} />
            <Route path="/wildlife/owners/:ownerId" element={<WildlifeRoute><OwnerDetailsPage /></WildlifeRoute>} />
            <Route path="/wildlife/crew/:crewId" element={<WildlifeRoute><CrewDetailsPage /></WildlifeRoute>} />
            <Route path="/wildlife/trips" element={<WildlifeRoute><Trips /></WildlifeRoute>} />
            <Route path="/wildlife/trip-info/:tripId" element={<WildlifeRoute><TripInfo /></WildlifeRoute>} />
            <Route path="/wildlife/complaints" element={<WildlifeRoute><ComplaintsInquiriesPage /></WildlifeRoute>} />

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
        </AdminRecordsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
