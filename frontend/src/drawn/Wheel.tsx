import { useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import type { CarState, Intent } from '../types';
import { carAudio } from '../lib/audio';
import { Part } from './Part';
import { RIM, WHEEL, ellipsePath } from './geometry';

const BOX = { x: WHEEL.cx - 256, y: 226, w: 514, h: 480 };
/** The spokes, switch pads and keys are drawn symmetric about SX, then moved onto the rim's centre. */
const SX = 1561;
const DX = WHEEL.cx - SX;
/** The airbag pad and badge are drawn centred at x 1557. */
const HUB_DX = WHEEL.cx - 1557;
/** The stalks were drawn for a column at x 1572. */
const COLUMN_DX = WHEEL.cx - 1572;
const mirror = (x: number) => 2 * SX - x;

/** Point on the rim's ellipse at `deg` (clockwise from 3 o'clock), `k` = fraction of the outer radius. */
const onRim = (deg: number, k: number) => {
  const a = (deg * Math.PI) / 180;
  return [WHEEL.cx + Math.cos(a) * WHEEL.rx * k, WHEEL.cy + Math.sin(a) * WHEEL.ry * k] as const;
};
/** Seams where the perforated grip panels meet the smooth leather, at roughly 10, 8, 2 and 4 o'clock. */
const SEAMS = [205, 148, 335, 32].map((deg) => {
  const [x0, y0] = onRim(deg, WHEEL.irx / WHEEL.rx);
  const [x1, y1] = onRim(deg, 1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)}`;
});

/** Lower spoke: one symmetric V, its outer edges trimmed in chrome, running down into the rim. */
const V_EDGE = `M1450 516 L1490 628 Q1497 647 1518 649 L${mirror(1518)} 649 Q${mirror(1497)} 647 ${mirror(1490)} 628 L${mirror(1450)} 516`;
const V_BODY = `M1450 516 L1490 628 Q1496 640 1492 690 L${mirror(1492)} 690 Q${mirror(1496)} 640 ${mirror(1490)} 628 L${mirror(1450)} 516 Q${SX} 548 1450 516 Z`;
const HUB = 'M1476 420 Q1557 406 1640 420 Q1662 427 1661 470 Q1657 538 1600 554 Q1557 562 1516 554 Q1458 538 1454 470 Q1453 427 1476 420 Z';
const HUB_FACE = 'M1481 426 Q1557 413 1635 426 Q1654 432 1653 470 Q1649 532 1597 547 Q1557 555 1519 547 Q1466 532 1462 470 Q1461 432 1481 426 Z';

/** A physical switch: dark cap in a recess, a faint top edge and a softly lit glyph. */
function Key({ x, y, w = 22, h = 13, label, onClick, children }: {
  x: number; y: number; w?: number; h?: number; label: string; onClick: () => void; children: ReactNode;
}) {
  return (
    <g className="hit btn key" onClick={(e) => { e.stopPropagation(); onClick(); }} onPointerDown={(e) => e.stopPropagation()} role="button" aria-label={label}>
      <title>{label}</title>
      <rect x={x - w / 2 - 0.8} y={y - h / 2 - 0.8} width={w + 1.6} height={h + 1.6} rx="3.4" fill="#030304" />
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx="2.8" fill="url(#w-key)" stroke="#2a2e35" strokeWidth="0.6" />
      <path d={`M${x - w / 2 + 2.5} ${y - h / 2 + 0.9} L${x + w / 2 - 2.5} ${y - h / 2 + 0.9}`} stroke="#4b515c" strokeWidth="0.6" opacity="0.8" />
      <g className="key-glyph" stroke="#d3e4f4" fill="none" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">{children}</g>
    </g>
  );
}

/**
 * Steering wheel. The geometry rotates (drag the rim to steer, it springs back);
 * the lighting stays fixed on top so highlights don't spin with it.
 */
export function Wheel({ car, onIntent, onMic }: { car: CarState; onIntent: (i: Intent) => void; onMic: () => void }) {
  const [angle, setAngle] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ a0: number; base: number; cx: number; cy: number } | null>(null);

  const pointerAngle = (e: RPointerEvent, cx: number, cy: number) => (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  const onDown = (e: RPointerEvent<SVGPathElement>) => {
    const svg = (e.currentTarget.ownerSVGElement ?? e.currentTarget) as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    // Wheel centre in screen space (rotation keeps it fixed)
    const cx = r.left + ((WHEEL.cx - BOX.x) / BOX.w) * r.width;
    const cy = r.top + ((WHEEL.cy - BOX.y) / BOX.h) * r.height;
    start.current = { a0: pointerAngle(e, cx, cy), base: angle, cx, cy };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onMove = (e: RPointerEvent) => {
    const s = start.current;
    if (!s) return;
    let d = pointerAngle(e, s.cx, s.cy) - s.a0;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    setAngle(Math.max(-450, Math.min(450, s.base + d)));
  };
  const onUp = () => { start.current = null; setDragging(false); setAngle(0); };

  const m = car.media;
  const inner = WHEEL.irx / WHEEL.rx;
  return (
    <>
      <Part x={BOX.x} y={BOX.y} w={BOX.w} h={BOX.h + 20}>
        <path d={RIM} fillRule="evenodd" fill="#000" opacity="0.5" transform="translate(4 8)" filter="url(#d-b8)" />
      </Part>
      <div className={`wheel-rot ${dragging ? 'dragging' : ''}`}
        style={{ left: BOX.x, top: BOX.y, width: BOX.w, height: BOX.h, transformOrigin: `${WHEEL.cx - BOX.x}px ${WHEEL.cy - BOX.y}px`, transform: `rotate(${angle}deg)` }}>
        <svg viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`} width={BOX.w} height={BOX.h} style={{ overflow: 'visible' }}>
          <defs>
            {/* Cross-section of the rim: dark edges, soft crest, so it reads as a padded tube */}
            <radialGradient id="w-tube" gradientUnits="userSpaceOnUse" cx={WHEEL.cx} cy={WHEEL.cy} r={WHEEL.rx}
              gradientTransform={`translate(${WHEEL.cx} ${WHEEL.cy}) scale(1 ${WHEEL.ry / WHEEL.rx}) translate(${-WHEEL.cx} ${-WHEEL.cy})`}>
              <stop offset={inner} stopColor="#040405" />
              <stop offset={inner + 0.03} stopColor="#101114" />
              <stop offset={inner + 0.075} stopColor="#1c1e22" />
              <stop offset={inner + 0.1} stopColor="#202227" />
              <stop offset="0.965" stopColor="#141518" />
              <stop offset="0.99" stopColor="#07080a" />
              <stop offset="1" stopColor="#030304" />
            </radialGradient>
            <linearGradient id="w-leather" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#15171b" />
              <stop offset="1" stopColor="#08090b" />
            </linearGradient>
            <linearGradient id="w-gloss" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1a1c21" />
              <stop offset="0.3" stopColor="#090a0c" />
              <stop offset="1" stopColor="#0c0d10" />
            </linearGradient>
            <linearGradient id="w-key" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1f2228" />
              <stop offset="0.5" stopColor="#131519" />
              <stop offset="1" stopColor="#0d0e11" />
            </linearGradient>
            <radialGradient id="w-hubFace" cx="0.45" cy="0.25" r="0.85">
              <stop offset="0" stopColor="#202227" />
              <stop offset="0.6" stopColor="#131418" />
              <stop offset="1" stopColor="#0a0b0d" />
            </radialGradient>
            <pattern id="w-perf" width="4.2" height="4.2" patternUnits="userSpaceOnUse">
              <circle cx="2.1" cy="2.1" r="0.6" fill="#000" />
            </pattern>
            <clipPath id="w-grips">
              <path d={`M${WHEEL.cx} ${WHEEL.cy} L${WHEEL.cx - 400} ${WHEEL.cy - 200} L${WHEEL.cx - 400} ${WHEEL.cy + 240} Z`} />
              <path d={`M${WHEEL.cx} ${WHEEL.cy} L${WHEEL.cx + 400} ${WHEEL.cy - 200} L${WHEEL.cx + 400} ${WHEEL.cy + 240} Z`} />
            </clipPath>
            {/* The chrome badge is photographed under studio light; dim and cool it to sit in a night cabin */}
            <filter id="w-logoTone" x="-5%" y="-5%" width="110%" height="110%">
              <feColorMatrix type="matrix" values="0.78 0 0 0 0  0 0.8 0 0 0  0 0 0.88 0 0.015  0 0 0 1 0" />
            </filter>
          </defs>

          {/* Spoke bodies in black leather, under the rim: the two side spokes and the lower V */}
          <g transform={`translate(${DX} 0)`}>
            <path d="M1336 432 Q1410 419 1478 428 L1480 532 L1452 520 Q1400 510 1340 500 Z" fill="url(#w-leather)" />
            <path d={`M${mirror(1336)} 446 Q${mirror(1410)} 432 ${mirror(1478)} 430 L${mirror(1480)} 534 L${mirror(1452)} 522 Q${mirror(1400)} 522 ${mirror(1340)} 516 Z`} fill="url(#w-leather)" />
            <path d={V_BODY} fill="url(#w-leather)" />
            <path d={V_BODY} fill="#000" filter="url(#d-leatherGrain)" opacity="0.5" />
            {/* Contact shadow under the pad */}
            <path d="M1470 540 Q1557 572 1648 540" stroke="#000" strokeWidth="8" opacity="0.55" fill="none" filter="url(#d-b3)" />

          </g>

          {/* Rim: padded leather, perforated grips at 9 and 3 o'clock, one row of stitching */}
          <path d={RIM} fillRule="evenodd" fill="url(#w-tube)" />
          <path d={RIM} fillRule="evenodd" fill="url(#w-perf)" clipPath="url(#w-grips)" opacity="0.55" />
          <path d={RIM} fillRule="evenodd" fill="#000" filter="url(#d-leatherGrain)" opacity="0.7" />
          <path d={RIM} fillRule="evenodd" fill="#000" opacity="0.001" className="hit rim"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <title>Drag the rim to steer</title>
          </path>
          <path d={ellipsePath(WHEEL.cx, WHEEL.cy, WHEEL.irx + 4, WHEEL.iry + 4)} stroke="#6a707b" strokeWidth="0.7" strokeDasharray="2 2.2" fill="none" opacity="0.35" />
          <path d={ellipsePath(WHEEL.cx, WHEEL.cy, WHEEL.irx, WHEEL.iry)} stroke="#000" strokeWidth="2.5" fill="none" filter="url(#d-b1)" opacity="0.8" />
          <g stroke="#020203" strokeWidth="1.3">{SEAMS.map((d) => <path key={d} d={d} />)}</g>

          <g transform={`translate(${DX} 0)`}>
            {/* Switch pads: gloss black, chrome on the outer edge and between the rows */}
            <path d="M1378 437 Q1416 428 1454 435 L1455 507 Q1416 508 1386 500 Q1374 490 1374 468 Q1374 448 1378 437 Z" fill="url(#w-gloss)" stroke="#23262c" strokeWidth="0.7" />
            <path d="M1680 450 Q1716 444 1745 452 Q1752 470 1750 492 Q1748 512 1738 520 Q1704 523 1667 522 L1667 452 Z" fill="url(#w-gloss)" stroke="#23262c" strokeWidth="0.7" />
            <path d="M1380 442 Q1365 468 1374 498" stroke="url(#d-chrome)" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M1744 456 Q1759 484 1747 514" stroke="url(#d-chrome)" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M1386 478.5 L1450 479.5" stroke="url(#d-chromeH)" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M1673 500 L1744 499" stroke="url(#d-chromeH)" strokeWidth="1.4" strokeLinecap="round" />

            {/* Lower V spoke trim */}
            <path d={V_EDGE} stroke="#000" strokeWidth="5" opacity="0.5" fill="none" filter="url(#d-b1)" transform="translate(0 2)" />
            <path d={V_EDGE} stroke="url(#d-chromeH)" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
            <path d={V_EDGE} stroke="#ffffff" strokeWidth="0.6" fill="none" opacity="0.45" transform="translate(0 -0.8)" />

          </g>

          {/* Hub: bevelled airbag pad and the Hyundai badge */}
          <g transform={`translate(${HUB_DX} 0)`}>
            <path d={HUB} fill="#000" opacity="0.6" filter="url(#d-b3)" transform="translate(0 4)" />
            <path d={HUB} fill="#0a0b0e" stroke="#1b1e24" strokeWidth="1" />
            <path d={HUB_FACE} fill="url(#w-hubFace)" />
            <path d={HUB_FACE} fill="#000" filter="url(#d-leatherGrain)" opacity="0.5" />
            <path d="M1486 428 Q1557 416 1630 428" stroke="#40454f" strokeWidth="1.2" fill="none" opacity="0.7" filter="url(#d-b1)" />
            <ellipse cx="1557" cy="479" rx="44" ry="20" fill="#000" opacity="0.55" filter="url(#d-b3)" />
            <image href="/images/hyundai-logo.webp" x="1515" y="459" width="84" height="38" preserveAspectRatio="none" filter="url(#w-logoTone)" />
            <text x="1557" y="526" className="airbag">AIRBAG</text>
            <circle cx="1557" cy="482" r="66" fill="transparent" className="hit" onClick={() => carAudio.horn()}>
              <title>Horn</title>
            </circle>
          </g>

          <g transform={`translate(${DX} 0)`}>
            {/* Left spoke: audio */}
            <Key x={1410} y={445} label="Play / pause" onClick={() => onIntent(m.playing ? { type: 'media.pause' } : { type: 'media.play' })}>
              {m.playing ? <path d="M1407.5 441.5 L1407.5 448.5 M1412.5 441.5 L1412.5 448.5" /> : <path d="M1407.5 441.5 L1414 445 L1407.5 448.5 Z" />}
            </Key>
            <Key x={1436} y={446} label="Mute" onClick={() => onIntent({ type: 'media.volume', mute: !m.muted })}>
              <path d="M1430.5 444.5 L1433 444.5 L1435.5 442 L1435.5 450 L1433 447.5 L1430.5 447.5 Z M1438.5 444 L1441.5 448 M1441.5 444 L1438.5 448" />
            </Key>
            <Key x={1398} y={466} w={18} label="Volume down" onClick={() => onIntent({ type: 'media.volume', delta: -2 })}>
              <path d="M1395 466 L1401 466" />
            </Key>
            <Key x={1429} y={467} w={36} label="Volume up" onClick={() => onIntent({ type: 'media.volume', delta: 2 })}>
              <path d="M1426 467 L1432 467 M1429 464 L1429 470" />
            </Key>
            <Key x={1400} y={491} label="Previous track" onClick={() => onIntent({ type: 'media.skip', dir: -1 })}>
              <path d="M1397 487.5 L1397 494.5 M1403.5 487.5 L1398.5 491 L1403.5 494.5 Z" />
            </Key>
            <Key x={1430} y={494} label="Next track" onClick={() => onIntent({ type: 'media.skip', dir: 1 })}>
              <path d="M1433 490.5 L1433 497.5 M1426.5 490.5 L1431.5 494 L1426.5 497.5 Z" />
            </Key>

            {/* Right spoke: voice, phone, climate, cluster pages */}
            <Key x={1692} y={460} label="Voice assistant" onClick={onMic}>
              <path d="M1690.5 455.5 Q1690.5 454 1692 454 Q1693.5 454 1693.5 455.5 L1693.5 459.5 Q1693.5 461 1692 461 Q1690.5 461 1690.5 459.5 Z M1688.5 458.5 Q1688.5 463.5 1692 463.5 Q1695.5 463.5 1695.5 458.5 M1692 463.5 L1692 465.5" />
            </Key>
            <Key x={1724} y={462} label={car.phone ? 'End call' : 'Phone'} onClick={() => onIntent(car.phone ? { type: 'phone.end' } : { type: 'screen', page: 'phone' })}>
              <path d="M1720 458.5 Q1721 465.5 1728.5 466 L1728.5 463.5 L1726 462.5 L1725 463.5 Q1722.5 462.5 1721.5 460 L1722.5 459 L1721.5 456.5 Z" fill={car.phone ? '#ff6b6b' : 'none'} />
            </Key>
            <Key x={1697} y={486} w={20} label="Temperature down" onClick={() => onIntent({ type: 'climate.setTemp', value: car.climate.temp - 0.5 })}>
              <path d="M1694 484.5 L1697 488 L1700 484.5" />
            </Key>
            <Key x={1726} y={487} w={34} label="Temperature up" onClick={() => onIntent({ type: 'climate.setTemp', value: car.climate.temp + 0.5 })}>
              <path d="M1723 489 L1726 485.5 L1729 489" />
            </Key>
            {/* Cluster menu keys: cycle the centre of the instrument cluster */}
            <Key x={1693} y={512} label="Cluster: previous page" onClick={() => onIntent({ type: 'cluster.view', dir: -1 })}>
              <path d="M1694.5 508.5 L1691 512 L1694.5 515.5" />
            </Key>
            <Key x={1725} y={512} label="Cluster: next page (trip, tyres)" onClick={() => onIntent({ type: 'cluster.view', dir: 1 })}>
              <path d="M1723.5 508.5 L1727 512 L1723.5 515.5" />
            </Key>
          </g>
        </svg>
      </div>

      {/* Fixed lighting over the rim: one soft sheen along the top, nothing glossy */}
      <Part x={BOX.x} y={BOX.y} w={BOX.w} h={BOX.h} className="no-hit">
        <path d={RIM} fillRule="evenodd" fill="url(#d-rimLight)" />
        <path d="M1400 330 Q1470 262 1572 250 Q1680 256 1745 318" stroke="#c9ccd4" strokeWidth="2" opacity="0.1" fill="none" filter="url(#d-b1)" transform={`translate(${COLUMN_DX} 0)`} />
      </Part>
    </>
  );
}

