import type { Point, Stroke } from "./types";

/** Inserts points so no gap between neighbours is longer than `maxGap`. */
function densify(points: Point[], maxGap: number): Point[] {
  if (points.length < 2) return points;
  const result: Point[] = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.ceil(distance / maxGap);
    for (let step = 1; step < steps; step += 1) {
      const ratio = step / steps;
      result.push({
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
        pressure:
          from.pressure !== undefined && to.pressure !== undefined
            ? from.pressure + (to.pressure - from.pressure) * ratio
            : (to.pressure ?? from.pressure),
      });
    }
    result.push(to);
  }
  return result;
}

/**
 * Erases only the ink under a round eraser, like a real eraser: strokes are cut
 * where the eraser passes and the parts on either side stay. Returns the same
 * array instance when nothing was touched.
 */
export function eraseStrokes(
  strokes: Stroke[],
  center: Point,
  radius: number
): Stroke[] {
  let changed = false;
  const next: Stroke[] = [];
  for (const stroke of strokes) {
    const reach = radius + stroke.width / 2;
    const touches = (point: Point) =>
      Math.hypot(point.x - center.x, point.y - center.y) <= reach;
    if (!stroke.points.some(touches)) {
      // A long segment can cross the eraser without a point inside it.
      const dense = densify(stroke.points, Math.max(1, radius / 2));
      if (!dense.some(touches)) {
        next.push(stroke);
        continue;
      }
    }
    changed = true;
    if (stroke.points.length === 1) continue;
    let run: Point[] = [];
    const flush = () => {
      if (run.length > 1) next.push({ width: stroke.width, points: run });
      run = [];
    };
    for (const point of densify(stroke.points, Math.max(1, radius / 2))) {
      if (touches(point)) flush();
      else run.push(point);
    }
    flush();
  }
  return changed ? next : strokes;
}

/** Line width at one point: a pen pressed harder draws a little wider, like real ink. */
export function pressureWidth(base: number, pressure?: number): number {
  if (pressure === undefined || !Number.isFinite(pressure)) return base;
  const clamped = Math.min(1, Math.max(0, pressure));
  return base * (0.6 + clamped * 0.6);
}
