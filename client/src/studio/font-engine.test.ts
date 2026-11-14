import * as opentype from "opentype.js";
import { describe, expect, it } from "vitest";
import {
  buildFont,
  fontFingerprint,
  getFontFamily,
  getFontMetrics,
  loadFont,
  variantFontCount,
  variantForOccurrence,
} from "./font-engine";
import type { FontProject } from "./types";

const baseProject = (glyphs: FontProject["glyphs"]): FontProject => ({
  id: "font-test-id",
  name: "Testschrift",
  glyphs,
  settings: {
    spacing: 25,
    wordSpacing: 280,
    width: 100,
    slant: 0,
    baseline: 300,
    smoothness: 0,
    variation: 0,
    size: 100,
  },
  createdAt: 1,
  updatedAt: 1,
});

describe("font-engine", () => {
  it("serializes a real OTF with Unicode-mapped, closed filled glyph outlines", () => {
    const font = buildFont(
      baseProject({
        A: {
          variants: [
            [
              {
                width: 12,
                points: [
                  { x: 90, y: 300 },
                  { x: 200, y: 70 },
                  { x: 320, y: 300 },
                ],
              },
            ],
          ],
        },
        ä: {
          variants: [
            [
              {
                width: 10,
                points: [
                  { x: 100, y: 260 },
                  { x: 220, y: 130 },
                  { x: 330, y: 260 },
                ],
              },
            ],
          ],
        },
      })
    );
    const arrayBuffer = font.toArrayBuffer();
    const parsed = opentype.parse(arrayBuffer);
    const glyph = parsed.charToGlyph("ä");

    expect(arrayBuffer.byteLength).toBeGreaterThan(500);
    expect(parsed.hasChar("A")).toBe(true);
    expect(glyph.unicode).toBe("ä".codePointAt(0));
    expect(glyph.path.commands.some(command => command.type === "Z")).toBe(
      true
    );
    expect(glyph.path.commands.some(command => command.type === "C")).toBe(
      true
    );
  });

  it("uses the selected baseline with inverted y coordinates and creates usable advances", () => {
    const project = baseProject({
      I: {
        variants: [
          [
            {
              width: 10,
              points: [
                { x: 120, y: 300 },
                { x: 280, y: 300 },
              ],
            },
          ],
        ],
      },
    });
    const font = buildFont(project);
    const glyph = font.charToGlyph("I");
    const bounds = glyph.path.getBoundingBox();
    const metrics = getFontMetrics(project.settings);

    expect(bounds.y1).toBeLessThan(0);
    expect(bounds.y2).toBeGreaterThan(0);
    expect(glyph.advanceWidth).toBeGreaterThan(0);
    expect(font.ascender).toBe(metrics.ascender);
    expect(font.descender).toBe(metrics.descender);
    expect(font.charToGlyph(" ").advanceWidth).toBe(280);
  });

  it("ignores stored font settings; spacing is set per text block in documents", () => {
    const plain = baseProject({});
    const tweaked = baseProject({});
    tweaked.settings = {
      ...tweaked.settings,
      wordSpacing: 0,
      spacing: 200,
      slant: 30,
    };
    expect(buildFont(tweaked).charToGlyph(" ").advanceWidth).toBe(
      buildFont(plain).charToGlyph(" ").advanceWidth
    );
  });

  it("crops each glyph to its ink, wherever it was drawn on the canvas", () => {
    const bar = (x: number) => [
      {
        width: 8,
        points: [
          { x, y: 300 },
          { x, y: 60 },
        ],
      },
    ];
    const left = buildFont(
      baseProject({ l: { variants: [bar(60)] } })
    ).charToGlyph("l");
    const right = buildFont(
      baseProject({ l: { variants: [bar(320)] } })
    ).charToGlyph("l");
    expect(left.advanceWidth).toBe(right.advanceWidth);
    // A thin bar is narrow: far less than the old 0.625 em minimum.
    expect(left.advanceWidth).toBeLessThan(200);
    const box = left.getBoundingBox();
    expect(Math.round(box.x1)).toBe(40);
  });

  it("handles empty projects and empty glyph variants without pretending they are drawable glyphs", () => {
    const font = buildFont(baseProject({ A: { variants: [[]] } }));
    const parsed = opentype.parse(font.toArrayBuffer());

    expect(parsed.hasChar("A")).toBe(false);
    expect(parsed.hasChar(" ")).toBe(true);
    expect(parsed.charToGlyph("A").name).toBe(".notdef");
    expect(() => buildFont(baseProject({})).toArrayBuffer()).not.toThrow();
  });

  it("keeps built-in and custom CSS family names deterministic", () => {
    expect(getFontFamily("caveat")).toBe("Caveat");
    expect(getFontFamily("manrope")).toBe("Manrope");
    expect(getFontFamily("font-test-id")).toBe(getFontFamily("font-test-id"));
    expect(getFontFamily("font-test-id", 1)).not.toBe(
      getFontFamily("font-test-id")
    );
  });

  it("returns a usable family without DOM font APIs in the Node test environment", async () => {
    await expect(loadFont(baseProject({}))).resolves.toBe(
      getFontFamily("font-test-id")
    );
  });

  it("changes the FontFace cache key when a secondary handwritten variant changes", () => {
    const project = baseProject({
      A: {
        variants: [
          [
            {
              width: 8,
              points: [
                { x: 80, y: 300 },
                { x: 240, y: 90 },
              ],
            },
          ],
          [
            {
              width: 8,
              points: [
                { x: 100, y: 300 },
                { x: 250, y: 80 },
              ],
            },
          ],
        ],
      },
    });
    const before = fontFingerprint(project);
    project.glyphs.A.variants[1][0].points[1].x = 270;
    expect(fontFingerprint(project)).not.toBe(before);
  });

  it("cycles repeated letters through every drawn variant and skips empty ones", () => {
    const ink = [
      {
        width: 4,
        points: [
          { x: 10, y: 10 },
          { x: 20, y: 20 },
        ],
      },
    ];
    const project = baseProject({
      A: { variants: [ink, ink, ink] },
      B: { variants: [ink, [], ink] },
      C: { variants: [ink] },
    });
    const pick = (character: string) =>
      [0, 1, 2, 3].map(n => variantForOccurrence(project, character, n));
    expect(pick("A")).toEqual([0, 1, 2, 0]);
    expect(pick("B")).toEqual([0, 2, 0, 2]);
    expect(pick("C")).toEqual([0, 0, 0, 0]);
    expect(pick("Z")).toEqual([0, 0, 0, 0]);
    expect(variantForOccurrence(project, "A", 0, 2)).toBe(2);
    expect(variantFontCount(project)).toBe(3);
    expect(variantFontCount(baseProject({ C: { variants: [ink] } }))).toBe(1);
  });
});
