import { useRef } from 'react';
import type { CarState, Gear, Intent } from '../types';
import { Part } from './Part';

const GEARS: Gear[] = ['P', 'R', 'N', 'D'];
const TRAVEL: Record<Gear, number> = { P: 0, R: 9, N: 18, D: 28 };
/** The lit P-R-N-D column beside the boot, following the console's slope. */
const GEAR_LEDS: [number, number][] = [[1147, 729], [1141.5, 737.5], [1136, 746], [1130.5, 754.5]];

// The boot widens from the collar to the console floor, and stops short of the light pipe on its right.
const bootPath = (dy: number) =>
  `M1055 ${676 + dy} L1095 ${676 + dy} Q1122 ${696 + dy * 0.6} 1114 744 Q1098 776 1078 802 L992 802 Q1014 ${716 + dy * 0.4} 1055 ${676 + dy} Z`;

/** How far the console's edges lean: they move this many px left per px down. */
const SLOPE = 0.48;
/** Centre line of the key strip at height y (midway between its chrome edges). */
const stripX = (y: number) => 1020.5 - SLOPE * (y - 671);
/** Key rows down the strip, 15 px keys with 3 px gaps; the phone tray fills the gap between the pairs. */
const STRIP_ROWS = [681.5, 699.5, 756.5, 774.5];

/** A key on the sloping strip: the cap is a parallelogram, so it sits in the console's perspective. */
function stripKey(cx: number, cy: number, w: number, h: number) {
  const s = SLOPE * (h / 2);
  return `M${cx - w / 2 + s + 2} ${cy - h / 2} L${cx + w / 2 + s - 2} ${cy - h / 2} Q${cx + w / 2 + s} ${cy - h / 2} ${cx + w / 2 + s - 1} ${cy - h / 2 + 2}
    L${cx + w / 2 - s + 1} ${cy + h / 2 - 2} Q${cx + w / 2 - s} ${cy + h / 2} ${cx + w / 2 - s - 2} ${cy + h / 2}
    L${cx - w / 2 - s + 2} ${cy + h / 2} Q${cx - w / 2 - s} ${cy + h / 2} ${cx - w / 2 - s + 1} ${cy + h / 2 - 2}
    L${cx - w / 2 + s - 1} ${cy - h / 2 + 2} Q${cx - w / 2 + s} ${cy - h / 2} ${cx - w / 2 + s + 2} ${cy - h / 2} Z`;
}

/** A key cap in its recess: dark gap, satin-black cap with a faint top edge. */
function Cap({ d }: { d: string }) {
  return (
    <>
      <path d={d} fill="#000" opacity="0.75" transform="translate(0 1.2)" />
      <path d={d} fill="url(#d-keycap)" stroke="#272e38" strokeWidth="0.7" />
    </>
  );
}

