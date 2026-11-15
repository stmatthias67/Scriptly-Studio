import { canExportAsInk, inkStrokesForElement, renderPage } from "./render";
import {
  buildGoodnotesNotebook,
  GN_PAGE_PT,
  GN_PER_PT,
  type GoodNotesStroke,
} from "./goodnotes-format";
import {
  paperDimensions,
  type FontProject,
  type StudioDocument,
} from "./types";

const PT_PER_PX = 72 / 96;
const PT_PER_MM = 72 / 25.4;

export interface GoodNotesFile {
  /** File name including the .goodnotes extension. */
  name: string;
  bytes: Uint8Array;
}

export interface GoodNotesExport {
  files: GoodNotesFile[];
  /** Text blocks written as GoodNotes ink. */
  inkBlocks: number;
  /** Text blocks that stay part of the paper (built-in fonts or undrawn characters). */
  flatBlocks: number;
}

function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality = 0.9
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error("Die Seite konnte nicht gespeichert werden."));
          return;
        }
        void blob.arrayBuffer().then(buffer => resolve(new Uint8Array(buffer)));
      },
      "image/jpeg",
      quality
    );
  });
}

function rgba(color: string): [number, number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  const hex = match ? match[1] : "354c43";
  const [r, g, b] = [0, 2, 4].map(
    offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
  );
  return [r, g, b, 1];
}

/**
 * Builds native GoodNotes notebooks: one .goodnotes file per page, because a notebook
 * shell describes exactly one page. The paper (sheet, images, shapes and any text in
 * built-in fonts) becomes the page background inside the notebook; handwriting from
 * your own fonts becomes real GoodNotes ink that can be erased and edited.
 */
export async function buildGoodnotesFiles(
  document: StudioDocument,
  fonts: FontProject[],
  indexes: number[],
  baseName: string,
  dpi = 150,
  onProgress?: (current: number, total: number) => void
): Promise<GoodNotesExport> {
  const { jsPDF } = await import("jspdf");
  const files: GoodNotesFile[] = [];
  let inkBlocks = 0;
  let flatBlocks = 0;
  for (let position = 0; position < indexes.length; position += 1) {
    const index = indexes[position];
    const page = document.pages[index];
    onProgress?.(position + 1, indexes.length);

    const inkElements = page.elements.filter(element =>
      canExportAsInk(
        element,
        fonts.find(font => font.id === element.fontId)
      )
    );
    inkBlocks += inkElements.length;
    flatBlocks +=
      page.elements.filter(
        element => element.type === "text" && element.text.trim()
      ).length - inkElements.length;

    // The notebook page is A4 portrait; other sheet sizes are fitted and centred.
    const size = paperDimensions(page.paper);
    const widthPt = size.width * PT_PER_MM;
    const heightPt = size.height * PT_PER_MM;
    const fit = Math.min(
      GN_PAGE_PT.width / widthPt,
      GN_PAGE_PT.height / heightPt
    );
    const offsetX = (GN_PAGE_PT.width - widthPt * fit) / 2;
    const offsetY = (GN_PAGE_PT.height - heightPt * fit) / 2;

    // Rendering first also installs the handwriting fonts the ink layout measures with.
    const background = await renderPage(
      page,
      fonts,
      dpi / 96,
      index + 1,
      new Set(inkElements.map(element => element.id))
    );
    const paper = new jsPDF({
      unit: "pt",
      format: [GN_PAGE_PT.width, GN_PAGE_PT.height],
      orientation: "portrait",
      compress: true,
    });
    paper.addImage(
      await canvasToJpeg(background),
      "JPEG",
      offsetX,
      offsetY,
      widthPt * fit,
      heightPt * fit,
      undefined,
      "FAST"
    );
    const thumbnail = await renderPage(page, fonts, 0.5, index + 1);

    const toGn = PT_PER_PX * fit * GN_PER_PT;
    const strokes: GoodNotesStroke[] = inkElements.flatMap(element => {
      const project = fonts.find(font => font.id === element.fontId);
      if (!project) return [];
      return inkStrokesForElement(element, project).map(stroke => ({
        rgba: rgba(stroke.color),
        width: stroke.width * toGn,
        points: stroke.points.map(
          point =>
            [
              (offsetX + point.x * PT_PER_PX * fit) * GN_PER_PT,
              (offsetY + point.y * PT_PER_PX * fit) * GN_PER_PT,
            ] as [number, number]
        ),
      }));
    });

    const bytes = await buildGoodnotesNotebook({
      strokes,
      paperPdf: new Uint8Array(paper.output("arraybuffer")),
      thumbnailJpeg: await canvasToJpeg(thumbnail, 0.85),
    });
    const suffix = indexes.length > 1 ? ` (Seite ${index + 1})` : "";
    files.push({ name: `${baseName}${suffix}.goodnotes`, bytes });
  }
  return { files, inkBlocks, flatBlocks };
}
