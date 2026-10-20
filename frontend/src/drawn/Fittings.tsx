import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { CarState, Intent } from '../types';
import { engine } from '../lib/engine';
import { Part } from './Part';
import { SIDE_WINDOW } from './geometry';

/**
 * The armrest switch panel. Its parts are drawn top-down about (0, 0), then laid onto the
 * sloping armrest: tilted with it and foreshortened, as the camera sees it from above.
 */
const PANEL = { x: 487, y: 513, tilt: -11.5, squash: 0.55 };
/** Glyphs are lit from inside the cap, so they read less foreshortened than the caps around them. */
const upright = (cx: number, cy: number) => `translate(${cx} ${cy}) scale(1 1.5) translate(${-cx} ${-cy})`;
/** Window travel while a switch is held, in % per second. */
const WINDOW_SPEED = 40;
/** Releasing sooner than this counts as a tap: one-touch, all the way. */
const TAP_MS = 320;

const clampPct = (v: number) => Math.min(100, Math.max(0, v));

/**
 * Passenger door glass and its rocker switch. Top half raises, bottom half
 * lowers. A tap runs the window all the way (one-touch); holding moves it
 * gradually and it stops where you let go.
 */
export function Door({ car, onIntent }: { car: CarState; onIntent: (i: Intent) => void }) {
  const [held, setHeld] = useState<{ dir: 1 | -1; value: number | null } | null>(null);
  const hold = useRef<{ dir: 1 | -1; from: number; start: number; raf: number } | null>(null);
  useEffect(() => () => { if (hold.current) cancelAnimationFrame(hold.current.raf); }, []);

  const travelled = (h: NonNullable<typeof hold.current>, now: number) =>
    clampPct(h.from + (h.dir * WINDOW_SPEED * Math.max(0, now - h.start - TAP_MS)) / 1000);

  const press = (dir: 1 | -1) => (e: PointerEvent<SVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const h = { dir, from: car.windows.passenger, start: performance.now(), raf: 0 };
    hold.current = h;
    setHeld({ dir, value: null });
    const tick = (now: number) => {
      if (now - h.start > TAP_MS) setHeld({ dir, value: travelled(h, now) });
      h.raf = requestAnimationFrame(tick);
    };
    h.raf = requestAnimationFrame(tick);
  };
  const release = () => {
    const h = hold.current;
    if (!h) return;
    cancelAnimationFrame(h.raf);
    hold.current = null;
    const now = performance.now();
    const tap = now - h.start <= TAP_MS;
    const open = tap ? (h.dir > 0 ? 100 : 0) : Math.round(travelled(h, now));
    setHeld(null);
    onIntent({ type: 'window', target: 'passenger', open });
  };

  const live = held?.value != null;
  const passenger = live ? held!.value! : car.windows.passenger;
  const drop = (passenger / 100) * 300;
  const up = held?.dir === -1;
  const down = held?.dir === 1;
  const pct = Math.round(passenger);

  return (
    <>
      <Part x={0} y={0} w={612} h={312} className="no-hit">
        <defs>
          <clipPath id="d-sideClip"><path d={SIDE_WINDOW} /></clipPath>
          <linearGradient id="d-sideTint" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0a1424" stopOpacity="0.5" />
            <stop offset="1" stopColor="#04080f" stopOpacity="0.38" />
          </linearGradient>
        </defs>
        <g clipPath="url(#d-sideClip)">
          <g className={`glass ${live ? 'moving' : ''}`} style={{ transform: `translateY(${drop}px)` }}>
            <path d="M0 0 L440 0 L612 268 L600 320 L0 330 Z" fill="url(#d-sideTint)" />
            <path d="M120 0 L260 0 L80 312 L0 312 L0 190 Z" fill="#ffffff" opacity="0.035" />
            <path d="M0 1.5 L440 1.5" stroke="#9fb3cc" strokeWidth="2" opacity="0.5" />
          </g>
        </g>
      </Part>
      <Part x={410} y={482} w={150} h={62} className="switches">
        <defs>
          <linearGradient id="sw-cap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2b3038" />
            <stop offset="0.55" stopColor="#15181d" />
            <stop offset="1" stopColor="#0b0d10" />
          </linearGradient>
          <linearGradient id="sw-lip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#47505c" />
            <stop offset="1" stopColor="#1a1d22" />
          </linearGradient>
        </defs>
        <g transform={`translate(${PANEL.x} ${PANEL.y}) rotate(${PANEL.tilt}) scale(1 ${PANEL.squash})`}>
          {/* Piano-black tray in a satin frame, sunk into the armrest */}
          <rect x="-61" y="-18" width="122" height="36" rx="8" fill="#030405" />
          <rect x="-58" y="-15" width="116" height="30" rx="6" fill="url(#d-piano)" stroke="#2c333e" strokeWidth="1" />
          <path d="M-52 -14 L52 -14" stroke="#566070" strokeWidth="1" opacity="0.6" />

          {/* Window: a pull-up paddle in its own well (pull to close, push to open) */}
          <rect x="-36" y="-12" width="46" height="24" rx="5" fill="#010203" stroke="#000" strokeWidth="1" />
          <g role="group" aria-label="Passenger window switch">
            <g style={{ transform: up ? 'translateY(2px)' : down ? 'translateY(-1.5px)' : undefined, transition: 'transform 0.12s' }}>
              <rect x="-32" y="-8" width="38" height="16" rx="4" fill="url(#sw-cap)" stroke="#3b424d" strokeWidth="0.8" />
              <rect x="-32" y="3" width="38" height="5" rx="2.5" fill="url(#sw-lip)" opacity={up ? 1 : 0.8} />
              <path d="M-28 -7 L2 -7" stroke="#717a88" strokeWidth="0.8" opacity="0.7" />
              <g className="key-glyph" stroke={up || down ? '#ffffff' : '#8fd0ff'} fill="none" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round"
                transform={upright(-13, 0)}>
                <path d="M-24 2 L-24 -3 L-18.5 -3 L-15.5 2 Z" />
                <path d="M-6 -1 L-6 -4.5 M-8.3 -2.3 L-6 -4.6 L-3.7 -2.3" opacity={down ? 0.35 : 1} />
                <path d="M-6 1 L-6 4.5 M-8.3 2.3 L-6 4.6 L-3.7 2.3" opacity={up ? 0.35 : 1} />
              </g>
            </g>
            {/* Generous hit zones: upper half raises, lower half lowers */}
            <rect x="-38" y="-16" width="50" height="16" fill="transparent" className="hit"
              onPointerDown={press(-1)} onPointerUp={release} onPointerCancel={release}>
              <title>{`Window: tap to close fully, hold to raise (${pct}% open)`}</title>
            </rect>
            <rect x="-38" y="0" width="50" height="16" fill="transparent" className="hit"
              onPointerDown={press(1)} onPointerUp={release} onPointerCancel={release}>
              <title>{`Window: tap to open fully, hold to lower (${pct}% open)`}</title>
            </rect>
          </g>

          {/* Central locking: a rocker, lock on one half and unlock on the other, with its LED */}
          <g className="hit btn" onClick={() => onIntent({ type: 'doors.lock', locked: !car.locked })} role="button" aria-label="Door lock">
            <title>{car.locked ? 'Unlock doors' : 'Lock doors'}</title>
            <rect x="17" y="-11" width="38" height="22" rx="5" fill="#010203" stroke="#000" strokeWidth="1" />
            <rect x="20" y="-8" width="32" height="16" rx="3.5" fill="url(#sw-cap)" stroke="#3b424d" strokeWidth="0.8" />
            <path d="M23 -7 L49 -7" stroke="#717a88" strokeWidth="0.8" opacity="0.7" />
            <path d="M36 -7.5 L36 7.5" stroke="#050608" strokeWidth="1.4" />
            <g className="key-glyph" stroke="#8fd0ff" fill="none" strokeWidth="1" strokeLinejoin="round" transform={upright(36, 0)}>
              <path d="M25 0 h6 v4.5 h-6 Z M26 0 v-2 a2 2 0 0 1 4 0 v2" />
              <path d="M41 0 h6 v4.5 h-6 Z M42 0 v-2 a2 2 0 0 1 4 0 v-0.4" />
            </g>
            <circle cx="28" cy="-4.8" r="1.2" fill={car.locked ? '#ff4a3a' : '#22262d'} className={car.locked ? 'led-on' : ''} style={{ color: '#ff4a3a' }} />
          </g>
        </g>
      </Part>
    </>
  );
}

