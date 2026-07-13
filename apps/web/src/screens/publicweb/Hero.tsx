import { useNavigate } from 'react-router-dom';

export default function Hero() {
  const navigate = useNavigate();

  return (
    <div 
      id="home"
      className="relative w-full min-h-screen bg-cover bg-center bg-no-repeat flex flex-col justify-end"
      style={{ 
        backgroundImage: "url('/Hero.png')",
        fontFamily: "'Montserrat', sans-serif" 
      }}
    >
      
      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-6 py-12 md:px-16 md:py-20 flex flex-col md:flex-row justify-between items-center md:items-end gap-12">
        
        {/* Left Column - Mobile App */}
        <div className="flex flex-col items-center text-center md:items-start md:text-left max-w-lg">
          <h1 className="text-white text-3xl md:text-4xl font-bold leading-tight mb-4 tracking-wide">
            Manage Your Operations<br className="hidden md:block" />
            With The Mobile App
          </h1>
          <p className="text-gray-200 text-sm md:text-base leading-relaxed mb-8 font-medium">
            Access Trip Management, Passenger Registration, Live<br className="hidden md:block" />
            Monitoring, QR Check-Ins, And Operational Tools Designed For<br className="hidden md:block" />
            Boat Owners And Crew Members.
          </p>
          <ShineButton text="Download Mobile App" />
        </div>

        {/* Right Column - Web Portal */}
        <div className="flex flex-col items-center text-center md:items-end md:text-right max-w-lg">
          <h1 className="text-white text-3xl md:text-4xl font-bold leading-tight mb-4 tracking-wide">
            Login Anytime,<br className="hidden md:block" />
            Anywhere
          </h1>
          <p className="text-gray-200 text-sm md:text-base leading-relaxed mb-8 font-medium">
            Enjoy Secure Access To Your Account Through Your Preferred<br className="hidden md:block" />
            Browser, Making It Easy To Stay Connected And Continue Your<br className="hidden md:block" />
            Activities From Virtually Anywhere.
          </p>
          <ShineButton text="Login to Web Portal" onClick={() => navigate('/login')} />
        </div>

      </div>
    </div>
  );
}

// Reusable Button Component with Metallic Shine Hover Effect
const ShineButton = ({ text, onClick }: { text: string; onClick?: () => void }) => {
  return (
    <button 
      onClick={onClick}
      className="group relative overflow-hidden bg-[#6FFFE9] text-black px-8 py-3 rounded font-bold text-sm md:text-base transition-all duration-300 hover:shadow-[0_0_20px_rgba(111,255,233,0.4)]"
    >
      {/* Button Text */}
      <span className="relative z-10">{text}</span>
      
      {/* Metallic Shine Element */}
      <div 
        className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/80 to-transparent skew-x-12 z-0 group-hover:animate-shine"
        style={{
          transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      ></div>
      
      {/* Hover state trigger for standard tailwind without modifying tailwind.config.js */}
      <style>{`
        .group:hover div {
          transform: translateX(150%);
        }
      `}</style>
    </button>
  );
};