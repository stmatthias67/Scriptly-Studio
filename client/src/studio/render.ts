import type {
  FontProject,
  PageElement,
  PaperSettings,
  StudioPage,
} from "./types";
import { paperDimensions } from "./types";
import { getFontFamily, loadFonts } from "./font-engine";

/** Rasterdichte, auf der alle Dokumentkoordinaten gespeichert werden. */
export const PX_PER_MM = 96 / 25.4;
export const MAX_RENDER_PIXELS = 16_000_000;

export interface PagePixels {
  width: number;
  height: number;
}
export interface TextLine {
  text: string;
  paragraphEnd: boolean;
}
export interface TextLayout {
  lines: TextLine[];
  lineHeight: number;
  height: number;
  overflow: boolean;
}

export function mmToPx(value: number): number {
  return value * PX_PER_MM;
}

export function pagePixelDimensions(
  paper: PaperSettings,
  scale = 1
): PagePixels {
  const dimensions = paperDimensions(paper);
  return {
    width: Math.max(1, Math.round(mmToPx(dimensions.width) * scale)),
    height: Math.max(1, Math.round(mmToPx(dimensions.height) * scale)),
  };
}

export function pageAspectRatio(paper: PaperSettings): number {
  const { width, height } = paperDimensions(paper);
  return width / height;
}

function fontStyle(
  element: Pick<PageElement, "fontSize"> &
    Partial<Pick<PageElement, "italic" | "bold">>,
  family: string
): string {
  const escapedFamily = family.replace(/"/g, '\\"');
  return `${element.italic ? "italic " : ""}${element.bold ? "700 " : "400 "}${Math.max(1, element.fontSize)}px "${escapedFamily}", Caveat, cursive`;
}

function wordsForLine(text: string): string[] {
  const result: string[] = [];
  let current = "";
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      current += " ";
      continue;
    }
    if (current && !current.endsWith(" ")) current += " ";
    current += part;
    result.push(current);
  }
  return result;
}

/**
 * Pure, deliberately conservative text layout used for overflow feedback.
 * The renderer uses the same paragraph rules with canvas text measurements.
 */
export function estimateTextLayout(
  text: string,
  width: number,
  fontSize: number,
  lineHeight = 1.5,
  paragraphSpacing = 0,
  height = Number.POSITIVE_INFINITY
): TextLayout {
  const usableWidth = Math.max(12, width);
  const averageGlyph = Math.max(1, fontSize * 0.54);
  const maxChars = Math.max(1, Math.floor(usableWidth / averageGlyph));
  const lines: TextLine[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    if (!paragraph) {
      lines.push({ text: "", paragraphEnd: true });
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars && line) {
        lines.push({ text: line, paragraphEnd: false });
        line = word;
      } else if (candidate.length > maxChars) {
        for (let index = 0; index < word.length; index += maxChars) {
          const fragment = word.slice(index, index + maxChars);
          if (index + maxChars < word.length)
            lines.push({ text: fragment, paragraphEnd: false });
          else line = fragment;
        }
      } else {
        line = candidate;
      }
    }
    lines.push({ text: line, paragraphEnd: true });
  }
  const linePx = Math.max(1, fontSize * Math.max(0.7, lineHeight));
  const calculatedHeight = lines.reduce(
    (sum, line) => sum + linePx + (line.paragraphEnd ? paragraphSpacing : 0),
    0
  );
  return {
    lines,
    lineHeight: linePx,
    height: calculatedHeight,
    overflow: calculatedHeight > height + 0.5,
  };
}

