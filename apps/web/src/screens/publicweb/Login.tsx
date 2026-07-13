import React, { useState } from 'react';
import { Icon } from '../../components/ui/icon';
import ShineButton from '../../components/ShineButton';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center bg-gray-900 px-6 relative"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.8)), url('/contact.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Notice the change here: 'flex-col-reverse' is used instead of 'flex-col'.
        This stacks the logo on top for mobile, while 'md:flex-row' keeps it on the right for desktop.
      */}
      <div className="max-w-4xl w-full flex flex-col-reverse md:flex-row items-center justify-between gap-12 z-10">
        
        {/* Left Column (Desktop) / Bottom Column (Mobile) - Login Form */}
        <div className="w-full max-w-md flex flex-col">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-wide">
            Welcome Back!
          </h1>
          <p className="text-sm text-gray-200 mb-8 font-medium">
            Continue Where You Left Off With Secure Account Access.
          </p>

          <form className="w-full flex flex-col" onSubmit={(e) => e.preventDefault()}>
            {/* Email/Username Input */}
            <div className="mb-4">
              <input 
                type="text" 
                placeholder="Enter email or user name" 
                className="w-full px-4 py-3 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-400"
                required
              />
            </div>

            {/* Password Input */}
            <div className="relative mb-2">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Password" 
                className="w-full px-4 py-3 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-400 pr-12"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900 flex items-center justify-center"
              >
                <Icon name={showPassword ? "eyeoff" : "eye"} size={20} />
              </button>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end mb-8">
              <a href="#" className="text-xs text-gray-400 hover:text-white transition-colors">
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <ShineButton
              text="Sign Up"
              className="w-full sm:w-44"
              onClick={() => (window.location.href = "/signup")}
            />
          </form>
        </div>

        {/* Right Column (Desktop) / Top Column (Mobile) - Logo */}
        <div className="w-full md:w-auto flex justify-center md:justify-end shrink-0">
          <div className="w-48 h-64 md:w-64 md:h-80 flex items-center justify-center">
            <img 
              src="/SLCGicon.png" 
              alt="Sri Lanka Coast Guard 2010" 
              className="w-full h-full object-contain drop-shadow-2xl"
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;