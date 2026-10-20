import type { CarState, Intent } from '../types';
import { Part } from './Part';

/**
 * One long, slim vent unit: a single chrome outline, two vent mouths and the hazard switch
 * between them. Level and mirror-symmetric about the centre-stack axis (x 1146).
 */
const OUTLINE = 'M967 428 L1325 428 Q1331 428 1329 441 Q1321 466 1299 481 Q1291 486 1279 486 L1013 486 Q1001 486 993 481 Q971 466 963 441 Q961 428 967 428 Z';
const MOUTH = 'M978 434.5 L1314 434.5 Q1319 434.5 1307 452 Q1295 469 1277 477 L1015 477 Q997 469 985 452 Q973 434.5 978 434.5 Z';
const SLATS = [446, 454, 462, 470];

/** Centre vents with the hazard switch between them. */
export function VentModule({ car, onIntent }: { car: CarState; onIntent: (i: Intent) => void }) {
  const open = car.ignition !== 'off' && car.climate.on;
  return (
    <Part x={950} y={420} w={392} h={80} className="vents">
      <defs>
        <clipPath id="v-mouth"><path d={MOUTH} /></clipPath>
        <linearGradient id="v-depth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#010203" />
          <stop offset="0.6" stopColor="#05070a" />
          <stop offset="1" stopColor="#0a0d12" />
        </linearGradient>
      </defs>
      <path d={OUTLINE} fill="#06080b" />
      <path d={MOUTH} fill="url(#v-depth)" />
      {/* Slats tilt open when air is flowing */}
      <g clipPath="url(#v-mouth)">
        {SLATS.map((y, i) => (
          <g key={y} className={`slat ${open ? 'open' : ''}`} style={{ transitionDelay: `${i * 40}ms` }}>
            <path d={`M972 ${y} L1120 ${y + 0.6}`} stroke="#151a22" strokeWidth="4.5" />
            <path d={`M972 ${y - 1.5} L1120 ${y - 0.9}`} stroke="#39424f" strokeWidth="0.7" className="slat-edge" />
            <path d={`M1172 ${y} L1320 ${y + 0.6}`} stroke="#151a22" strokeWidth="4.5" />
            <path d={`M1172 ${y - 1.5} L1320 ${y - 0.9}`} stroke="#39424f" strokeWidth="0.7" className="slat-edge" />
          </g>
        ))}
        {/* Chrome direction tabs */}
        <rect x="1032" y="455" width="26" height="3.4" rx="1.7" fill="url(#d-chromeH)" />
        <rect x="1234" y="455" width="26" height="3.4" rx="1.7" fill="url(#d-chromeH)" />
      </g>
      <path d={MOUTH} fill="none" stroke="#000" strokeWidth="2" opacity="0.7" />
      {/* Chrome surround: bright along the top, softer round the ends and the lower lip */}
      <path d={OUTLINE} fill="none" stroke="url(#d-chrome)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M970 429.4 L1322 429.4" stroke="#ffffff" strokeWidth="0.8" opacity="0.7" />
      <path d="M1013 487.6 L1279 487.6" stroke="#dfe5ee" strokeWidth="0.8" opacity="0.55" />

      {/* Hazard switch */}
      <g className={`hit hazard ${car.hazard ? 'on' : ''}`} onClick={() => onIntent({ type: 'lights.hazard', on: !car.hazard })} role="button" aria-label="Hazard lights">
        <title>Hazard lights</title>
        <rect x="1123" y="444.5" width="46" height="33" rx="4" fill="#06080b" />
        <rect x="1125" y="446.5" width="42" height="29" rx="3.4" fill="#0c0e12" stroke="#252b35" strokeWidth="0.8" />
        <path d="M1127.5 447.6 L1164.5 447.6" stroke="#3a414d" strokeWidth="0.7" />
        <g className="hz-glow"><path d="M1146 452 L1157.5 470.5 L1134.5 470.5 Z" fill="#ff2a2a" opacity="0.5" filter="url(#d-b3)" /></g>
        <path d="M1146 451.5 L1157.5 470.5 L1134.5 470.5 Z" fill="none" stroke="#ff3a30" strokeWidth="2.2" strokeLinejoin="round" className="hz-tri" />
        <path d="M1146 458 L1151.6 467.4 L1140.4 467.4 Z" fill="none" stroke="#ff3a30" strokeWidth="1.3" strokeLinejoin="round" className="hz-tri" />
      </g>
    </Part>
  );
}