/** Ventilated passenger seat in the foreground; perforations glow when cooling runs. */
export function Seat({ level }: { level: number }) {
  return (
    <Part x={236} y={696} w={656} h={118} className="no-hit">
      <path d="M240 814 L266 762 Q290 728 330 722 Q470 706 620 704 Q760 706 842 740 Q874 760 888 814 Z" fill="url(#d-seat)" />
      <path d="M240 814 L266 762 Q290 728 330 722 Q470 706 620 704 Q760 706 842 740 Q874 760 888 814 Z" fill="#000" filter="url(#d-leatherGrain)" opacity="0.9" />
      <path d="M380 814 L392 750 Q520 735 650 736 Q762 740 800 770 L812 814 Z" fill="url(#d-perf)" />
      <path d="M380 814 L392 750 Q520 735 650 736 Q762 740 800 770 L812 814" stroke="#2d323b" strokeWidth="1" strokeDasharray="2.5 2.5" fill="none" />
      <path d="M392 754 Q520 739 650 740 Q760 744 796 773" stroke="#05060a" strokeWidth="2" fill="none" />
      <path d="M272 760 Q296 730 334 725 Q470 709 620 707 Q758 709 838 742" stroke="#5a616d" strokeWidth="1.6" opacity="0.45" fill="none" filter="url(#d-b1)" />
      {level > 0 && (
        <g className="seat-cool" style={{ opacity: 0.3 + level * 0.22 }}>
          <path d="M380 814 L392 750 Q520 735 650 736 Q762 740 800 770 L812 814 Z" fill="#4fc8ff" opacity="0.18" filter="url(#d-b8)" />
          <path d="M380 814 L392 750 Q520 735 650 736 Q762 740 800 770 L812 814 Z" fill="url(#d-perfLit)" />
        </g>
      )}
      <defs>
        <pattern id="d-perfLit" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="1" fill="#8fe0ff" />
        </pattern>
      </defs>
    </Part>
  );
}