/** Splits only at the renderer's plain-text paragraph/word boundaries for the continuation command. */
export function splitTextForHeight(
  element: Pick<
    PageElement,
    "text" | "width" | "height" | "fontSize" | "lineHeight" | "paragraphSpacing"
  > &
    Partial<Pick<PageElement, "fontId" | "bold" | "italic" | "letterSpacing">>
): { visible: string; overflow: string } {
  const layout = estimateTextLayout(
    element.text,
    element.width,
    element.fontSize,
    element.lineHeight,
    element.paragraphSpacing
  );
  if (typeof document !== "undefined") {
    const context = document.createElement("canvas").getContext("2d");
    if (context) {
      context.font = fontStyle(
        element,
        getFontFamily(element.fontId || "caveat")
      );
      context.letterSpacing = `${element.letterSpacing || 0}px`;
      layout.lines = textLines(
        context,
        element.text,
        element.width,
        element.paragraphSpacing
      );
    }
  }
  let usedHeight = 0;
  let maxLines = 0;
  for (const line of layout.lines) {
    if (usedHeight + layout.lineHeight > element.height + 0.5) break;
    maxLines += 1;
    usedHeight +=
      layout.lineHeight + (line.paragraphEnd ? element.paragraphSpacing : 0);
  }
  if (layout.lines.length <= maxLines)
    return { visible: element.text, overflow: "" };
  const before = layout.lines.slice(0, maxLines);
  const after = layout.lines.slice(maxLines);
  const join = (lines: TextLine[]) =>
    lines.reduce((out, line, index) => {
      const separator =
        index === 0 ? "" : lines[index - 1].paragraphEnd ? "\n" : " ";
      return `${out}${separator}${line.text}`;
    }, "");
  return { visible: join(before).trimEnd(), overflow: join(after).trimStart() };
}

export function missingGlyphs(
  text: string,
  fontId: string,
  fonts: FontProject[] = []
): string[] {
  if (!fontId || fontId === "caveat" || fontId === "manrope") return [];
  const project = fonts.find(font => font.id === fontId);
  if (!project)
    return Array.from(
      new Set(Array.from(text).filter(character => !/\s/.test(character)))
    );
  return Array.from(
    new Set(
      Array.from(text).filter(
        character =>
          !/\s/.test(character) &&
          !project.glyphs[character]?.variants?.some(
            variant => variant.length > 0
          )
      )
    )
  );
}

function safeColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{3,8}$/i.test(value) || /^rgba?\(/i.test(value)
    ? value
    : fallback;
}

function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-f]{3,8}$/i.test(hex)) return `rgba(49, 92, 76, ${alpha})`;
  const normalized =
    hex.length === 4
      ? `#${hex
          .slice(1)
          .split("")
          .map(part => part + part)
          .join("")}`
      : hex.slice(0, 7);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function drawRule(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  paper: PaperSettings,
  multiplier = 1
): void {
  ctx.save();
  ctx.strokeStyle = safeColor(paper.lineColor, "#b9c4b9");
  ctx.lineWidth = Math.max(0.25, mmToPx(paper.lineWidth) * multiplier);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawPaperTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  paper: PaperSettings
): void {
  if (!paper.texture) return;
  ctx.save();
  ctx.fillStyle = "rgba(87, 71, 43, .035)";
  // deterministic, deliberately sparse grain so it does not make exports noisy.
  for (let y = 13; y < height; y += 19) {
    for (let x = 7 + (Math.floor(y / 19) % 3) * 5; x < width; x += 23) {
      const seed = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      if (seed % 5 === 0) ctx.fillRect(x, y, 0.8, 0.8);
    }
  }
  ctx.restore();
}

