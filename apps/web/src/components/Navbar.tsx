import { useEffect, useState, type MouseEvent } from 'react';
import { Menu, X } from 'lucide-react';

const navLinks = [
    { label: 'Home', href: '#home' },
    { label: 'About', href: '#about' },
    { label: 'Gallery', href: '#gallery' },
    { label: 'Contact', href: '#contact' },
];

export default function Navbar() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    const handleNavClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
        event.preventDefault();
        setMobileMenuOpen(false);

        const target = document.querySelector(href);
        if (!target) {
            window.location.hash = href;
            return;
        }

        const rect = target.getBoundingClientRect();
        const top = rect.top + window.scrollY ;;
        window.scrollTo({
            top,
            behavior: 'smooth',
        });
    };

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <nav 
                className={`fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between rounded-full transition-all duration-300 ease-out overflow-hidden px-6 md:px-8 py-3 md:py-4
                ${isScrolled 
                    ? 'w-[95%] md:w-[85%] max-w-6xl bg-white text-black shadow-lg' 
                    : 'w-[200px] md:w-[260px] bg-white/60 backdrop-blur-md border border-white/50 shadow-sm text-black'
                }`}
            >
                <a 
                    href="#home"
                    className={`flex items-center justify-center flex-shrink-0 relative z-10 transition-all duration-300 ease-out
                    ${isScrolled ? 'w-[140px] md:w-[180px]' : 'w-[152px] md:w-[196px]'}`}
                >
                    <img 
                        src="/SLCG.png" 
                        alt="SLCG" 
                        className="h-10 md:h-12 w-full object-contain"
                    />
                </a>

                <div 
                    className={`hidden md:flex items-center overflow-hidden transition-all duration-300 ease-out
                    ${isScrolled ? 'max-w-[800px] opacity-100' : 'max-w-0 opacity-0'}`}
                >
                    <div 
                        className={`flex items-center gap-8 pl-8 text-sm font-medium transition-transform duration-300 ease-out
                        ${isScrolled ? 'translate-x-0' : 'translate-x-32'}`}
                    >
                        {navLinks.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                onClick={(event) => handleNavClick(event, link.href)}
                                className="hover:text-gray-500 transition-colors"
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>
                </div>

                <div 
                    className={`md:hidden flex items-center overflow-hidden transition-all duration-300 ease-out
                    ${isScrolled ? 'max-w-[50px] opacity-100' : 'max-w-0 opacity-0'}`}
                >
                    <div 
                        className={`flex items-center pl-4 transition-transform duration-300 ease-out
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
                    {navLinks.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            onClick={(event) => handleNavClick(event, link.href)}
                            className="hover:text-gray-500 py-3 border-b border-gray-100"
                        >
                            {link.label}
                        </a>
                    ))}
                </div>
            </div>
        </>
    );
}