/** Roof console buttons (cabin light) under the rear-view mirror. */
export function MirrorButtons({ car, onIntent }: { car: CarState; onIntent: (i: Intent) => void }) {
  return (
    <Part x={1050} y={40} w={96} h={22}>
      <circle cx="1066" cy="52" r="1.8" fill="#ff3b30" className="led-on" />
      {[1098, 1126].map((x) => (
        <g key={x} className="hit btn" onClick={() => onIntent({ type: 'lights.cabin', on: !car.cabinLight })} role="button" aria-label="Cabin light">
          <title>Cabin light</title>
          <rect x={x - 9} y={44} width="18" height="12" rx="3" fill="#13161c" stroke="#252b35" strokeWidth="0.7" />
          <circle cx={x} cy={50} r="2.6" fill={car.cabinLight ? '#fff3d6' : 'none'} stroke="#7fb4e8" strokeWidth="0.9" />
        </g>
      ))}
    </Part>
  );
}

const NEXT_IGNITION = { off: 'acc', acc: 'on', on: 'off' } as const;
const RING = { off: '#59606c', acc: '#ffb02e', on: '#8fd0ff' } as const;

/** Driver-side switch row with the ENGINE START/STOP button (OFF → ACC → ON). */
export function DriverSwitches({ car, onIntent }: { car: CarState; onIntent: (i: Intent) => void }) {
  return (
    <Part x={1806} y={560} w={130} h={46}>
      {/* Clear of the rim's outer edge */}
      <g transform="translate(12 0)">
        <g className="hit btn" onClick={() => onIntent({ type: 'lights.head', on: !car.headlights })} role="button" aria-label="Headlights">
          <title>Headlights</title>
          <rect x="1804" y="568" width="28" height="22" rx="4" fill="#0f1319" stroke="#232a34" strokeWidth="0.8" />
          <path d="M1812 579 Q1818 573 1823 579 Q1818 585 1812 579 Z M1825 576 L1829 576 M1825 579 L1829 579 M1825 582 L1829 582" stroke={car.headlights ? '#3dff7a' : '#8fd0ff'} strokeWidth="1" fill="none" />
        </g>
        <g className={`hit btn engine ${car.ignition}`} role="button" aria-label="Engine start stop"
          onClick={() => onIntent({ type: 'ignition', mode: engine.brakeHeld && car.ignition !== 'on' ? 'on' : NEXT_IGNITION[car.ignition] })}>
          <title>{`Ignition: ${car.ignition.toUpperCase()}. Press for ${NEXT_IGNITION[car.ignition].toUpperCase()} (hold the brake to start the engine directly)`}</title>
          <circle cx="1856" cy="580" r="14.5" fill="#0c0f14" stroke="#4a515c" strokeWidth="1.2" />
          <circle cx="1856" cy="580" r="11.5" fill="none" stroke={RING[car.ignition]} strokeWidth="0.9" opacity="0.85" className="engine-ring" />
          <text x="1856" y="578" className="eng-txt">ENGINE</text>
          <text x="1856" y="584.5" className="eng-txt">START STOP</text>
        </g>
        <g className="hit btn" onClick={() => onIntent({ type: 'lights.cabin', on: !car.cabinLight })} role="button" aria-label="Cabin light">
          <title>Cabin light</title>
          <rect x="1880" y="570" width="28" height="22" rx="4" fill="#0f1319" stroke="#232a34" strokeWidth="0.8" />
          <circle cx="1894" cy="581" r="4" stroke={car.cabinLight ? '#fff3d6' : '#8fd0ff'} strokeWidth="1" fill="none" />
          <path d="M1894 575 L1894 573 M1888 581 L1886 581 M1900 581 L1902 581" stroke="#8fd0ff" strokeWidth="1" />
        </g>
      </g>
    </Part>
  );
}
