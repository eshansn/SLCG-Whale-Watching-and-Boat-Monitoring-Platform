import React, { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Icon } from '../../components/ui/icon';
import ShineButton from '../../components/ShineButton'; // Added ShineButton import

const SignUp = () => {
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    role: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleSelection = (selectedRole: string) => {
    setFormData({ ...formData, role: selectedRole });
    setStep(2);
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form Submitted:", formData);
    // Add your API submission logic here
  };

  // Strictly typed variants to keep TypeScript happy
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
                {['Boat Owner', 'Crew Member', 'Passenger'].map((role) => (
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
                  className="w-full px-4 py-3 rounded-md bg-white text-gray-900 placeholder-indigo-900/60 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium text-sm"
                  required
                />

                <div className="mt-2 w-full">
                  <ShineButton
                    text="Continue"
                    onClick={() => setStep(3)}
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
                  <ShineButton
                    text="Create Account"
                    onClick={handleFinalSubmit}
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