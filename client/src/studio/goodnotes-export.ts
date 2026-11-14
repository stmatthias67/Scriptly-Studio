import { canExportAsInk, inkStrokesForElement, renderPage } from "./render";
import { writeInkPdf, type InkPdfPage } from "./ink-pdf";
import {
  paperDimensions,
  type FontProject,
  type StudioDocument,
} from "./types";

const PT_PER_PX = 72 / 96;
const PT_PER_MM = 72 / 25.4;

export interface EditableExportResult {
  bytes: Uint8Array;
  /** Text blocks written as editable pen strokes. */
  inkBlocks: number;
  /** Text blocks that had to stay flat (built-in fonts or undrawn characters). */
  flatBlocks: number;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(
            new Error("Die Seite konnte nicht als Bild gespeichert werden.")
          );
          return;
        }
        void blob.arrayBuffer().then(buffer => resolve(new Uint8Array(buffer)));
      },
      "image/jpeg",
      0.92
    );
  });
}

/**
 * Builds the GoodNotes export: a PDF in which handwriting from your own fonts is
 * stored as ink annotations (real, erasable strokes) and everything else, such as
 * the paper, images and shapes, is the page background.
 */
export async function buildEditablePdf(
  document: StudioDocument,
  fonts: FontProject[],
  indexes: number[],
  dpi = 150,
  onProgress?: (current: number, total: number) => void
): Promise<EditableExportResult> {
  const pages: InkPdfPage[] = [];
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
    flatBlocks +=
      page.elements.filter(
        element => element.type === "text" && element.text.trim()
      ).length - inkElements.length;
    inkBlocks += inkElements.length;
    // Rendering first also installs the handwriting fonts the layout measures with.
    const background = await renderPage(
      page,
      fonts,
      dpi / 96,
      index + 1,
      new Set(inkElements.map(element => element.id))
    );
    const size = paperDimensions(page.paper);
    const height = size.height * PT_PER_MM;
    const strokes = inkElements.flatMap(element => {
      const project = fonts.find(font => font.id === element.fontId);
      return project ? inkStrokesForElement(element, project) : [];
    });
    pages.push({
      width: size.width * PT_PER_MM,
      height,
      background: {
        jpeg: await canvasToJpeg(background),
        pixelWidth: background.width,
        pixelHeight: background.height,
      },
      strokes: strokes.map(stroke => ({
        color: stroke.color,
        width: stroke.width * PT_PER_PX,
        points: stroke.points.map(point => ({
          x: point.x * PT_PER_PX,
          y: height - point.y * PT_PER_PX,
        })),
      })),
    });
  }
  return {
    bytes: writeInkPdf(pages, document.title || "Scriptly Studio"),
    inkBlocks,
    flatBlocks,
  };
}