function drawPaperTemplate(
  ctx: CanvasRenderingContext2D,
  paper: PaperSettings,
  width: number,
  height: number,
  pageNumber: number
): void {
  const margin = mmToPx(Math.max(0, paper.margin));
  const spacing = mmToPx(Math.max(2, paper.spacing));
  const innerLeft = Math.min(margin, width / 3);
  const innerRight = Math.max(innerLeft + 4, width - margin);
  const innerTop = Math.min(margin, height / 3);
  const innerBottom = Math.max(innerTop + 4, height - margin);
  ctx.fillStyle = safeColor(paper.color, "#fffdf8");
  ctx.fillRect(0, 0, width, height);
  drawPaperTexture(ctx, width, height, paper);

  const titleFont = "500 12px Manrope, sans-serif";
  const label = (
    text: string,
    x: number,
    y: number,
    align: CanvasTextAlign = "left"
  ) => {
    ctx.save();
    ctx.font = titleFont;
    ctx.fillStyle = withAlpha(paper.lineColor, 0.72);
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.restore();
  };
  const lined = (startY = innerTop, endY = innerBottom) => {
    for (let y = startY; y <= endY; y += spacing)
      drawRule(ctx, innerLeft, y, innerRight, y, paper);
  };

  switch (paper.type) {
    case "lined":
      lined();
      break;
    case "grid":
      for (let y = innerTop; y <= innerBottom; y += spacing)
        drawRule(ctx, innerLeft, y, innerRight, y, paper);
      for (let x = innerLeft; x <= innerRight; x += spacing)
        drawRule(ctx, x, innerTop, x, innerBottom, paper);
      break;
    case "dotted":
      ctx.save();
      ctx.fillStyle = safeColor(paper.lineColor, "#b9c4b9");
      for (let y = innerTop; y <= innerBottom; y += spacing) {
        for (let x = innerLeft; x <= innerRight; x += spacing) {
          ctx.beginPath();
          ctx.arc(
            x,
            y,
            Math.max(0.65, mmToPx(paper.lineWidth) * 1.6),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
      ctx.restore();
      break;
    case "cornell": {
      const divider =
        innerLeft + Math.min(mmToPx(52), (innerRight - innerLeft) * 0.29);
      const summaryY =
        innerBottom - Math.min(mmToPx(40), (innerBottom - innerTop) * 0.2);
      drawRule(ctx, divider, innerTop, divider, summaryY, paper, 1.25);
      drawRule(ctx, innerLeft, summaryY, innerRight, summaryY, paper, 1.25);
      lined(innerTop + spacing, summaryY - spacing / 2);
      label("Stichworte", innerLeft + 5, innerTop + 10);
      label("Notizen", divider + 7, innerTop + 10);
      label("Zusammenfassung", innerLeft + 5, summaryY + 12);
      break;
    }
    case "todo": {
      const start = innerTop + spacing * 1.8;
      label("Aufgaben", innerLeft, innerTop + 6);
      for (let y = start; y <= innerBottom; y += spacing * 1.2) {
        const size = Math.min(spacing * 0.42, 14);
        ctx.save();
        ctx.strokeStyle = safeColor(paper.lineColor, "#b9c4b9");
        ctx.lineWidth = Math.max(0.6, mmToPx(paper.lineWidth));
        ctx.strokeRect(innerLeft, y - size / 2, size, size);
        ctx.restore();
        drawRule(
          ctx,
          innerLeft + size + 9,
          y + size / 2,
          innerRight,
          y + size / 2,
          paper
        );
      }
      break;
    }
    case "weekly": {
      const columns = 7;
      const header = Math.min(mmToPx(18), (innerBottom - innerTop) * 0.13);
      const columnWidth = (innerRight - innerLeft) / columns;
      const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
      drawRule(
        ctx,
        innerLeft,
        innerTop + header,
        innerRight,
        innerTop + header,
        paper,
        1.2
      );
      for (let index = 0; index <= columns; index += 1)
        drawRule(
          ctx,
          innerLeft + index * columnWidth,
          innerTop,
          innerLeft + index * columnWidth,
          innerBottom,
          paper
        );
      for (let index = 0; index < columns; index += 1)
        label(
          days[index],
          innerLeft + columnWidth * (index + 0.5),
          innerTop + header / 2,
          "center"
        );
      for (let y = innerTop + header + spacing; y < innerBottom; y += spacing)
        drawRule(ctx, innerLeft, y, innerRight, y, paper, 0.7);
      break;
    }
    case "daily": {
      const timeColumn = Math.min(mmToPx(24), (innerRight - innerLeft) * 0.18);
      label("Tagesplan", innerLeft, innerTop + 7);
      const start = innerTop + spacing * 2;
      drawRule(
        ctx,
        innerLeft + timeColumn,
        start - spacing / 2,
        innerLeft + timeColumn,
        innerBottom,
        paper,
        1.1
      );
      for (let y = start; y < innerBottom; y += spacing * 1.45) {
        drawRule(ctx, innerLeft, y, innerRight, y, paper);
      }
      break;
    }
    case "study": {
      const splitY = innerTop + (innerBottom - innerTop) * 0.58;
      const splitX = innerLeft + (innerRight - innerLeft) * 0.62;
      label("Thema", innerLeft, innerTop + 7);
      drawRule(
        ctx,
        innerLeft,
        innerTop + spacing * 1.35,
        innerRight,
        innerTop + spacing * 1.35,
        paper,
        1.1
      );
      drawRule(ctx, splitX, innerTop + spacing * 1.35, splitX, splitY, paper);
      drawRule(ctx, innerLeft, splitY, innerRight, splitY, paper, 1.1);
      label(
        "Erklärung & Notizen",
        innerLeft + 5,
        innerTop + spacing * 1.35 + 12
      );
      label("Beispiele", splitX + 5, innerTop + spacing * 1.35 + 12);
      label("Merksatz", innerLeft + 5, splitY + 12);
      break;
    }
    case "journal": {
      label("Datum", innerLeft, innerTop + 8);
      drawRule(
        ctx,
        innerLeft + mmToPx(18),
        innerTop + 12,
        innerLeft + mmToPx(70),
        innerTop + 12,
        paper
      );
      label("Heute nehme ich mit …", innerLeft, innerTop + spacing * 2.2);
      lined(innerTop + spacing * 3, innerBottom);
      break;
    }
    case "custom":
      lined();
      break;
    case "blank":
    default:
      break;
  }

  if (paper.border) {
    ctx.save();
    ctx.strokeStyle = safeColor(paper.lineColor, "#b9c4b9");
    ctx.lineWidth = Math.max(0.75, mmToPx(paper.lineWidth) * 1.3);
    ctx.strokeRect(
      Math.max(2, margin * 0.46),
      Math.max(2, margin * 0.46),
      Math.max(1, width - margin * 0.92),
      Math.max(1, height - margin * 0.92)
    );
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = withAlpha(paper.lineColor, 0.86);
  ctx.font = "500 11px Manrope, sans-serif";
  ctx.textBaseline = "middle";
  if (paper.header.trim()) {
    ctx.textAlign = "center";
    ctx.fillText(paper.header.trim(), width / 2, Math.max(10, margin * 0.5));
  }
  if (paper.footer.trim() || paper.pageNumbers) {
    ctx.textAlign = "center";
    const footer = [
      paper.footer.trim(),
      paper.pageNumbers ? String(pageNumber) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    ctx.fillText(footer, width / 2, height - Math.max(10, margin * 0.5));
  }
  ctx.restore();
}

function textLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  paragraphSpacing: number
): TextLine[] {
  const output: TextLine[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    if (!paragraph) {
      output.push({ text: "", paragraphEnd: true });
      continue;
    }
    const words = paragraph.split(/\s+/);
    let committed = "";
    for (const word of words) {
      const candidate = committed ? `${committed} ${word}` : word;
      if (ctx.measureText(candidate).width <= width) {
        committed = candidate;
        continue;
      }
      if (committed) {
        output.push({ text: committed.trimEnd(), paragraphEnd: false });
        committed = "";
      }
      let fragment = "";
      for (const letter of word) {
        if (ctx.measureText(`${fragment}${letter}`).width > width && fragment) {
          output.push({ text: fragment, paragraphEnd: false });
          fragment = letter;
        } else {
          fragment += letter;
        }
      }
      committed = fragment;
    }
    output.push({ text: committed.trimEnd(), paragraphEnd: true });
  }
  // keep the parameter in the signature to document parity with the pure layout helper
  void paragraphSpacing;
  return output;
}

function drawTextElement(
  ctx: CanvasRenderingContext2D,
  element: PageElement,
  family: string
): void {
  const width = Math.max(1, element.width);
  const lineHeight = Math.max(
    1,
    element.fontSize * Math.max(0.7, element.lineHeight)
  );
  ctx.save();
  ctx.translate(element.x, element.y);
  ctx.rotate((element.rotation * Math.PI) / 180);
  ctx.font = fontStyle(element, family);
  ctx.fillStyle = safeColor(element.color, "#354c43");
  ctx.textBaseline = "top";
  ctx.textAlign = element.align;
  ctx.letterSpacing = `${element.letterSpacing || 0}px`;
  let y = 0;
  const anchor =
    element.align === "left"
      ? 0
      : element.align === "center"
        ? width / 2
        : width;
  for (const line of textLines(
    ctx,
    element.text,
    width,
    element.paragraphSpacing
  )) {
    if (y + lineHeight > element.height + 0.5) break;
    ctx.fillText(line.text, anchor, y, width);
    y += lineHeight + (line.paragraphEnd ? element.paragraphSpacing : 0);
  }
  ctx.restore();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number
): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(
    x - size * Math.cos(angle - Math.PI / 6),
    y - size * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(x, y);
  ctx.lineTo(
    x - size * Math.cos(angle + Math.PI / 6),
    y - size * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

function drawGraphicElement(
  ctx: CanvasRenderingContext2D,
  element: PageElement
): void {
  const color = safeColor(element.color, "#315c4c");
  const lineWidth = Math.max(
    1,
    Math.min(8, element.fontSize ? element.fontSize / 15 : 2)
  );
  const width = Math.max(1, element.width);
  const height = Math.max(1, element.height);
  ctx.save();
  ctx.translate(element.x, element.y);
  ctx.rotate((element.rotation * Math.PI) / 180);
  ctx.strokeStyle = color;
  ctx.fillStyle = withAlpha(color, element.type === "highlight" ? 0.22 : 0.1);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (element.type) {
    case "rectangle":
      ctx.fillRect(0, 0, width, height);
      ctx.strokeRect(0, 0, width, height);
      break;
    case "ellipse":
      ctx.beginPath();
      ctx.ellipse(
        width / 2,
        height / 2,
        width / 2,
        height / 2,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();
      break;
    case "line":
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      break;
    case "arrow": {
      const startY = height / 2;
      const endY = height / 2;
      ctx.beginPath();
      ctx.moveTo(0, startY);
      ctx.lineTo(width, endY);
      ctx.stroke();
      drawArrowHead(ctx, width, endY, 0, Math.max(7, lineWidth * 3));
      break;
    }
    case "checkbox": {
      const size = Math.min(width, height);
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeRect(0, 0, size, size);
      if (element.checked) {
        ctx.beginPath();
        ctx.moveTo(size * 0.2, size * 0.52);
        ctx.lineTo(size * 0.43, size * 0.75);
        ctx.lineTo(size * 0.82, size * 0.25);
        ctx.stroke();
      }
      break;
    }
    case "highlight":
      ctx.fillRect(0, 0, width, height);
      break;
    default:
      break;
  }
  ctx.restore();
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Bild konnte nicht geladen werden."));
    image.src = source;
  });
}

async function drawElement(
  ctx: CanvasRenderingContext2D,
  element: PageElement,
  fonts: FontProject[]
): Promise<void> {
  if (element.type === "text") {
    drawTextElement(ctx, element, getFontFamily(element.fontId));
    return;
  }
  if (element.type === "image") {
    if (!element.src) return;
    try {
      const image = await loadImage(element.src);
      ctx.save();
      ctx.translate(element.x, element.y);
      ctx.rotate((element.rotation * Math.PI) / 180);
      ctx.drawImage(
        image,
        0,
        0,
        Math.max(1, element.width),
        Math.max(1, element.height)
      );
      ctx.restore();
    } catch {
      throw new Error(
        "Ein eingebettetes Bild konnte nicht geladen werden. Entferne oder ersetze das Bild und versuche es erneut."
      );
    }
    return;
  }
  void fonts;
  drawGraphicElement(ctx, element);
}

/**
 * Single visual source for PaperPreview, PDF and image export.
 * Coordinates in page elements are always 96-DPI base pixels, not CSS pixels.
 */
export async function renderPage(
  page: StudioPage,
  fonts: FontProject[] = [],
  scale = 1,
  pageNumber = 1
): Promise<HTMLCanvasElement> {
  if (typeof document === "undefined")
    throw new Error("Seitenrendering ist nur im Browser verfügbar.");
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const base = pagePixelDimensions(page.paper);
  const target = pagePixelDimensions(page.paper, safeScale);
  if (target.width * target.height > MAX_RENDER_PIXELS) {
    throw new Error(
      "Die gewählte Auflösung ist für diese Papiergröße zu hoch."
    );
  }
  await loadFonts(fonts);
  if (document.fonts)
    await Promise.all([
      document.fonts.load('400 28px "Caveat"'),
      document.fonts.load('400 14px "Manrope"'),
    ]);
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("Canvas wird von diesem Browser nicht unterstützt.");
  context.scale(target.width / base.width, target.height / base.height);
  drawPaperTemplate(context, page.paper, base.width, base.height, pageNumber);
  for (const element of page.elements)
    await drawElement(context, element, fonts);
  return canvas;
}
