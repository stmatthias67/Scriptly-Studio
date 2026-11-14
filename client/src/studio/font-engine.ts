import * as opentype from "opentype.js";
import type { FontProject, FontSettings, Glyph, Point, Stroke } from "./types";
import { pressureWidth } from "./stroke-tools";

const UNITS_PER_EM = 1000;
const CAP_HEIGHT = 400;
const ROUND_KAPPA = 0.5522847498;
const installedFaces = new Map<
  string,
  { fingerprint: string; face: FontFace }
>();
const pendingLoads = new Map<string, Promise<void>>();

export interface FontMetrics {
  unitsPerEm: number;
  ascender: number;
  descender: number;
}

function number(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizedSettings(settings: FontSettings): FontSettings {
  return {
    spacing: number(settings.spacing, 25),
    wordSpacing: Math.max(0, number(settings.wordSpacing, 280)),
    width: Math.max(30, number(settings.width, 100)),
    slant: Math.max(-45, Math.min(45, number(settings.slant, 0))),
    baseline: Math.max(0, Math.min(CAP_HEIGHT, number(settings.baseline, 300))),
    smoothness: Math.max(0, Math.min(100, number(settings.smoothness, 0))),
    variation: Math.max(0, Math.min(100, number(settings.variation, 0))),
    size: Math.max(30, number(settings.size, 100)),
  };
}

function sourceScale(settings: FontSettings) {
  return (UNITS_PER_EM / CAP_HEIGHT) * (settings.size / 100);
}

/** Metrics deliberately include the full 400 × 400 drawing field around the selected baseline. */
export function getFontMetrics(settings: FontSettings): FontMetrics {
  const safe = normalizedSettings(settings);
  const scale = sourceScale(safe);
  return {
    unitsPerEm: UNITS_PER_EM,
    ascender: Math.ceil(Math.max(700, safe.baseline * scale + 120)),
    descender: Math.floor(
      Math.min(-200, (safe.baseline - CAP_HEIGHT) * scale - 120)
    ),
  };
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function familyToken(fontId: string) {
  const readable = fontId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `${readable || "schrift"}-${stableHash(fontId || "schrift")}`;
}

/** Returns the CSS family used by built-ins and deterministically generated Scriptly fonts. */
export function getFontFamily(fontId: string, variantIndex = 0): string {
  const id = fontId.trim().toLowerCase();
  if (id === "caveat") return "Caveat";
  if (id === "manrope") return "Manrope";
  const base = `Scriptly-${familyToken(fontId)}`;
  return variantIndex > 0 ? `${base}-v${variantIndex + 1}` : base;
}

function selectedStrokes(
  glyph: Glyph | undefined,
  variantIndex: number
): Stroke[] {
  if (!glyph?.variants?.length) return [];
  return glyph.variants[variantIndex] ?? glyph.variants[0] ?? [];
}

function validPoint(point: Point): point is Point {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

interface OutlinePoint {
  x: number;
  y: number;
}

function transformPoint(point: Point, settings: FontSettings): OutlinePoint {
  const scale = sourceScale(settings);
  const y = (settings.baseline - point.y) * scale;
  const width = settings.width / 100;
  const italicOffset = Math.tan((settings.slant * Math.PI) / 180) * -y;
  return { x: point.x * scale * width + italicOffset, y };
}

/** A very small moving average makes the exported contour reflect the smoothing control. */
function smoothPoints(points: Point[], strength: number) {
  if (strength < 1 || points.length < 3) return points;
  const blend = Math.min(0.75, strength / 130);
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return point;
    const previous = points[index - 1];
    const next = points[index + 1];
    return {
      ...point,
      x: point.x * (1 - blend) + ((previous.x + next.x) / 2) * blend,
      y: point.y * (1 - blend) + ((previous.y + next.y) / 2) * blend,
    };
  });
}

function appendCircle(
  path: opentype.Path,
  center: OutlinePoint,
  radius: number
) {
  // Clockwise, like every capsule. With mixed directions the non-zero fill rule cancels
  // overlaps and the pen line turns hollow wherever a join meets a segment.
  const control = radius * ROUND_KAPPA;
  path.moveTo(center.x + radius, center.y);
  path.curveTo(
    center.x + radius,
    center.y - control,
    center.x + control,
    center.y - radius,
    center.x,
    center.y - radius
  );
  path.curveTo(
    center.x - control,
    center.y - radius,
    center.x - radius,
    center.y - control,
    center.x - radius,
    center.y
  );
  path.curveTo(
    center.x - radius,
    center.y + control,
    center.x - control,
    center.y + radius,
    center.x,
    center.y + radius
  );
  path.curveTo(
    center.x + control,
    center.y + radius,
    center.x + radius,
    center.y + control,
    center.x + radius,
    center.y
  );
  path.close();
}

/** Adds one closed, filled rounded capsule. Overlapping capsules form a rounded pen stroke. */
function appendCapsule(
  path: opentype.Path,
  start: OutlinePoint,
  end: OutlinePoint,
  radius: number
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) {
    appendCircle(path, start, radius);
    return;
  }
  const vx = dx / length;
  const vy = dy / length;
  const nx = -vy * radius;
  const ny = vx * radius;
  const cap = radius * ROUND_KAPPA;

  path.moveTo(start.x + nx, start.y + ny);
  path.lineTo(end.x + nx, end.y + ny);
  path.curveTo(
    end.x + nx + vx * cap,
    end.y + ny + vy * cap,
    end.x - nx + vx * cap,
    end.y - ny + vy * cap,
    end.x - nx,
    end.y - ny
  );
  path.lineTo(start.x - nx, start.y - ny);
  path.curveTo(
    start.x - nx - vx * cap,
    start.y - ny - vy * cap,
    start.x + nx - vx * cap,
    start.y + ny - vy * cap,
    start.x + nx,
    start.y + ny
  );
  path.close();
}