/** Column stalks behind the wheel: left = wipers, right = indicators (Indian RHD layout). */
export function Stalks({ car, onIntent }: { car: CarState; onIntent: (i: Intent) => void }) {
  const tilt = car.indicator === 'right' ? -7 : car.indicator === 'left' ? 7 : 0;
  const wiperTilt = car.wipers === 'fast' ? -10 : car.wipers === 'slow' ? -5 : 0;
  return (
    <Part x={1366 + COLUMN_DX} y={392} w={432} h={60} className="stalks">
      <g transform={`translate(${COLUMN_DX} 0)`}>
      <g className="hit stalk" style={{ transform: `rotate(${wiperTilt}deg)`, transformOrigin: '1430px 410px' }}
        onClick={() => onIntent({ type: 'wipers', mode: car.wipers === 'off' ? 'slow' : car.wipers === 'slow' ? 'fast' : 'off' })} role="button" aria-label="Wiper stalk">
        <title>Wipers: click to cycle off / low / high</title>
        <path d="M1382 401 L1432 405 L1432 418 L1380 415 Q1372 408 1382 401 Z" fill="#121418" stroke="#262b33" strokeWidth="0.8" />
        <path d="M1384 403 L1430 406" stroke="#4a515c" strokeWidth="0.7" />
        <rect x="1386" y="404" width="7" height="9" rx="1.5" fill="#1e2228" />
      </g>
      <g className="hit stalk" style={{ transform: `rotate(${tilt}deg)`, transformOrigin: '1742px 430px' }} role="button" aria-label="Indicator stalk">
        <title>Indicators: top half = right, bottom half = left</title>
        <path d="M1784 422 L1742 424 L1742 438 L1786 436 Q1793 429 1784 422 Z" fill="#121418" stroke="#262b33" strokeWidth="0.8" />
        <path d="M1782 424 L1744 426" stroke="#4a515c" strokeWidth="0.7" />
        <rect x="1742" y="414" width="54" height="16" fill="transparent" onClick={() => onIntent({ type: 'indicator', dir: car.indicator === 'right' ? 'off' : 'right' })} />
        <rect x="1742" y="430" width="54" height="16" fill="transparent" onClick={() => onIntent({ type: 'indicator', dir: car.indicator === 'left' ? 'off' : 'left' })} />
      </g>
      </g>
    </Part>
  );
}
