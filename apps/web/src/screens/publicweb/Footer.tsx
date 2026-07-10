import ColorBends from '../../components/ColorBends';

export default function Footer() {
  return (
    <footer className="relative isolate overflow-hidden w-full bg-[#0B213E] text-white py-16 px-6 md:px-16" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <div className="absolute inset-0 z-0">
        <ColorBends
          colors={["#500cd0", "#8a5cff", "#00ffd1"]}
          rotation={90}
          speed={0.2}
          scale={1}
          frequency={1}
          warpStrength={1}
          mouseInfluence={1}
          noise={0.15}
          parallax={0.5}
          iterations={1}
          intensity={1.5}
          bandWidth={6}
          transparent
          autoRotate={0}
          color="#06aad4"
        />
      </div>
      <div className="absolute inset-0 z-10 bg-slate-950/70" />
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
              <a href="#" className="flex items-center gap-2 hover:opacity-70 transition-opacity">FACEBOOK ↗</a>
              <a href="#" className="flex items-center gap-2 hover:opacity-70 transition-opacity">LINKEDIN ↗</a>
            </div>
          </div>

          {/* Column 4 & 5: Related Links */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <h4 className="text-xs font-bold uppercase tracking-widest opacity-60">Related Links</h4>
              <ul className="text-sm flex flex-col gap-2">
                <li>Ministry Of Defence</li>
                <li>Sri Lanka Coast Guard</li>
                <li>Sri Lanka Navy</li>
                <li>Sri Lanka Army</li>
              </ul>
            </div>
            <div className="flex flex-col gap-4 mt-auto">
              <ul className="text-sm flex flex-col gap-2">
                <li>Sri Lanka Air Force</li>
                <li>Coast Conservation</li>
                <li>NARA</li>
                <li>Ministry Of Fisheries</li>
                <li>Sri Lanka Police</li>
                <li>Sri Lanka Tourism Development Authority [SLTDA]</li>
                <li>Department Of Wildlife Conservation</li>
                <li>Marine Environment Protection Authority [MEPA]</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/10 pt-8 text-center text-xs opacity-60">
          <p>Copyright © Sri Lanka Coast Guard 2026 | Designed And Maintained By Sri Lanka Coast Guard Information Technology Department</p>
        </div>
      </div>
    </footer>
  );
}

