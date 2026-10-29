import * as opentype from "opentype.js";
import { describe, expect, it } from "vitest";
import {
  buildFont,
  fontFingerprint,
  getFontFamily,
  getFontMetrics,
  loadFont,
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

  it("honors zero word spacing from the persisted settings range", () => {
    const project = baseProject({});
    project.settings.wordSpacing = 0;
    expect(buildFont(project).charToGlyph(" ").advanceWidth).toBe(0);
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
});
