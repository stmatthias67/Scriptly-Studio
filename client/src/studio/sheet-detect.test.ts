import { describe, expect, it } from "vitest";
import { regularLines } from "./sheet-detect";

function ruled(length: number, first: number, spacing: number) {
  const profile = Array.from({ length }, () => 2);
  for (let y = first; y < length; y += spacing) profile[Math.round(y)] = 40;
  return profile;
}

describe("sheet line detection", () => {
  it("finds the first line and spacing of a ruled sheet", () => {
    const result = regularLines(ruled(500, 30, 21.5));
    expect(result?.first).toBeCloseTo(30, 0);
    expect(result?.spacing).toBeCloseTo(21.5, 0);
  });

  it("refuses an irregular or blank sheet", () => {
    expect(regularLines(Array.from({ length: 300 }, () => 3))).toBeUndefined();
    const noisy = Array.from({ length: 300 }, () => 2);
    [10, 15, 80, 90, 200, 260].forEach(y => (noisy[y] = 40));
    expect(regularLines(noisy)).toBeUndefined();
  });
});
