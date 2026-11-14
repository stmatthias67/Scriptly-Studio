/**
 * A small PDF writer for pages whose handwriting is stored as PDF ink annotations
 * (ISO 32000, 12.5.6.13 "Ink Annotations") instead of pixels.
 *
 * GoodNotes, like most note apps, turns ink annotations of an imported PDF into its
 * own pen strokes, so they can be selected, recoloured and erased stroke by stroke.
 * Everything else on the page (paper, images, shapes) is a flat background image.
 * Each annotation also carries an appearance stream, so viewers that do not edit
 * annotations still show the handwriting exactly.
 */

export interface InkPdfStroke {
  /** Points in PDF points, origin bottom left. */
  points: Array<{ x: number; y: number }>;
  /** Line width in PDF points. */
  width: number;
  /** "#rrggbb" */
  color: string;
}

export interface InkPdfPage {
  width: number;
  height: number;
  /** JPEG of everything that is not handwriting, stretched over the page. */
  background?: { jpeg: Uint8Array; pixelWidth: number; pixelHeight: number };
  strokes: InkPdfStroke[];
}

const encoder = new TextEncoder();

function num(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function rgb(color: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  const hex = match ? match[1] : "354c43";
  return [0, 2, 4].map(
    offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
  ) as [number, number, number];
}

/** Drops points closer than `minimum` to the previous kept point; keeps the ends. */
export function simplifyStroke(
  points: Array<{ x: number; y: number }>,
  minimum = 0.25
): Array<{ x: number; y: number }> {
  if (points.length <= 2) return points;
  const kept = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const last = kept[kept.length - 1];
    const point = points[index];
    if (Math.hypot(point.x - last.x, point.y - last.y) >= minimum)
      kept.push(point);
  }
  kept.push(points[points.length - 1]);
  return kept;
}

function boundsOf(stroke: InkPdfStroke): [number, number, number, number] {
  const pad = stroke.width / 2 + 1;
  const xs = stroke.points.map(point => point.x);
  const ys = stroke.points.map(point => point.y);
  return [
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) + pad,
    Math.max(...ys) + pad,
  ];
}

/** Path operators for one stroke with round caps and joins, as a pen would draw. */
function strokeOperators(stroke: InkPdfStroke): string {
  const [r, g, b] = rgb(stroke.color);
  const [first, ...rest] = stroke.points;
  // A single dot needs a tiny segment, otherwise round caps draw nothing.
  const path = rest.length
    ? rest.map(point => `${num(point.x)} ${num(point.y)} l`).join(" ")
    : `${num(first.x + 0.01)} ${num(first.y)} l`;
  return `${num(r)} ${num(g)} ${num(b)} RG ${num(stroke.width)} w 1 J 1 j ${num(first.x)} ${num(first.y)} m ${path} S`;
}

class PdfBuilder {
  private chunks: Uint8Array[] = [];
  private length = 0;
  private offsets: number[] = [];

