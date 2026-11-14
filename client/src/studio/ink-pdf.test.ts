import { describe, expect, it } from "vitest";
import { simplifyStroke, writeInkPdf } from "./ink-pdf";

const decoder = new TextDecoder("latin1");

function samplePdf() {
  return writeInkPdf(
    [
      {
        width: 595.28,
        height: 841.89,
        background: {
          jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
          pixelWidth: 2,
          pixelHeight: 3,
        },
        strokes: [
          {
            color: "#354c43",
            width: 1.4,
            points: [
              { x: 50, y: 700 },
              { x: 60, y: 720 },
              { x: 70, y: 700 },
            ],
          },
          { color: "#000000", width: 1, points: [{ x: 90, y: 700 }] },
        ],
      },
    ],
    "Test",
    new Date(Date.UTC(2026, 10, 14, 8, 30, 0))
  );
}

describe("ink pdf writer", () => {
  it("writes every stroke as an ink annotation with an appearance", () => {
    const text = decoder.decode(samplePdf());
    expect(text.startsWith("%PDF-1.7")).toBe(true);
    expect(text.match(/\/Subtype \/Ink/g)).toHaveLength(2);
    expect(text).toContain("/InkList [[50 700 60 720 70 700]]");
    expect(text).toContain("/AP << /N");
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).toContain("/Annots [");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("points every cross-reference entry at the start of its object", () => {
    const bytes = samplePdf();
    const text = decoder.decode(bytes);
    const startxref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
    const rows = text
      .slice(startxref)
      .split("\n")
      .filter(line => /^\d{10} 00000 n $/.test(line));
    expect(rows.length).toBeGreaterThan(5);
    rows.forEach((row, index) => {
      const offset = Number(row.slice(0, 10));
      expect(text.slice(offset, offset + 12)).toMatch(
        new RegExp(`^${index + 1} 0 obj`)
      );
    });
    const size = Number(/\/Size (\d+)/.exec(text)?.[1]);
    expect(size).toBe(rows.length + 1);
  });

  it("thins dense points but keeps both ends of a stroke", () => {
    const dense = Array.from({ length: 50 }, (_, i) => ({ x: i * 0.01, y: 0 }));
    const thin = simplifyStroke(dense, 0.25);
    expect(thin[0]).toEqual(dense[0]);
    expect(thin[thin.length - 1]).toEqual(dense[dense.length - 1]);
    expect(thin.length).toBeLessThan(10);
  });
});
