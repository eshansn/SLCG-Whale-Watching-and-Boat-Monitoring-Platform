import { Globe } from 'lucide-react';

function SocialIcon({ service }: { service: 'facebook' | 'linkedin' }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true" focusable="false">
    {service === 'facebook' ? <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /> : <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" />
    </>}
  </svg>;
}

export default function Footer() {
  return (
    <footer className="public-footer relative isolate overflow-hidden w-full py-16 px-6 md:px-16" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <div className="relative z-20 max-w-[1400px] mx-auto">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-16">
          
          {/* Column 1: Location */}
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-60">Location</h4>
            <p className="text-sm">Udupila, Mirissa,<br />Matara, Sri Lanka</p>
          </div>

          {/* Column 2: Contact */}
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-60">Contact</h4>
            <div className="text-sm flex flex-col gap-1">
              <p>+94 412 260 312</p>
              <a href="mailto:Dgsecretariat@Coastguard.Gov.lk" className="hover:underline">Dgsecretariat@Coastguard.Gov.lk</a>
            </div>
          </div>

          {/* Column 3: Follow */}
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-60">Follow</h4>
            <div className="text-sm flex flex-col gap-2">
              <a href="https://www.facebook.com/share/1GvU3cb2ij/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-70 transition-opacity">FACEBOOK<SocialIcon service="facebook" /></a>
              <a href="https://www.linkedin.com/company/sri-lanka-coast-guard" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-70 transition-opacity">LINKEDIN<SocialIcon service="linkedin" /></a>
            </div>
          </div>

          {/* Column 4 & 5: Related Links */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <h4 className="text-xs font-bold uppercase tracking-widest opacity-60">Related Links</h4>
              <ul className="text-sm flex flex-col gap-2">
                <li><a href="https://www.defence.lk/" target="_blank" rel="noopener noreferrer">Ministry Of Defence</a></li>
                <li><a href="https://coastguard.gov.lk/" target="_blank" rel="noopener noreferrer">Sri Lanka Coast Guard<Globe size={14} className="ml-2 inline-block align-middle" aria-hidden="true" /></a></li>
                <li><a href="https://www.navy.lk/" target="_blank" rel="noopener noreferrer">Sri Lanka Navy</a></li>
                <li><a href="https://www.army.lk/" target="_blank" rel="noopener noreferrer">Sri Lanka Army</a></li>
              </ul>
            </div>
            <div className="flex flex-col gap-4 mt-auto">
              <ul className="text-sm flex flex-col gap-2">
                <li><a href="https://www.airforce.lk/" target="_blank" rel="noopener noreferrer">Sri Lanka Air Force</a></li>
                <li><a href="https://www.coastal.gov.lk/" target="_blank" rel="noopener noreferrer">Coast Conservation</a></li>
                <li><a href="https://www.nara.ac.lk/" target="_blank" rel="noopener noreferrer">NARA</a></li>
                <li><a href="https://www.fisheries.gov.lk/" target="_blank" rel="noopener noreferrer">Ministry Of Fisheries</a></li>
                <li><a href="https://www.police.lk/" target="_blank" rel="noopener noreferrer">Sri Lanka Police</a></li>
                <li><a href="https://www.sltda.gov.lk/en" target="_blank" rel="noopener noreferrer">Sri Lanka Tourism Development Authority [SLTDA]</a></li>
                <li><a href="https://www.dwc.gov.lk/" target="_blank" rel="noopener noreferrer">Department Of Wildlife Conservation</a></li>
                <li><a href="https://mepa.gov.lk/" target="_blank" rel="noopener noreferrer">Marine Environment Protection Authority [MEPA]</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="public-footer-copyright border-t border-white/10 pt-8 text-center text-xs opacity-60">
          <p>Copyright © Sri Lanka Coast Guard 2026 | Designed And Maintained By Sri Lanka Coast Guard Information Technology Department</p>
        </div>
      </div>
    </footer>
  );
}