function pathForStrokes(strokes: Stroke[], settings: FontSettings) {
  const path = new opentype.Path();
  const scale = sourceScale(settings);
  for (const stroke of strokes) {
    const sourcePoints = (stroke.points ?? []).filter(validPoint);
    if (!sourcePoints.length) continue;
    const smoothed = smoothPoints(sourcePoints, settings.smoothness);
    const points = smoothed.map(point => transformPoint(point, settings));
    const base = Math.max(0.5, number(stroke.width, 3));
    // Pen pressure widens or narrows the line point by point, like real ink.
    const radii = smoothed.map(
      point => pressureWidth(base, point.pressure) * scale * 0.5
    );
    if (points.length === 1) {
      appendCircle(path, points[0], radii[0]);
      continue;
    }
    for (let index = 1; index < points.length; index += 1)
      appendCapsule(
        path,
        points[index - 1],
        points[index],
        (radii[index - 1] + radii[index]) / 2
      );
    // Round joins make sharp directional changes look like a continuous pen line.
    points.forEach((point, index) => appendCircle(path, point, radii[index]));
  }
  return path;
}

function glyphName(character: string) {
  const codePoint = character.codePointAt(0);
  return codePoint === undefined
    ? "glyph"
    : `uni${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function emptyNotdef() {
  const path = new opentype.Path();
  path.moveTo(70, -120);
  path.lineTo(530, -120);
  path.lineTo(530, 780);
  path.lineTo(70, 780);
  path.close();
  return new opentype.Glyph({ name: ".notdef", advanceWidth: 600, path });
}

function advanceFor(path: opentype.Path, settings: FontSettings) {
  const bounds = path.getBoundingBox();
  const minimum = 250 * sourceScale(settings) * (settings.width / 100);
  const rightSideBearing = 70;
  const leftSideBearing = 30;
  const content = Number.isFinite(bounds.x2)
    ? bounds.x2 - Math.min(bounds.x1, 0)
    : 0;
  return Math.max(
    180,
    Math.round(
      Math.max(minimum, content + leftSideBearing + rightSideBearing) +
        settings.spacing
    )
  );
}

function stableProjectPayload(project: FontProject, variantIndex: number) {
  const glyphs = Object.keys(project.glyphs ?? {})
    .sort()
    .map(character => [character, project.glyphs[character]?.variants ?? []]);
  return JSON.stringify({
    name: project.name,
    settings: normalizedSettings(project.settings),
    glyphs,
    variantIndex,
  });
}

/** A content key used to avoid rebuilding a browser FontFace after unrelated React renders. */
export function fontFingerprint(project: FontProject, variantIndex = 0) {
  return stableHash(stableProjectPayload(project, variantIndex));
}

/**
 * Turns Scriptly's 400 × 400 top-left-origin pen data into a real, serializable OpenType font.
 * Each pen segment is represented by a closed filled rounded polygon; no open centerlines are emitted.
 */
export function buildFont(
  project: FontProject,
  variantIndex = 0
): opentype.Font {
  const settings = normalizedSettings(project.settings);
  const metrics = getFontMetrics(settings);
  const glyphs: opentype.Glyph[] = [emptyNotdef()];
  const characters = Object.keys(project.glyphs ?? {})
    .filter(
      character =>
        character !== " " &&
        character.length > 0 &&
        character.codePointAt(0) !== undefined
    )
    .sort(
      (left, right) => (left.codePointAt(0) ?? 0) - (right.codePointAt(0) ?? 0)
    );

  for (const character of characters) {
    const strokes = selectedStrokes(project.glyphs[character], variantIndex);
    if (!strokes.some(stroke => stroke.points?.some(validPoint))) continue;
    const path = pathForStrokes(strokes, settings);
    if (!path.commands.length) continue;
    glyphs.push(
      new opentype.Glyph({
        name: glyphName(character),
        unicode: character.codePointAt(0),
        advanceWidth: advanceFor(path, settings),
        path,
      })
    );
  }

  // A deliberate space glyph prevents a missing-glyph box in German text even in an otherwise empty project.
  glyphs.push(
    new opentype.Glyph({
      name: "space",
      unicode: 32,
      advanceWidth: Math.round(settings.wordSpacing),
      path: new opentype.Path(),
    })
  );

  const familyName = project.name.trim().slice(0, 80) || "Scriptly Handschrift";
  return new opentype.Font({
    familyName,
    styleName: "Regular",
    fullName: `${familyName} Regular`,
    postScriptName: `Scriptly-${stableHash(project.id || familyName)}`,
    version: "Version 1.000",
    description: "Mit Scriptly Studio erstellte Handschrift.",
    unitsPerEm: metrics.unitsPerEm,
    ascender: metrics.ascender,
    descender: metrics.descender,
    glyphs,
  });
}

function canInstallFonts(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.fonts !== "undefined" &&
    typeof globalThis.FontFace !== "undefined"
  );
}

/**
 * Installs an OTF created from this exact project content. It is a no-op in Node/SSR and returns
 * the deterministic family in all environments, so rendering code can use it without platform guards.
 */
export async function loadFont(
  project: FontProject,
  variantIndex = 0
): Promise<string> {
  const family = getFontFamily(project.id, variantIndex);
  if (!canInstallFonts()) return family;

  const fingerprint = fontFingerprint(project, variantIndex);
  const current = installedFaces.get(family);
  if (current?.fingerprint === fingerprint) return family;

  const requestKey = `${family}:${fingerprint}`;
  const alreadyLoading = pendingLoads.get(requestKey);
  if (alreadyLoading) {
    await alreadyLoading;
    return family;
  }

  const job = (async () => {
    try {
      const arrayBuffer = buildFont(project, variantIndex).toArrayBuffer();
      const face = new FontFace(family, arrayBuffer);
      const loaded = await face.load();
      const previous = installedFaces.get(family);
      if (previous?.face) document.fonts.delete(previous.face);
      document.fonts.add(loaded);
      installedFaces.set(family, { fingerprint, face: loaded });
    } catch (error) {
      // The editor remains usable with its fallback stack when FontFace is unavailable or rejected.
      console.warn("Scriptly-Schrift konnte nicht geladen werden.", error);
    } finally {
      pendingLoads.delete(requestKey);
    }
  })();

  pendingLoads.set(requestKey, job);
  await job;
  return family;
}

/** Preloads the primary font variant for a saved gallery without failing on an individual project. */
export async function loadFonts(projects: FontProject[]): Promise<void> {
  await Promise.all(
    projects.map(async project => {
      await loadFont(project);
    })
  );
}

/** Highest number of drawn variants a character can have. */
export const MAX_FONT_VARIANTS = 3;

/** Indices of the variants of a character that actually contain ink. */
export function inkedVariants(glyph: Glyph | undefined): number[] {
  return (glyph?.variants ?? [])
    .slice(0, MAX_FONT_VARIANTS)
    .map((strokes, index) =>
      strokes.some(stroke => stroke.points.length > 0) ? index : -1
    )
    .filter(index => index >= 0);
}

/** Number of variant fonts worth installing for a project (at least one). */
export function variantFontCount(project: FontProject): number {
  let count = 1;
  for (const glyph of Object.values(project.glyphs ?? {})) {
    const inked = inkedVariants(glyph);
    if (inked.length) count = Math.max(count, inked[inked.length - 1] + 1);
  }
  return Math.min(MAX_FONT_VARIANTS, count);
}

/**
 * Picks the variant for the n-th occurrence of a character. Repeated letters cycle
 * through every drawn variant, so the same letter never looks identical twice in a row.
 * The choice is deterministic, which keeps preview, editor and export identical.
 */
export function variantForOccurrence(
  project: FontProject | undefined,
  character: string,
  occurrence: number,
  offset = 0
): number {
  const inked = inkedVariants(project?.glyphs?.[character]);
  if (!inked.length) return 0;
  const start = Math.max(0, inked.indexOf(offset));
  return inked[(start + occurrence) % inked.length];
}

/** Installs every drawn variant of each project so documents can alternate between them. */
export async function loadFontVariants(projects: FontProject[]): Promise<void> {
  await Promise.all(
    projects.flatMap(project =>
      Array.from({ length: variantFontCount(project) }, (_, index) =>
        loadFont(project, index)
      )
    )
  );
}

/** One pen stroke of a glyph in em units: x to the right, y up from the baseline. */
export interface GlyphInkStroke {
  points: Array<{ x: number; y: number }>;
  /** Pen width in em, averaged over the stroke's pressure. */
  width: number;
}

/**
 * The drawn strokes of one character as centre lines, with exactly the same
 * scale, baseline, slant, width and smoothing the generated font uses. Used for
 * exports that keep handwriting as real, erasable strokes instead of pixels.
 */
export function glyphInkStrokes(
  project: FontProject,
  character: string,
  variantIndex = 0
): GlyphInkStroke[] {
  const settings = normalizedSettings(project.settings);
  const scale = sourceScale(settings);
  const strokes = selectedStrokes(project.glyphs?.[character], variantIndex);
  const result: GlyphInkStroke[] = [];
  for (const stroke of strokes) {
    const source = (stroke.points ?? []).filter(validPoint);
    if (!source.length) continue;
    const smoothed = smoothPoints(source, settings.smoothness);
    const base = Math.max(0.5, number(stroke.width, 3));
    const widths = smoothed.map(point => pressureWidth(base, point.pressure));
    const average =
      widths.reduce((sum, width) => sum + width, 0) / widths.length;
    result.push({
      points: smoothed.map(point => {
        const outline = transformPoint(point, settings);
        return { x: outline.x / UNITS_PER_EM, y: outline.y / UNITS_PER_EM };
      }),
      width: (average * scale) / UNITS_PER_EM,
    });
  }
  return result;
}
