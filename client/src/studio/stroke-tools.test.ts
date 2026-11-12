import { describe, expect, it } from "vitest";
import { eraseStrokes, pressureWidth } from "./stroke-tools";

const line = {
  width: 8,
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
};

describe("stroke tools", () => {
  it("cuts a stroke where the eraser passes and keeps both sides", () => {
    const result = eraseStrokes([line], { x: 50, y: 0 }, 6);
    expect(result).toHaveLength(2);
    expect(Math.max(...result[0].points.map(p => p.x))).toBeLessThan(45);
    expect(Math.min(...result[1].points.map(p => p.x))).toBeGreaterThan(55);
  });

  it("leaves strokes untouched when the eraser misses", () => {
    const strokes = [line];
    expect(eraseStrokes(strokes, { x: 50, y: 40 }, 6)).toBe(strokes);
  });

  it("scales width with pen pressure and ignores missing pressure", () => {
    expect(pressureWidth(10)).toBe(10);
    expect(pressureWidth(10, 0)).toBeCloseTo(6);
    expect(pressureWidth(10, 1)).toBeCloseTo(12);
  });
});
