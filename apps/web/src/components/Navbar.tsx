import { useEffect, useState, type MouseEvent } from 'react';
import { House, Images, Info, Mail, Menu, X } from 'lucide-react';

const navLinks = [
    { label: 'Home', href: '#home', icon: House },
    { label: 'About', href: '#about', icon: Info },
    { label: 'Gallery', href: '#gallery', icon: Images },
    { label: 'Contact', href: '#contact', icon: Mail },
];

export default function Navbar() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    const handleNavClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
        setMobileMenuOpen(false);

        const target = document.querySelector(href);
        if (!target) return;
        event.preventDefault();

        const rect = target.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        window.scrollTo({
            top,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
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
                className={`public-navbar fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between rounded-full transition-all duration-300 ease-out overflow-hidden px-6 lg:px-8 py-3 md:py-4
                ${isScrolled 
                    ? 'w-[95%] md:w-[85%] max-w-6xl text-black'
                    : 'w-[200px] md:w-[260px] text-black'
                }`}
            >
                <a 
                    href="#home"
                    className={`flex items-center justify-center flex-shrink-0 relative z-10 transition-all duration-300 ease-out
                    ${isScrolled ? 'w-[140px] lg:w-[180px]' : 'w-[152px] md:w-[196px]'}`}
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
                        className={`flex items-center gap-2 lg:gap-8 pl-3 lg:pl-8 text-xs lg:text-sm font-medium transition-transform duration-300 ease-out
                        ${isScrolled ? 'translate-x-0' : 'translate-x-32'}`}
                    >
                        {navLinks.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                onClick={(event) => handleNavClick(event, link.href)}
                                className="rounded-full p-2 hover:text-cyan-200 transition-colors"
                                aria-label={link.label}
                                title={link.label}
                            >
                                <span className="flex items-center gap-2"><link.icon size={18}/><span>{link.label}</span></span>
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
                            type="button"
                            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                            aria-expanded={mobileMenuOpen && isScrolled}
                            aria-controls="public-mobile-navigation"
                            className="text-black p-1 hover:opacity-70 transition-opacity"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </nav>

            <div 
                id="public-mobile-navigation"
                className={`fixed top-24 left-1/2 -translate-x-1/2 w-[95%] max-w-sm rounded-3xl md:hidden z-40 transition-all duration-500 origin-top
                ${mobileMenuOpen && isScrolled ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
            >
                <div className="flex flex-col gap-2 p-6 font-medium text-center">
                    {navLinks.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            onClick={(event) => handleNavClick(event, link.href)}
                            className="flex items-center justify-center py-3 border-b border-gray-100 hover:text-cyan-200"
                            aria-label={link.label}
                            title={link.label}
                        >
                            <span className="flex items-center gap-2"><link.icon size={20}/><span>{link.label}</span></span>
                        </a>
                    ))}
                </div>
            </div>
        </>
    );
}
