import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar';
import Hero from './screens/publicweb/Hero';
import About from './screens/publicweb/About';
import Gallery from './screens/publicweb/Gallery';
import Contact from './screens/publicweb/Contact';
import Footer from './screens/publicweb/Footer';
import AuthLanding from './screens/publicweb/AuthLanding';
import Login from './screens/publicweb/Login';
import SignUp from './screens/publicweb/SignUp';

const UserPortalLayout = () => (
  <div className="p-8 text-white">
    <h2>Welcome to the User Portal</h2>
    {/* User specific dashboard, navigation, and nested routes go here */}
  </div>
);

const OwnerPortalLayout = () => (
  <div className="p-8 text-white">
    <h2>Welcome to the Owner Portal</h2>
    {/* Owner specific dashboard, navigation, and nested routes go here */}
  </div>
);

// 3. Compose the Common Landing Page
const PublicLandingPage = () => (
  <>
    <Navbar />
    {/* Typically, these act as sections on a single scrolling landing page */}
    <main>
      <Hero />
      <About />
      <Gallery />
      <Contact />
    </main>
    <Footer />
  </>
);

export default function App() {
  return (
    <BrowserRouter>
      {/* Keeping your minimal, dark slate background as the base */}
      <div className="min-h-screen bg-slate-900 font-sans">
        <Routes>
          {/* Public Route - The Common Browser Landing Page */}
          <Route path="/" element={<PublicLandingPage />} />

          {/* Different Portals for Different Users */}
          {/* Use the /* to allow for nested routing within the portals later */}
          <Route path="/user-portal/*" element={<UserPortalLayout />} />
          <Route path="/owner-portal/*" element={<OwnerPortalLayout />} />
          <Route path="/auth" element={<AuthLanding />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          
          {/* 404 Fallback Route */}
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