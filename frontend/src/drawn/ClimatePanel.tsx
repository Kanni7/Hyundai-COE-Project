import type { ReactNode } from 'react';
import type { CarState, Intent } from '../types';
import { FAN_MAX } from '../state/car';
import { Part } from './Part';

const SEGS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc',
  '7': 'abc', '8': 'abcdefg', '9': 'abfgcd', O: 'abcdef', F: 'aefg', '-': 'g', ' ': '',
};

/** Seven-segment readout, the way the real climate LCD draws digits. */
export function SevenSeg({ text, x, y, w, h, t = 1.8, gap = 2.2, color = 'currentColor' }: {
  text: string; x: number; y: number; w: number; h: number; t?: number; gap?: number; color?: string;
}) {
  const out: ReactNode[] = [];
  let cx = x;
  for (const [i, ch] of [...text].entries()) {
    if (ch === '.') {
      out.push(<circle key={i} cx={cx - gap / 2} cy={y + h - t / 2} r={t * 0.55} />);
      continue;
    }
    const on = SEGS[ch] ?? '';
    const hh = h / 2;
    const seg: Record<string, [number, number, number, number]> = {
      a: [cx + t / 2 + 0.4, y, w - t - 0.8, t],
      g: [cx + t / 2 + 0.4, y + hh - t / 2, w - t - 0.8, t],
      d: [cx + t / 2 + 0.4, y + h - t, w - t - 0.8, t],
      f: [cx, y + t / 2 + 0.4, t, hh - t / 2 - 0.8],
      b: [cx + w - t, y + t / 2 + 0.4, t, hh - t / 2 - 0.8],
      e: [cx, y + hh + 0.4, t, hh - t / 2 - 0.8],
      c: [cx + w - t, y + hh + 0.4, t, hh - t / 2 - 0.8],
    };
    out.push(
      <g key={i}>
        {[...on].map((s) => {
          const [sx, sy, sw, sh] = seg[s];
          return <rect key={s} x={sx} y={sy} width={sw} height={sh} rx={t / 2} />;
        })}
      </g>,
    );
    cx += w + gap;
  }
  return <g fill={color} transform={`skewX(-6) translate(${y * 0.105} 0)`}>{out}</g>;
}

/** A key cap centred on (x, y); its glyph is drawn about (0, 0). */
function Btn({ x, y, label, lit, led, onClick, children }: {
  x: number; y: number; label: string; lit?: boolean; led?: string; onClick: () => void; children: ReactNode;
}) {
  return (
    <g className="hit btn" onClick={onClick} role="button" aria-label={label} transform={`translate(${x} ${y})`}>
      <title>{label}</title>
      <rect x="-12" y="-8.5" width="24" height="17" rx="3" fill="#030405" />
      <rect x="-11" y="-7.5" width="22" height="15" rx="2.6" fill="#0e1014" stroke="#222831" strokeWidth="0.6" />
      <path d="M-8.5 -6.6 L8.5 -6.6" stroke="#353c47" strokeWidth="0.6" />
      {led && <circle cy="-4.4" r="1.2" fill={lit ? led : '#22262d'} className={lit ? 'led-on' : ''} style={{ color: led }} />}
      <g className="glyph" stroke="#a9cbe6" fill="none" strokeWidth="1" strokeLinecap="round" opacity={lit === false ? 0.6 : 0.9}>{children}</g>
    </g>
  );
}

const AMBER = '#ffb347';
/** The panel is symmetric about the hazard switch above it. */
const MID = 1146;
/** Key columns either side, mirrored about MID, and the two key rows. */
const COLS = [1015, 1040, 2 * MID - 1040, 2 * MID - 1015];
const ROWS = [525, 545];

