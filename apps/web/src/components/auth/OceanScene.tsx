import type { CSSProperties } from 'react';

export default function OceanScene() {
  return <div className="ocean-auth-ocean" aria-hidden="true">
    <div className="ocean-auth-ocean-light" />
    <div className="ocean-auth-ocean-beam" />
    <div className="ocean-auth-particles">
      {Array.from({ length: 18 }, (_, index) => <span key={index} style={{
        '--x': `${(index * 37 + 7) % 100}%`, '--y': `${(index * 23 + 11) % 100}%`,
        '--duration': `${18 + (index % 5) * 4}s`, '--delay': `${index * -2.7}s`,
        '--size': `${index % 3 === 0 ? 3 : 2}px`,
      } as CSSProperties} />)}
    </div>
  </div>;
}

export function OceanWhale() {
  return <div className="ocean-auth-whale" aria-hidden="true">
    <div className="ocean-auth-whale-halo" />
    <svg viewBox="0 0 640 360" fill="none" className="ocean-auth-whale-svg">
      <defs>
        <linearGradient id="ocean-auth-whale-stroke" x1="75" y1="100" x2="540" y2="265" gradientUnits="userSpaceOnUse">
          <stop stopColor="#319bad" /><stop offset=".48" stopColor="#8AF5FF" /><stop offset="1" stopColor="#35E6F7" />
        </linearGradient>
      </defs>
      <path className="ocean-auth-whale-outline" pathLength="1" stroke="url(#ocean-auth-whale-stroke)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        d="M94 164 C79 152 66 134 56 112 C81 110 100 120 114 138 C117 113 130 94 154 81 C157 110 146 140 127 158 C170 151 194 129 220 119 L233 104 C243 107 244 116 242 120 C256 111 271 105 286 102 C357 94 413 105 460 126 C493 141 529 159 553 179 C564 189 563 199 553 210 C535 230 504 248 468 259 C427 273 388 272 347 262 C326 280 293 299 263 294 C278 278 290 258 295 240 C232 223 180 200 127 180 C112 184 99 199 83 202 C90 186 91 174 94 164 Z" />
      <path className="ocean-auth-whale-detail" pathLength="1" stroke="#8AF5FF" strokeWidth="1" strokeLinecap="round" opacity=".5"
        d="M557 199 C532 208 503 211 474 209 M536 218 C490 247 419 261 354 250 M295 240 C312 245 328 254 347 262" />
    </svg>
  </div>;
}
