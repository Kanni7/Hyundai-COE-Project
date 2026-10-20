// Cabin geometry traced from the night photo (1933 × 814 px). Shared by the
// static body, the ambient light layer and the interactive parts.

export const CABIN_W = 1933;
export const CABIN_H = 814;

export const WINDSHIELD = 'M606 0 L1884 0 L1884 276 L1500 266 L1000 260 L755 251 Z';
export const SIDE_WINDOW = 'M0 0 L440 0 L612 268 L600 298 L0 312 Z';
/** Everything that is not glass. */
export const INTERIOR = `M0 0 H${CABIN_W} V${CABIN_H} H0 Z ${WINDSHIELD} ${SIDE_WINDOW}`;

/** LED light-pipe runs, in the order they appear in the photo. */
export const STRIPS = [
  'M622 347 Q 790 361 962 373', // dash, upper
  'M625 428 C 760 445, 880 466, 948 498', // dash, lower sweep
  'M0 450 Q 290 388 572 347', // door, upper
  'M75 750 C 200 702, 300 662, 338 640 C 370 620, 386 600, 418 588 C 470 566, 530 538, 572 517', // door, lower
  'M1862 415 L1933 420', // driver side, upper
  'M1808 540 L1926 546', // driver side, lower
  'M1132 706 C 1121 738, 1101 772, 1082 802', // centre console
];

// About 25% of the drawing wide, centred on the instrument cluster (82% of the drawing's width).
// Slightly taller than the photo (which foreshortens it) so the rim reads as round.
export const WHEEL = { cx: 1592, cy: 465, rx: 245, ry: 232, irx: 207, iry: 198 };

/**
 * The driver footwell (pedals, dead pedal, their light) is drawn with the brake centred at
 * x 1607.5. This puts the brake right under the steering column, wherever the wheel is placed;
 * the accelerator and dead pedal keep their spacing from it.
 */
export const FOOTWELL_DX = WHEEL.cx - 1607.5;

export const ellipsePath = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;

export const RIM = `${ellipsePath(WHEEL.cx, WHEEL.cy, WHEEL.rx, WHEEL.ry)} ${ellipsePath(WHEEL.cx, WHEEL.cy, WHEEL.irx, WHEEL.iry)}`;

/** Point on a circle, angle in degrees (SVG convention: clockwise from +x). */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} ${a1 > a0 ? 1 : 0} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
