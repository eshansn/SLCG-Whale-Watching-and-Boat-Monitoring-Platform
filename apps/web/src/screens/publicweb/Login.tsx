import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/icon';

interface LoginProps {
  onLogin: () => void;
}

const DEMO_OPS_CREDENTIALS = {
  email: 'ops@whalewatch.com',
  password: 'ops1234',
};

const Login = ({ onLogin }: LoginProps) => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (email.trim().toLowerCase() === DEMO_OPS_CREDENTIALS.email && password === DEMO_OPS_CREDENTIALS.password) {
      onLogin();
      navigate('/ops');
      return;
    }

    setError('Invalid email or password. Use the demo OPS credentials.');
  };

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center bg-gray-900 px-6 relative"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.8)), url('/contact.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="max-w-4xl w-full flex flex-col-reverse md:flex-row items-center justify-between gap-12 z-10">
        
        {/* Left Column - Login Form */}
        <div className="w-full max-w-md flex flex-col">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-wide">
            Welcome Back!
          </h1>
          <p className="text-sm text-gray-200 mb-8 font-medium">
            Continue Where You Left Off With Secure Account Access.
          </p>

          <form className="w-full flex flex-col" onSubmit={handleLogin}>
            {/* Email/Username Input */}
            <div className="mb-4">
              <input 
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="Enter email or user name"
                className="w-full px-4 py-3 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-400"
                required
              />
            </div>

            {/* Password Input */}
            <div className="relative mb-2">
              <input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
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

            {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

            {/* Functional Login Button */}
            <button
              type="submit"
              className="w-full sm:w-44 px-4 py-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-gray-900 shadow-lg"
            >
              Login
            </button>

            {/* Optional: Sign Up Redirect */}
            <p className="text-sm text-gray-400 mt-6">
              Don't have an account?{' '}
              <a href="/signup" className="text-teal-400 hover:text-teal-300 font-medium transition-colors">
                Sign Up
              </a>
            </p>
          </form>
        </div>

        {/* Right Column - Logo */}
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