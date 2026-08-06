import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Icon } from '../../components/ui/icon';
import ShineButton from '../../components/ShineButton';
import { useNavigate } from 'react-router-dom';
import { register } from '../../auth/authApi';
import { useAuth } from '../../auth/useAuth';

const SignUp = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    role: '',
    username: '',
    fullName: '',
    nicNumber: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleSelection = (selectedRole: string) => {
    setFormData({ ...formData, role: selectedRole });
    setStep(2);
  };

  // Fixed: Made the event parameter optional so ShineButton can call it safely
  const handleFinalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    if (formData.password !== formData.confirmPassword) {
      window.alert('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      const role = formData.role === 'Boat Owner' ? 'BoatOwner' : 'BoatCrew';
      const email = formData.email.trim();
      await register({
        userName: formData.username.trim(),
        displayName: formData.fullName.trim(),
        nicNumber: formData.nicNumber.trim(),
        email,
        phoneNumber: formData.phone.trim(),
        password: formData.password,
        role,
      });
      const session = await login({ email, password: formData.password });
      navigate(session.roles.includes('BoatOwner') ? '/owner' : '/crew', { replace: true });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Account creation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: "easeIn" as const } }
  };

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center bg-gray-900 px-6 relative overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.9)), url('/BG2.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="w-full max-w-md z-10 flex flex-col items-center">
        
        <AnimatePresence mode="wait">
          
          {/* ================= STEP 1 ================= */}
          {step === 1 && (
            <motion.div 
              key="step1"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full flex flex-col items-center"
            >
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-wide text-center">
                Tell Us Who You Are!
              </h1>
              <p className="text-sm text-gray-200 mb-10 font-bold text-center">
                Almost There.
              </p>

              <div className="w-full flex flex-col gap-4">
                {['Boat Owner', 'Crew Member'].map((role) => (
                  <ShineButton
                    key={role}
                    text={role}
                    onClick={() => handleRoleSelection(role)}
                    className="w-full py-3"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ================= STEP 2 ================= */}
          {step === 2 && (
            <motion.div 
              key="step2"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full flex flex-col items-center"
            >
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-wide text-center">
                Let's Get Started!
              </h1>
              <p className="text-sm text-gray-200 mb-10 font-bold text-center">
                Just Few Steps Away.
              </p>

              <form className="w-full flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
                <input 
                  type="text" 
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter Username" 
                  minLength={3}
                  maxLength={64}
                  pattern="[a-zA-Z0-9._-]+"
                  title="Use 3–64 letters, numbers, dots, underscores, or hyphens."
                  className="w-full px-4 py-3 rounded-md bg-white text-gray-900 placeholder-indigo-900/60 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium text-sm"
                  required
                />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Enter Full Name"
                  maxLength={160}
                  autoComplete="name"
                  className="w-full px-4 py-3 rounded-md bg-white text-gray-900 placeholder-indigo-900/60 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium text-sm"
                  required
                />
                <input
                  type="text"
                  name="nicNumber"
                  value={formData.nicNumber}
                  onChange={handleChange}
                  placeholder="Enter NIC Number"
                  autoComplete="off"
                  pattern="([0-9]{9}[vVxX])|([0-9]{12})"
                  className="w-full px-4 py-3 rounded-md bg-white text-gray-900 placeholder-indigo-900/60 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium text-sm"
                  required
                />
                <input 
                  type="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter Email" 
                  className="w-full px-4 py-3 rounded-md bg-white text-gray-900 placeholder-indigo-900/60 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium text-sm"
                  required
                />
                <input 
                  type="tel" 
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Enter Phone" 
                  maxLength={32}
                  className="w-full px-4 py-3 rounded-md bg-white text-gray-900 placeholder-indigo-900/60 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium text-sm"
                  required
                />

                <div className="mt-2 w-full">
                  <ShineButton
                    text="Continue"
                    type="submit"
                    className="w-full py-3"
                  />
                </div>
              </form>
              
              <div className="mt-4">
                <p className="text-xs text-gray-400">
                  Got an account? <a href="/login" className="text-[#5EEAD4] hover:underline font-semibold">Signin</a>
                </p>
              </div>
            </motion.div>
          )}

          {/* ================= STEP 3 ================= */}
          {step === 3 && (
            <motion.div 
              key="step3"
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full flex flex-col items-center"
            >
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-wide text-center">
                Let's Get You Secured!
              </h1>
              <p className="text-sm text-gray-200 mb-10 font-bold text-center">
                One Last Step.
              </p>

              <form className="w-full flex flex-col gap-4" onSubmit={handleFinalSubmit}>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="New Password" 
                    minLength={12}
                    maxLength={128}
                    pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9]).{12,}"
                    title="Use at least 12 characters with uppercase, lowercase, a number, and a symbol."
                    className="w-full px-4 py-3 rounded-md bg-white text-gray-900 placeholder-indigo-900/60 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium text-sm pr-12"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-900 hover:text-black flex items-center justify-center"
                  >
                    <Icon name={showPassword ? "eyeoff" : "eye"} size={20} />
                  </button>
                </div>

                <div className="relative">
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm Password" 
                    minLength={12}
                    maxLength={128}
                    className="w-full px-4 py-3 rounded-md bg-white text-gray-900 placeholder-indigo-900/60 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium text-sm pr-12"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-900 hover:text-black flex items-center justify-center"
                  >
                    <Icon name={showConfirmPassword ? "eyeoff" : "eye"} size={20} />
                  </button>
                </div>

                <div className="mt-2 w-full">
                  {/* Fixed: Wrapped the function call in an anonymous arrow function */}
                  <ShineButton
                    text="Create Account"
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3"
                  />
                </div>
                
                <button 
                  type="button"
                  onClick={() => setStep(2)}
                  className="mt-2 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Back
                </button>
              </form>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default SignUp;