  constructor() {
    // The binary comment marks the file as binary for transfer tools.
    this.pushBytes(encoder.encode("%PDF-1.7\n"));
    this.pushBytes(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  }

  private pushBytes(bytes: Uint8Array) {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  private push(text: string) {
    this.pushBytes(encoder.encode(text));
  }

  /** Reserves an object number so objects can refer to each other in any order. */
  reserve(): number {
    this.offsets.push(-1);
    return this.offsets.length;
  }

  object(id: number, body: string) {
    this.offsets[id - 1] = this.length;
    this.push(`${id} 0 obj\n${body}\nendobj\n`);
  }

  stream(id: number, dictionary: string, data: Uint8Array | string) {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    this.offsets[id - 1] = this.length;
    this.push(
      `${id} 0 obj\n<< ${dictionary} /Length ${bytes.length} >>\nstream\n`
    );
    this.pushBytes(bytes);
    this.push("\nendstream\nendobj\n");
  }

  finish(rootId: number, infoId: number): Uint8Array {
    if (this.offsets.some(offset => offset < 0))
      throw new Error("PDF object was reserved but never written.");
    const xrefOffset = this.length;
    const rows = this.offsets
      .map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`)
      .join("");
    this.push(
      `xref\n0 ${this.offsets.length + 1}\n0000000000 65535 f \n${rows}` +
        `trailer\n<< /Size ${this.offsets.length + 1} /Root ${rootId} 0 R /Info ${infoId} 0 R >>\n` +
        `startxref\n${xrefOffset}\n%%EOF\n`
    );
    const output = new Uint8Array(this.length);
    let position = 0;
    for (const chunk of this.chunks) {
      output.set(chunk, position);
      position += chunk.length;
    }
    return output;
  }
}

function pdfDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function pdfText(value: string): string {
  // Plain ASCII literal; anything else is dropped so the string stays valid.
  return `(${value.replace(/[^\x20-\x7e]/g, "").replace(/([\\()])/g, "\\$1")})`;
}

/** Writes a complete PDF whose handwriting is editable ink annotations. */
export function writeInkPdf(
  pages: InkPdfPage[],
  title = "Scriptly Studio",
  now = new Date()
): Uint8Array {
  if (!pages.length) throw new Error("Keine Seiten zum Exportieren.");
  const pdf = new PdfBuilder();
  const catalog = pdf.reserve();
  const pagesId = pdf.reserve();
  const info = pdf.reserve();
  const pageIds: number[] = [];
  const date = pdfDate(now);

  pages.forEach((page, pageIndex) => {
    const pageId = pdf.reserve();
    pageIds.push(pageId);
    const contentId = pdf.reserve();
    const imageId = page.background ? pdf.reserve() : 0;
    const annotationIds: number[] = [];

    page.strokes.forEach((original, strokeIndex) => {
      const stroke = { ...original, points: simplifyStroke(original.points) };
      if (!stroke.points.length) return;
      const [x0, y0, x1, y1] = boundsOf(stroke);
      const rect = `[${num(x0)} ${num(y0)} ${num(x1)} ${num(y1)}]`;
      const appearanceId = pdf.reserve();
      const annotationId = pdf.reserve();
      annotationIds.push(annotationId);
      pdf.stream(
        appearanceId,
        `/Type /XObject /Subtype /Form /FormType 1 /BBox ${rect}`,
        strokeOperators(stroke)
      );
      const inkList = stroke.points
        .map(point => `${num(point.x)} ${num(point.y)}`)
        .join(" ");
      const [r, g, b] = rgb(stroke.color);
      pdf.object(
        annotationId,
        `<< /Type /Annot /Subtype /Ink /Rect ${rect} /InkList [[${inkList}]] ` +
          `/C [${num(r)} ${num(g)} ${num(b)}] /CA 1 /BS << /Type /Border /W ${num(stroke.width)} /S /S >> ` +
          `/F 4 /P ${pageId} 0 R /NM (scriptly-${pageIndex + 1}-${strokeIndex + 1}) ` +
          `/T (Scriptly Studio) /M (${date}) /AP << /N ${appearanceId} 0 R >> >>`
      );
    });

    if (page.background && imageId) {
      pdf.stream(
        imageId,
        `/Type /XObject /Subtype /Image /Width ${page.background.pixelWidth} /Height ${page.background.pixelHeight} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
        page.background.jpeg
      );
    }
    pdf.stream(
      contentId,
      "",
      page.background
        ? `q ${num(page.width)} 0 0 ${num(page.height)} 0 0 cm /Paper Do Q`
        : ""
    );
    const resources = page.background
      ? `/Resources << /XObject << /Paper ${imageId} 0 R >> >>`
      : "/Resources << >>";
    const annots = annotationIds.length
      ? `/Annots [${annotationIds.map(id => `${id} 0 R`).join(" ")}]`
      : "";
    pdf.object(
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(page.width)} ${num(page.height)}] ${resources} /Contents ${contentId} 0 R ${annots} >>`
    );
  });

  pdf.object(
    pagesId,
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`
  );
  pdf.object(catalog, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  pdf.object(
    info,
    `<< /Title ${pdfText(title)} /Producer (Scriptly Studio) /CreationDate (${date}) >>`
  );
  return pdf.finish(catalog, info);
}
