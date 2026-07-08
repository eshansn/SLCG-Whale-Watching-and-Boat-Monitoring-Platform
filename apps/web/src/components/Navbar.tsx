import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const onExplore = () => {
        console.log("Explore button clicked");
    };

    return (
        <>
            <nav 
                className={`fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between rounded-full transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden px-6 md:px-8 py-3 md:py-4
                ${isScrolled 
                    ? 'w-[95%] md:w-[85%] max-w-6xl bg-white text-black shadow-lg' 
                    : 'w-[200px] md:w-[260px] bg-white/60 backdrop-blur-md border border-white/50 shadow-sm text-black'
                }`}
            >
                <div 
                    className={`flex items-center justify-center flex-shrink-0 relative z-10 transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)]
                    ${isScrolled ? 'w-[140px] md:w-[180px]' : 'w-[152px] md:w-[196px]'}`}
                >
                    <img 
                        src="/SLCG.png" 
                        alt="SLCG" 
                        className="h-8 md:h-10 w-full object-contain"
                    />
                </div>

                <div 
                    className={`hidden md:flex items-center overflow-hidden transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)]
                    ${isScrolled ? 'max-w-[800px] opacity-100' : 'max-w-0 opacity-0'}`}
                >
                    <div 
                        className={`flex items-center gap-8 pl-8 text-sm font-medium transition-transform duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] delay-75
                        ${isScrolled ? 'translate-x-0' : 'translate-x-32'}`}
                    >
                        <a href="#" className="hover:text-gray-500 transition-colors">Home</a>
                        <a href="#" className="hover:text-gray-500 transition-colors">About</a>
                        <a href="#" className="hover:text-gray-500 transition-colors">Services</a>
                        <a href="#" className="hover:text-gray-500 transition-colors">Testimonials</a>
                        
                        <button 
                            onClick={onExplore}
                            className="group bg-black text-white px-6 md:px-8 py-2.5 md:py-3 rounded-full inline-flex items-center gap-2 text-[15px] md:text-[17px] font-medium transition-all duration-300 hover:bg-gray-800 hover:scale-[1.00] shadow-md relative z-10"
                        >
                            contact 
                            <img src="/astrixwb.png" className="w-4 h-4 md:w-5 md:h-5 object-contain transition-transform duration-500 ease-out group-hover:rotate-90" alt="*" />
                        </button>
                    </div>
                </div>

                <div 
                    className={`md:hidden flex items-center overflow-hidden transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)]
                    ${isScrolled ? 'max-w-[50px] opacity-100' : 'max-w-0 opacity-0'}`}
                >
                    <div 
                        className={`flex items-center pl-4 transition-transform duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)]
                        ${isScrolled ? 'translate-x-0' : 'translate-x-8'}`}
                    >
                        <button 
                            className="text-black p-1 hover:opacity-70 transition-opacity"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </nav>

            <div 
                className={`fixed top-24 left-1/2 -translate-x-1/2 w-[95%] max-w-sm bg-white text-black shadow-2xl rounded-3xl md:hidden z-40 transition-all duration-500 origin-top
                ${mobileMenuOpen && isScrolled ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
            >
                <div className="flex flex-col gap-2 p-6 font-medium text-center">
                    <a href="#" className="hover:text-gray-500 py-3 border-b border-gray-100">Home</a>
                    <a href="#" className="hover:text-gray-500 py-3 border-b border-gray-100">About</a>
                    <a href="#" className="hover:text-gray-500 py-3 border-b border-gray-100">Services</a>
                    <a href="#" className="hover:text-gray-500 py-3 border-b border-gray-100">Testimonials</a>
                    <button 
                        onClick={onExplore}
                        className="group bg-black text-white px-6 md:px-8 py-2.5 md:py-3 rounded-full inline-flex justify-center items-center gap-2 text-[15px] md:text-[17px] font-medium transition-all duration-300 hover:bg-gray-800 hover:scale-[1.05] shadow-md relative z-10 w-full mt-2"
                    >
                        explore 
                        <img src="/astrixwb.png" className="w-4 h-4 md:w-5 md:h-5 object-contain transition-transform duration-500 ease-out group-hover:rotate-90" alt="*" />
                    </button>
                </div>
            </div>
        </>
    );
}