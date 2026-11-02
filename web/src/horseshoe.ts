// Seat positions around a U-shaped (horseshoe) table that opens upwards.
// Seat 1 is at the top of the left arm; seats run down the left arm, around
// the bottom curve and up the right arm. Seat ceil(n/2) is at the bottom centre.

export interface SeatPosition {
  seatNumber: number;
  x: number;
  y: number;
  /** Unit vector pointing from the seat towards the table (inwards). */
  inward: { dx: number; dy: number };
}

export interface HorseshoeGeometry {
  /** x of the left arm; the right arm is mirrored. */
  armX: number;
  /** y where the arms start (the tips). */
  topY: number;
  /** Centre and radius of the bottom semicircle. */
  cx: number;
  cy: number;
  r: number;
}

export function horseshoeGeometry(width: number, height: number, margin = 120): HorseshoeGeometry {
  const r = (width - 2 * margin) / 2;
  const topY = margin / 2;
  const cy = Math.max(topY, height - margin / 2 - r);
  return { armX: margin, topY, cx: width / 2, cy, r };
}

export function horseshoeLayout(seatCount: number, width: number, height: number): SeatPosition[] {
  if (seatCount <= 0) return [];
  const { armX, topY, cx, cy, r } = horseshoeGeometry(width, height);
  const arm = cy - topY;
  const curve = Math.PI * r;
  const total = 2 * arm + curve;

  const pointAt = (s: number): Omit<SeatPosition, 'seatNumber'> => {
    if (s <= arm) return { x: armX, y: topY + s, inward: { dx: 1, dy: 0 } };
    if (s <= arm + curve) {
      const theta = (s - arm) / r;
      const dx = -Math.cos(theta), dy = Math.sin(theta);
      return { x: cx + r * dx, y: cy + r * dy, inward: { dx: -dx, dy: -dy } };
    }
    return { x: width - armX, y: cy - (s - arm - curve), inward: { dx: -1, dy: 0 } };
  };

  if (seatCount === 1) return [{ seatNumber: 1, ...pointAt(total / 2) }];
  const step = total / (seatCount - 1);
  return Array.from({ length: seatCount }, (_, i) => ({ seatNumber: i + 1, ...pointAt(i * step) }));
}
