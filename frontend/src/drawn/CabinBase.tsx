import { memo } from 'react';
import { CABIN_H, CABIN_W, FOOTWELL_DX, INTERIOR, STRIPS } from './geometry';

/**
 * The static body of the cabin: pillars, dashboard, door, centre stack shell,
 * console, floor and pedals. Never re-renders, so its blur filters are
 * rasterised once.
 */
export const CabinBase = memo(function CabinBase() {
  return (
    <svg className="part" style={{ left: 0, top: 0, width: CABIN_W, height: CABIN_H }} viewBox={`0 0 ${CABIN_W} ${CABIN_H}`}>
      <defs>
        <clipPath id="d-interiorClip"><path d={INTERIOR} clipRule="evenodd" /></clipPath>
        <linearGradient id="d-glassShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.18" />
          <stop offset="0.75" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
      </defs>

      {/* Windshield: a faint reflection of the dash and a dark band at the base */}
      <path d="M606 0 L1884 0 L1884 276 L1500 266 L1000 260 L755 251 Z" fill="url(#d-glassShade)" />
      <path d="M700 10 L1100 10 L860 250 L760 250 Z" fill="#ffffff" opacity="0.025" />

      {/* Interior shell */}
      <path d={INTERIOR} fillRule="evenodd" fill="#07090e" />

      {/* Left A-pillar: rubber seal, then the light fabric trim */}
      <path d="M430 0 L470 0 L648 280 L606 296 Z" fill="#090c11" />
      <path d="M470 0 L606 0 L755 251 L742 262 L700 271 L648 280 Z" fill="url(#d-pillar)" />
      <path d="M470 0 L606 0 L755 251 L742 262 L700 271 L648 280 Z" fill="url(#d-pillarShade)" />
      <path d="M606 0 L755 251" stroke="#cfd4db" strokeWidth="1.4" opacity="0.55" />
      <path d="M520 0 L690 268" stroke="#1d2129" strokeWidth="6" opacity="0.35" filter="url(#d-b3)" />

      {/* Right A-pillar */}
      <path d="M1884 0 L1933 0 L1933 292 L1904 300 L1884 278 Z" fill="url(#d-pillarR)" />
      <path d="M1884 0 L1933 0 L1933 292 L1904 300 L1884 278 Z" fill="url(#d-pillarShade)" />

      {/* Rear-view mirror */}
      <rect x="1062" y="0" width="30" height="8" fill="#0d1015" />
      <path d="M952 0 L1203 0 L1199 34 Q1196 58 1172 61 L984 58 Q960 56 957 34 Z" fill="#0a0c10" />
      <path d="M960 30 Q963 54 986 56 L1170 59 Q1193 56 1196 32" stroke="#2a313d" strokeWidth="1.4" fill="none" />
      <path d="M965 6 L1190 6" stroke="#1b2029" strokeWidth="1" />

      {/* Dashboard top plane */}
      <path d="M640 282 L700 270 L755 251 L1000 260 L1500 266 L1884 276 L1933 280 L1933 312 L1840 300 L1760 292 L1600 278 L1440 292 L1345 296 L1005 300 L985 318 L850 316 L700 312 L622 312 Z" fill="url(#d-dashTop)" />
      <path d="M760 257 L1000 265 L1500 271 L1880 281" stroke="#2a425c" strokeWidth="1.6" />
      <path d="M762 266 L1000 273 L1500 278 L1880 288" stroke="#03080d" strokeWidth="7" />
      <ellipse cx="860" cy="292" rx="240" ry="16" fill="#a9c2e0" opacity="0.07" filter="url(#d-b8)" />
      {/* Sky-lit plane on the driver side, right of the cluster hood */}
      <path d="M1790 300 L1884 284 L1933 296 L1933 340 L1820 345 Z" fill="#5f6b83" opacity="0.75" filter="url(#d-b3)" />

      {/* Passenger dash face */}
      <path d="M622 312 L700 312 L850 316 L985 318 L982 345 L962 373 L622 347 L600 352 L598 314 Z" fill="url(#d-dashFace)" />
      <path d="M624 313 L850 317 L984 319" stroke="#4d6280" strokeWidth="1.2" opacity="0.6" />
      {/* Recess under the upper light pipe, with a satin trim line */}
      <path d="M622 350 Q790 364 962 376 L965 431 L712 413 L624 406 Z" fill="#05080c" />
      <path d="M652 408 L962 431" stroke="#4a586b" strokeWidth="1.2" opacity="0.45" />
      <path d="M712 413 L962 432" stroke="#6d7c91" strokeWidth="1" opacity="0.55" />
      {/* Lower face and knee panel */}
      <path d="M624 406 L712 413 L965 432 L966 452 L950 497 C880 466, 760 445, 625 428 Z" fill="url(#d-lowFace)" />
      <path d="M712 419 L958 437" stroke="#1e2a3a" strokeWidth="4" opacity="0.7" filter="url(#d-b3)" />
      <path d="M625 428 C760 445, 880 466, 948 498 L985 565 L975 610 L900 640 L760 610 L625 560 Z" fill="#020408" />

      {/* Passenger footwell */}
      <path d="M600 560 L760 610 L900 640 L940 690 L900 814 L560 814 L600 700 Z" fill="url(#d-floor)" />

      {/* Door */}
      <path d="M0 312 L600 298 L622 304 L618 336 L0 362 Z" fill="url(#d-doorTop)" />
      <path d="M0 305 L600 296" stroke="#2c4462" strokeWidth="1.6" opacity="0.8" />
      <path d="M0 362 L618 336 L612 347 L572 347 Q290 388 0 450 Z" fill="#060c13" />
      <path d="M0 450 Q290 388 572 347 L612 347 L620 360 L615 500 L585 466 L420 482 Q340 495 300 530 Q260 565 180 580 L0 615 Z" fill="url(#d-door)" />
      {/* Door handle recess and chrome lever */}
      <path d="M392 446 Q381 441 391 428 L428 390 Q434 384 444 383 L524 375 Q537 374 532 385 L500 425 Q494 433 484 434 L403 449 Q396 450 392 446 Z" fill="#04060a" stroke="#2a3646" strokeWidth="1.2" />
      <path d="M393 431 L429 393 Q435 387 445 386 L522 378" stroke="#000" strokeWidth="3" opacity="0.6" fill="none" filter="url(#d-b1)" />
      <path d="M396 444 L484 430 Q492 429 497 423" stroke="#2c3747" strokeWidth="1" fill="none" />
      {/* Lever: a slim satin bar with one lit edge, and the pull hook rising at its end */}
      <path d="M401 446 Q407 435 417 428 L504 417" stroke="#000" strokeWidth="4" opacity="0.55" strokeLinecap="round" fill="none" filter="url(#d-b1)" />
      <path d="M414 424 Q425 408 441 398" stroke="url(#d-satinLever)" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.8" />
      <path d="M399 442 Q405 431 415 423 L502 412" stroke="url(#d-satinLever)" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M399.5 440 Q405.5 429.5 415.5 421.5 L502 410.5" stroke="#f1f4f8" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.85" />
      <path d="M415 422.5 Q425.5 407 441 397.5" stroke="#dfe5ee" strokeWidth="0.7" strokeLinecap="round" fill="none" opacity="0.7" />
      {/* Armrest */}
      <path d="M0 615 L180 580 Q260 565 300 530 Q340 495 420 482 L585 466 L602 474 L596 524 L300 600 L0 682 Z" fill="#070b11" />
      <path d="M0 615 L180 580 Q260 565 300 530 Q340 495 420 482 L585 466" stroke="#24324a" strokeWidth="1.4" fill="none" />
      <path d="M0 623 L180 589 Q262 573 302 539 Q342 504 420 491 L585 475" stroke="#2a384e" strokeWidth="2.4" opacity="0.45" fill="none" filter="url(#d-b3)" />
      {/* Lower door, pocket and speaker */}
      <path d="M0 682 L300 600 L596 524 L605 560 L620 700 L560 814 L0 814 Z" fill="url(#d-door)" />
      <path d="M30 728 L592 577" stroke="#121a26" strokeWidth="2" filter="url(#d-b1)" />
      <path d="M545 560 L600 548 L622 600 L620 660 L560 668 L540 610 Z" fill="#07090d" />
      <path d="M545 560 L600 548 L622 600 L620 660 L560 668 L540 610 Z" fill="url(#d-grille)" />
      <path d="M545 560 L600 548 L622 600 L620 660 L560 668 L540 610 Z" stroke="#10151d" strokeWidth="1.2" fill="none" />
      <path d="M618 336 L622 360 L615 520 L620 700" stroke="#020304" strokeWidth="3" fill="none" />

      {/* Centre stack shell and the floating screen: slim gloss bezel, one soft top edge */}
      <path d="M985 300 L1340 304 L1342 420 L1335 430 L1325 500 L1310 565 L985 565 L975 500 L958 440 L962 372 L982 345 Z" fill="url(#d-stack)" />
      <ellipse cx="1146" cy="416" rx="158" ry="7" fill="#000" opacity="0.75" filter="url(#d-b3)" />
      <rect x="984" y="283" width="324" height="128" rx="10" fill="url(#d-bezel)" stroke="#1d232c" strokeWidth="0.8" />
      <rect x="990" y="288" width="312" height="118" rx="7" fill="#020306" />
      <path d="M994 284.4 L1298 284.4" stroke="#596374" strokeWidth="0.8" opacity="0.55" />

      {/* Knee panel and column shroud behind the wheel, catching a little footwell light */}
      <path d="M1380 432 L1810 432 L1820 560 L1780 650 L1400 650 L1370 560 Z" fill="url(#d-knee)" />
      <path d="M1392 600 Q1580 590 1790 604" stroke="#24344a" strokeWidth="1.2" opacity="0.6" fill="none" />
      <path d="M1532 470 L1652 470 L1672 650 L1512 650 Z" fill="#06080b" />

      {/* Cluster hood behind the wheel */}
      <path d="M1405 305 Q1420 288 1450 285 L1600 276 L1745 285 Q1785 290 1795 312 L1780 432 L1410 432 Z" fill="#05070b" />
      <path d="M1430 288 Q1600 270 1780 292" stroke="#2f3846" strokeWidth="2" opacity="0.75" fill="none" />

      {/* Driver side dash, vents and switch panel */}
      <path d="M1780 292 L1884 278 L1904 300 L1933 300 L1933 814 L1832 814 L1818 640 L1820 560 L1810 430 L1795 312 Z" fill="#060a10" />
      <ellipse cx="1870" cy="330" rx="38" ry="16" fill="#05070a" />
      {[322, 328, 334, 340].map((y) => <path key={y} d={`M1840 ${y} Q1870 ${y - 3} 1902 ${y}`} stroke="#1c232d" strokeWidth="1.5" fill="none" />)}
      <path d="M1815 383 Q1870 380 1933 386" stroke="#2a3240" strokeWidth="1" strokeDasharray="3 3" fill="none" />
      <rect x="1815" y="440" width="125" height="60" rx="8" fill="#05070a" />
      {[452, 465, 478, 490].map((y) => <path key={y} d={`M1822 ${y} L1933 ${y + 2}`} stroke="#1a212b" strokeWidth="2" />)}
      <rect x="1840" y="463" width="40" height="4" rx="2" fill="url(#d-chromeH)" opacity="0.8" />
      <path d="M1814 560 Q1812 556 1818 556 L1924 560 Q1930 560 1930 566 L1928 598 Q1928 604 1922 604 L1818 600 Q1812 600 1812 594 Z" fill="#05070a" stroke="#141a22" strokeWidth="1" />

      {/* Centre console */}
      <path d="M985 565 L1310 565 L1330 640 L1350 814 L890 814 L935 690 L975 610 Z" fill="url(#d-console)" />
      <path d="M1305 570 Q1290 650 1255 814" stroke="#1b2330" strokeWidth="2" fill="none" />
      <path d="M975 610 L935 690 L900 814" stroke="#141b26" strokeWidth="2" fill="none" />
      {/* Comfort key row (drawn with the console, see Console.tsx) sits in this recess */}
      <path d="M1117 595 L1263 594 L1265 643 L1115 644 Z" fill="#05070a" stroke="#121820" strokeWidth="1" />
      <path d="M935 690 L1210 680 L1225 814 L900 814 Z" fill="#06080b" />

      {/* Driver footwell and dead pedal (pedals are interactive, see Pedals.tsx) */}
      <path d="M1300 650 L1818 640 L1832 814 L1300 814 Z" fill="url(#d-floor)" />
      <g transform={`translate(${FOOTWELL_DX} 0)`}>
        <path d="M1365 668 L1438 664 L1448 800 L1372 806 Z" fill="#07090d" />
        <path d="M1365 668 L1438 664 L1448 800 L1372 806 Z" fill="url(#d-ribs)" />
        <path d="M1365 668 L1438 664 L1448 800 L1372 806 Z" stroke="#1c2533" fill="none" />
      </g>
      {/* Unlit light pipes (the glow layer adds colour on top) */}
      {STRIPS.map((d) => <path key={d} d={d} stroke="#1c232d" strokeWidth="3.2" strokeLinecap="round" fill="none" />)}

      {/* Fine grain so flat fills read as leather and soft-touch plastic */}
      <rect width={CABIN_W} height={CABIN_H} filter="url(#d-grain)" clipPath="url(#d-interiorClip)" style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
});