/** A lit glyph on a key; white while the function is on. */
function Glyph({ x, y, on, children }: { x: number; y: number; on: boolean; children: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`} className="key-glyph" stroke={on ? '#ffffff' : '#9cc6e6'} fill="none" strokeWidth="1"
      strokeLinecap="round" strokeLinejoin="round">{children}</g>
  );
}

const SEAT = <><path d="M-3.5 -4.5 Q-4.2 -0.5 -2 2.5 L4 2.5" /><path d="M0.5 -0.8 q1 -1.4 0 -2.8 M3 -0.8 q1 -1.4 0 -2.8" /></>;
/** The comfort row below the climate panel: five keys in one tray, as in the real car. */
const ROW = { x0: 1126, y: 619, w: 24, h: 32, gap: 2 };
const rowX = (i: number) => ROW.x0 + ROW.w / 2 + i * (ROW.w + ROW.gap);
const rowCap = (i: number) => {
  const x = rowX(i) - ROW.w / 2;
  const y = ROW.y - ROW.h / 2;
  return `M${x + 3} ${y} H${x + ROW.w - 3} Q${x + ROW.w} ${y} ${x + ROW.w} ${y + 3} V${y + ROW.h - 3} Q${x + ROW.w} ${y + ROW.h} ${x + ROW.w - 3} ${y + ROW.h} H${x + 3} Q${x} ${y + ROW.h} ${x} ${y + ROW.h - 3} V${y + 3} Q${x} ${y} ${x + 3} ${y} Z`;
};

/** Gear selector with the lit P-R-N-D column, the key strip, the comfort row and the seat-ventilation keys. */
export function Console({ car, onIntent }: { car: CarState; onIntent: (i: Intent) => void }) {
  const dy = TRAVEL[car.gear];
  const drag = useRef<{ y: number; moved: boolean } | null>(null);

  const shift = (g: Gear) => { if (g !== car.gear) onIntent({ type: 'gear', gear: g }); };
  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const steps = Math.round((e.clientY - d.y) / 22);
    if (steps !== 0) {
      d.moved = true;
      d.y = e.clientY;
      const idx = Math.min(3, Math.max(0, GEARS.indexOf(car.gear) + steps));
      shift(GEARS[idx]);
    }
  };
  const onUp = () => {
    if (drag.current && !drag.current.moved) shift(car.gear === 'P' ? 'D' : 'P');
    drag.current = null;
  };

  // Two keys, the phone tray, two keys: as in the real strip
  const strip: { label: string; on: boolean; act: () => void; row: number; glyph: React.ReactNode }[] = [
    { label: `Drive mode: ${car.driveMode}`, on: car.driveMode !== 'normal', row: 0,
      act: () => onIntent({ type: 'drive.mode', mode: car.driveMode === 'normal' ? 'sport' : car.driveMode === 'sport' ? 'eco' : 'normal' }),
      glyph: <path d="M-4.5 2 A5 5 0 0 1 4.5 2 M0 2 L2.2 -1.8" /> },
    { label: 'Auto Hold', on: car.autoHold, row: 1, act: () => onIntent({ type: 'autohold' }), glyph: <><circle r="3.6" /><text y="1.8" className="btn-txt">A</text></> },
    { label: 'Parking sensors', on: car.gear === 'R', row: 2, act: () => onIntent({ type: 'gear', gear: car.gear === 'R' ? 'P' : 'R' }),
      glyph: <path d="M-4 3.5 L-4 -3.5 L-0.5 -3.5 Q2 -3.5 2 -1.2 Q2 1 -0.5 1 L-4 1 M4 -2.5 Q5.8 0 4 2.5" /> },
    { label: 'Door lock', on: car.locked, row: 3, act: () => onIntent({ type: 'doors.lock', locked: !car.locked }),
      glyph: <path d="M-3 0 h6 v4.5 h-6 Z M-1.8 0 v-1.8 a1.8 1.8 0 0 1 3.6 0 V0" /> },
  ];
  const vent = (target: 'driver' | 'passenger') => () =>
    onIntent({ type: 'seat.vent', target, level: (car.seats[target] + 1) % 4 });
  const mode = (m: 'eco' | 'sport') => () => onIntent({ type: 'drive.mode', mode: car.driveMode === m ? 'normal' : m });
  const row: { label: string; on: boolean; act: () => void; glyph: React.ReactNode }[] = [
    { label: car.sunroof ? 'Close sunroof' : 'Open sunroof', on: car.sunroof, act: () => onIntent({ type: 'sunroof', open: !car.sunroof }),
      glyph: <><rect x="-4.5" y="-5.5" width="9" height="11" rx="2" /><rect x="-2.6" y="-3.6" width="5.2" height="4" rx="0.8" /></> },
    { label: `Ambient light ${car.ambient.on ? 'off' : 'on'}`, on: car.ambient.on, act: () => onIntent({ type: 'ambient.power', on: !car.ambient.on }),
      glyph: <path d="M-5 -3.5 Q0 -6.5 5 -3.5 M-5 0 Q0 -3 5 0 M-5 3.5 Q0 0.5 5 3.5" /> },
    { label: `Lane Keeping Assist ${car.adas.lka ? 'off' : 'on'}`, on: car.adas.lka, act: () => onIntent({ type: 'adas.lka', on: !car.adas.lka }),
      glyph: <><path d="M-5.5 5 L-3.5 -5 M5.5 5 L3.5 -5" /><rect x="-1.7" y="-1.5" width="3.4" height="4.5" rx="1" /></> },
    { label: 'ECO mode', on: car.driveMode === 'eco', act: mode('eco'), glyph: <text y="1.8" className="btn-txt">ECO</text> },
    { label: 'SPORT mode', on: car.driveMode === 'sport', act: mode('sport'), glyph: <text y="1.8" className="btn-txt">SPORT</text> },
  ];

  return (
    <Part x={880} y={570} w={380} h={244} className="console">
      {/* Comfort row: one tray, five keys, each with a status bar that lights when on */}
      <rect x={ROW.x0 - 4} y={ROW.y - ROW.h / 2 - 4} width={5 * ROW.w + 4 * ROW.gap + 8} height={ROW.h + 8} rx="5" fill="#040507" stroke="#141a22" strokeWidth="0.8" />
      {row.map((b, i) => (
        <g key={b.label} className={`hit btn ${b.on ? 'lit' : ''}`} onClick={b.act} role="button" aria-label={b.label}>
          <title>{b.label}</title>
          <Cap d={rowCap(i)} />
          <Glyph x={rowX(i)} y={ROW.y - 2} on={b.on}>{b.glyph}</Glyph>
          <rect x={rowX(i) - 4} y={ROW.y + 10} width="8" height="1.4" rx="0.7" fill={b.on ? '#ffb347' : '#1c2129'} className={b.on ? 'led-on' : ''} style={{ color: '#ffb347' }} />
        </g>
      ))}

      {/* Key strip, chrome-edged, following the console slope, with the phone tray between the pairs */}
      <path d="M996 668 L1048 667 Q1052 667 1050 671 L989 796 Q987 800 982 800 L934 802 Q929 802 931 797 L991 671 Q992 668 996 668 Z" fill="#07090d" stroke="url(#d-chromeH)" strokeWidth="1.3" />
      <path d={`M${stripX(710) - 24} 710 L${stripX(710) + 24} 710 L${stripX(746) + 24} 746 L${stripX(746) - 24} 746 Z`} fill="#030406" stroke="#141a22" strokeWidth="0.8" />
      {strip.map((b) => {
        const y = STRIP_ROWS[b.row];
        const x = stripX(y);
        return (
          <g key={b.label} className={`hit btn ${b.on ? 'lit' : ''}`} onClick={b.act} role="button" aria-label={b.label}>
            <title>{b.label}</title>
            <Cap d={stripKey(x, y, 44, 15)} />
            <Glyph x={x} y={y - 0.5} on={b.on}>{b.glyph}</Glyph>
            <path d={`M${x - 6.5} ${y + 5.2} L${x + 1.5} ${y + 5.2}`} stroke={b.on ? '#ffb347' : '#1c2129'} strokeWidth="1.2" strokeLinecap="round" className={b.on ? 'led-on' : ''} style={{ color: '#ffb347' }} />
          </g>
        );
      })}

      {/* Gloss panel right of the boot: P-R-N-D column and the seat-ventilation keys */}
      <path d="M1140 700 L1180 698 L1168 800 L1090 802 Z" fill="#05070a" stroke="#121820" strokeWidth="0.8" />
      {GEARS.map((g, i) => (
        <g key={g} className={`hit gear-led ${car.gear === g ? 'on' : ''}`} onClick={() => shift(g)} role="button" aria-label={`Gear ${g}`}>
          <title>{`Shift to ${g}`}</title>
          <rect x={GEAR_LEDS[i][0] - 7} y={GEAR_LEDS[i][1] - 5} width="14" height="9" fill="transparent" />
          <text x={GEAR_LEDS[i][0]} y={GEAR_LEDS[i][1] + 2.6}>{g}</text>
        </g>
      ))}
      {([['driver', 1121.5, 775], ['passenger', 1113, 792]] as const).map(([who, x, y]) => (
        <g key={who} className={`hit btn ${car.seats[who] ? 'lit' : ''}`} onClick={vent(who)} role="button" aria-label={`${who === 'driver' ? 'Driver' : 'Passenger'} seat ventilation`}>
          <title>{`${who === 'driver' ? 'Driver' : 'Passenger'} seat ventilation: ${car.seats[who] ? `level ${car.seats[who]}` : 'off'}`}</title>
          <Cap d={stripKey(x, y, 30, 14)} />
          <Glyph x={x - 4} y={y} on={car.seats[who] > 0}>{SEAT}</Glyph>
          {/* One dot per ventilation level */}
          {[0, 1, 2].map((k) => <circle key={k} cx={x + 4 + k * 3} cy={y + 3.5} r="0.9" fill={k < car.seats[who] ? '#6fd0ff' : '#1f2630'} />)}
        </g>
      ))}

      {/* Boot: follows the knob along its travel, with twin stitching */}
      <path className="boot" style={{ d: `path('${bootPath(dy)}')` } as React.CSSProperties} fill="url(#d-boot)" />
      <g stroke="#060708" strokeWidth="1.4" fill="none" className="boot" style={{ transform: `translateY(${dy * 0.5}px)` }} opacity="0.8">
        <path d="M1044 716 Q1076 708 1108 712" /><path d="M1024 752 Q1066 744 1106 750" />
      </g>
      <path d={`M1066 ${676 + dy} Q1052 744 1034 800 M1074 ${676 + dy} Q1061 744 1044 800`} stroke="#8b929c" strokeWidth="0.8" strokeDasharray="2 2.2" fill="none" className="boot" opacity="0.8" />

      {/* Selector: sculpted head, satin stem, chrome collar */}
      <g className="hit knob" style={{ transform: `translateY(${dy}px)` }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} role="slider" aria-label="Gear selector" aria-valuetext={car.gear}>
        <title>Gear selector: drag up/down or click (P ↔ D)</title>
        <path d="M1056 630 L1094 630 L1092 665 L1057 665 Z" fill="url(#d-stem)" />
        <path d="M1059 632 L1059 663" stroke="#8a929e" strokeWidth="0.8" opacity="0.5" />
        <rect x="1055" y="664" width="39" height="11" rx="2" fill="url(#d-chromeH)" />
        <path d="M1056 666 L1093 666" stroke="#ffffff" strokeWidth="0.6" opacity="0.7" />
        <path d="M1062 584 Q1088 575 1112 584 Q1124 590 1120 601 L1114 617 Q1108 628 1094 631 L1057 631 Q1049 627 1049 613 L1049 600 Q1050 588 1062 584 Z" fill="url(#d-leather)" />
        {/* Gloss top face and its rim light */}
        <path d="M1063 585 Q1088 577 1111 585 Q1104 596 1086 597.5 Q1068 597 1063 585 Z" fill="#1a1d23" />
        <path d="M1063 585 Q1088 577 1111 585" stroke="#9aa3b0" strokeWidth="0.9" fill="none" opacity="0.7" />
        <path d="M1051 600 Q1052 622 1060 630" stroke="url(#d-chrome)" strokeWidth="1.6" fill="none" opacity="0.7" />
        {/* Shift-lock button on the driver side of the head */}
        <path d="M1113 594 Q1121 594 1120 602 L1116 612 Q1113 616 1111 612 Z" fill="#20252c" stroke="#59616d" strokeWidth="0.6" />
        <text x="1087" y="592" className="knob-txt">{car.gear}</text>
      </g>
    </Part>
  );
}
