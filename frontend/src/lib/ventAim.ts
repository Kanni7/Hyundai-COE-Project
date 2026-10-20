/** Where a centre vent is aimed: x from -1 (left) to 1 (right), y from -1 (up) to 1 (down). */
export interface VentAim { x: number; y: number }

/**
 * The two centre vents, passenger side first. The vent tabs write here as they are
 * dragged; the airflow reads it every frame, so aiming never re-renders React.
 */
export const ventAims: VentAim[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];

export function aimVent(i: number, aim: VentAim) {
  ventAims[i] = aim;
}