/** Piano-black climate panel under the vents: keys either side, LCD temperature and blower level in the middle. */
export function ClimatePanel({ car, onIntent }: { car: CarState; onIntent: (i: Intent) => void }) {
  const c = car.climate;
  const live = car.ignition !== 'off' && c.on;
  const [whole, dec] = c.temp.toFixed(1).split('.');
  const step = (d: number) => onIntent({ type: 'climate.setTemp', value: c.temp + d });
  const bars = 8 * 5 - 2.2;

  return (
    <Part x={980} y={498} w={332} h={74} className="climate-panel">
      <rect x={MID - 155} y="505" width="310" height="60" rx="8" fill="url(#d-piano)" stroke="#171c24" strokeWidth="1" />
      <path d={`M${MID - 148} 506.4 L${MID + 148} 506.4`} stroke="#333c49" strokeWidth="0.7" opacity="0.8" />
      {/* LCD glass and the satin bar under it */}
      <rect x={MID - 91} y="518" width="182" height="26" rx="4" fill="#020407" />
      <rect x={MID - 89} y="550.3" width="178" height="1.4" rx="0.7" fill="url(#d-chromeH)" opacity="0.85" />

      {/* LCD: cabin temperature (single zone) */}
      <g color="#a8dcff" opacity={live ? 1 : 0.1}>
        <g filter="url(#d-b1)" opacity="0.6">
          <SevenSeg text={live ? whole : 'OFF'} x={1066} y={524} w={8} h={13} />
        </g>
        <SevenSeg text={live ? whole : 'OFF'} x={1066} y={524} w={8} h={13} />
        {live && <SevenSeg text={`.${dec}`} x={1090} y={530} w={5} h={7} t={1.3} gap={6} />}
      </g>
      <g className="hit" onWheel={(e) => step(e.deltaY < 0 ? 0.5 : -0.5)}>
        <title>Temperature: click top half to raise, bottom half to lower, or scroll</title>
        <rect x="1060" y="518" width="44" height="13" fill="transparent" onClick={() => step(0.5)} />
        <rect x="1060" y="531" width="44" height="13" fill="transparent" onClick={() => step(-0.5)} />
      </g>

      {/* Centre: blower bars, kept quiet, on the digits' baseline */}
      <g opacity={live ? 0.85 : 0.1}>
        {Array.from({ length: FAN_MAX }, (_, k) => (
          <rect key={k} x={MID - bars / 2 + k * 5} y={537 - 3 - k * 1.1} width="2.8" height={3 + k * 1.1} rx="0.6"
            fill={k < c.fan ? '#a8dcff' : '#1f2b3a'} />
        ))}
      </g>

      {/* Right LCD: blower level, mirroring the temperature's inset */}
      <g color="#a8dcff" opacity={live ? 1 : 0.1}>
        <g stroke="#a8dcff" fill="none" strokeWidth="1">
          <circle cx="1208" cy="530.5" r="4.3" />
          <path d="M1208 526.2 Q1211 528.5 1208 530.5 Q1205 532.5 1208 534.8 M1203.7 530.5 Q1206 527.5 1208 530.5 Q1210 533.5 1212.3 530.5" />
        </g>
        <SevenSeg text={String(live ? c.fan : 0)} x={1218} y={524} w={8} h={13} />
      </g>
      <g className="hit" onWheel={(e) => onIntent({ type: 'climate.fan', delta: e.deltaY < 0 ? 1 : -1 })}>
        <title>Fan speed: click top half to increase, bottom half to decrease</title>
        <rect x="1200" y="518" width="32" height="13" fill="transparent" onClick={() => onIntent({ type: 'climate.fan', delta: 1 })} />
        <rect x="1200" y="531" width="32" height="13" fill="transparent" onClick={() => onIntent({ type: 'climate.fan', delta: -1 })} />
      </g>

      {/* Keys: comfort on the left, air on the right, on the same two rows */}
      <Btn x={COLS[0]} y={ROWS[0]} label="Auto climate" lit={c.auto && live} led={AMBER} onClick={() => onIntent({ type: 'climate.auto' })}>
        <text y="4" className="btn-txt">AUTO</text>
      </Btn>
      <Btn x={COLS[1]} y={ROWS[0]} label="A/C" lit={live} led={AMBER} onClick={() => onIntent({ type: 'climate.power', on: !c.on })}>
        <text y="4" className="btn-txt">A/C</text>
      </Btn>
      <Btn x={COLS[0]} y={ROWS[1]} label="Front defrost" lit={c.defrost} led={AMBER} onClick={() => onIntent({ type: 'climate.defrost' })}>
        <path d="M-5 4.5 Q0 -1.5 5 4.5 M-2.5 1.5 L-2.5 -0.5 M0 0.5 L0 -1.5 M2.5 1.5 L2.5 -0.5" />
      </Btn>
      <Btn x={COLS[1]} y={ROWS[1]} label="Recirculation" lit={c.recirc} led={AMBER} onClick={() => onIntent({ type: 'climate.recirc' })}>
        <path d="M-6 5 L6 5 L4.5 2 L-4.5 2 Z M-3 0 Q0 -2.5 3 0 L1.5 0" />
      </Btn>
      <Btn x={COLS[2]} y={ROWS[0]} label="Fan slower" onClick={() => onIntent({ type: 'climate.fan', delta: -1 })}>
        <circle cx="-2" r="2.4" /><path d="M2.5 0 L6 0" />
      </Btn>
      <Btn x={COLS[3]} y={ROWS[0]} label="Fan faster" onClick={() => onIntent({ type: 'climate.fan', delta: 1 })}>
        <circle cx="-2" r="3" /><path d="M2.5 0 L6.5 0 M4.5 -2 L4.5 2" />
      </Btn>
      <Btn x={COLS[2]} y={ROWS[1]} label="Rear defrost" lit={c.defrost} led={AMBER} onClick={() => onIntent({ type: 'climate.defrost' })}>
        <rect x="-5" y="1" width="10" height="5" rx="1" /><path d="M-2.5 -0.5 L-2.5 -2 M0 -0.5 L0 -2 M2.5 -0.5 L2.5 -2" />
      </Btn>
      <Btn x={COLS[3]} y={ROWS[1]} label="Climate off" onClick={() => onIntent({ type: 'climate.power', on: !c.on })}>
        <path d="M-2.8 -2.4 A3.8 3.8 0 1 0 2.8 -2.4 M0 -4 L0 0.5" />
      </Btn>
    </Part>
  );
}
