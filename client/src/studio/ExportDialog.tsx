import { useEffect, useMemo, useState } from "react";
import { Download, FileImage, FileText, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./components";
import { MAX_RENDER_PIXELS, pagePixelDimensions, renderPage } from "./render";
import type { FontProject, StudioDocument } from "./types";
import { paperDimensions } from "./types";
import { editorText as t } from "./locales/editor";

export type ExportFormat = "pdf" | "png" | "jpeg";
export type ExportScope = "all" | "current" | "selected";

export interface ExportDialogProps {
  document: StudioDocument;
  open: boolean;
  onClose: () => void;
  fonts?: FontProject[];
  currentPageIndex?: number;
}

export function sanitizeFilename(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned || t.untitledFile;
}

/** Converts a human page list such as "1, 3-5" to zero-based unique indices. */
export function parsePageSelection(value: string, pageCount: number): number[] {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1 || !value.trim())
    return [];
  const selected = new Set<number>();
  for (const part of value.split(",")) {
    const token = part.trim().replace(/–|—/g, "-");
    if (!token) return [];
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    const single = token.match(/^\d+$/);
    if (single) {
      const number = Number(single[0]);
      if (!Number.isSafeInteger(number) || number < 1 || number > pageCount)
        return [];
      selected.add(number - 1);
      continue;
    }
    if (!range) return [];
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 1 ||
      end < start ||
      end > pageCount
    )
      return [];
    for (let number = start; number <= end; number += 1)
      selected.add(number - 1);
  }
  return [...selected].sort((a, b) => a - b);
}

function ensureRenderable(
  document: StudioDocument,
  indexes: number[],
  dpi: number
): void {
  if (!indexes.length) throw new Error(t.invalidPages);
  const scale = dpi / 96;
  for (const index of indexes) {
    const page = document.pages[index];
    if (!page) throw new Error(t.invalidPages);
    const pixels = pagePixelDimensions(page.paper, scale);
    if (
      pixels.width * pixels.height > MAX_RENDER_PIXELS ||
      pixels.width > 8192 ||
      pixels.height > 8192
    ) {
      throw new Error(t.resolutionTooHigh);
    }
  }
}

function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = window.document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.style.display = "none";
  window.document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function exportPdf(
  document: StudioDocument,
  fonts: FontProject[] = [],
  indexes: number[],
  filename: string,
  dpi = 150,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  ensureRenderable(document, indexes, dpi);
  const { jsPDF } = await import("jspdf");
  const first = document.pages[indexes[0]];
  const firstDimensions = paperDimensions(first.paper);
  const pdf = new jsPDF({
    orientation:
      firstDimensions.width > firstDimensions.height ? "landscape" : "portrait",
    unit: "mm",
    format: [firstDimensions.width, firstDimensions.height],
    compress: true,
  });
  for (let position = 0; position < indexes.length; position += 1) {
    const index = indexes[position];
    const page = document.pages[index];
    const dimensions = paperDimensions(page.paper);
    if (position > 0) {
      pdf.addPage(
        [dimensions.width, dimensions.height],
        dimensions.width > dimensions.height ? "landscape" : "portrait"
      );
    }
    onProgress?.(position + 1, indexes.length);
    const canvas = await renderPage(page, fonts, dpi / 96, index + 1);
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      0,
      0,
      dimensions.width,
      dimensions.height,
      undefined,
      "FAST"
    );
  }
  pdf.save(`${sanitizeFilename(filename)}.pdf`);
}

async function exportImages(
  document: StudioDocument,
  fonts: FontProject[],
  indexes: number[],
  filename: string,
  format: Extract<ExportFormat, "png" | "jpeg">,
  dpi: number,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  ensureRenderable(document, indexes, dpi);
  const extension = format === "jpeg" ? "jpg" : "png";
  const prefix = sanitizeFilename(filename);
  for (let position = 0; position < indexes.length; position += 1) {
    const index = indexes[position];
    onProgress?.(position + 1, indexes.length);
    const canvas = await renderPage(
      document.pages[index],
      fonts,
      dpi / 96,
      index + 1
    );
    downloadDataUrl(
      canvas.toDataURL(format === "jpeg" ? "image/jpeg" : "image/png", 0.92),
      `${prefix}-seite-${String(index + 1).padStart(2, "0")}.${extension}`
    );
  }
}

export default function ExportDialog({
  document,
  open,
  onClose,
  fonts = [],
  currentPageIndex = 0,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [scope, setScope] = useState<ExportScope>("all");
  const [range, setRange] = useState("");
  const [dpi, setDpi] = useState(150);
  const [filename, setFilename] = useState(document.title || t.untitledFile);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFilename(document.title || t.untitledFile);
      setError("");
      setProgress(null);
    }
  }, [open, document.title]);

  const indexes = useMemo(() => {
    if (scope === "all") return document.pages.map((_, index) => index);
    if (scope === "current")
      return document.pages[currentPageIndex] ? [currentPageIndex] : [];
    return parsePageSelection(range, document.pages.length);
  }, [currentPageIndex, document.pages, range, scope]);

  const estimatedPixels = useMemo(
    () =>
      indexes.reduce((largest, index) => {
        const size = pagePixelDimensions(document.pages[index].paper, dpi / 96);
        return Math.max(largest, size.width * size.height);
      }, 0),
    [document.pages, dpi, indexes]
  );

  const sizeSummary = [
    ...new Set(
      indexes.map(index => {
        const p = document.pages[index].paper;
        const d = paperDimensions(p);
        return `${p.format === "custom" ? t.customFormat : p.format} · ${d.width} × ${d.height} mm`;
      })
    ),
  ].join(" / ");

  const startExport = async () => {
    const safeFilename = sanitizeFilename(filename);
    if (!filename.trim()) {
      setError(t.filenameRequired);
      return;
    }
    if (!indexes.length) {
      setError(t.invalidPages);
      return;
    }
    if (estimatedPixels > MAX_RENDER_PIXELS) {
      setError(t.resolutionTooHigh);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updateProgress = (current: number, total: number) =>
        setProgress({ current, total });
      if (format === "pdf")
        await exportPdf(
          document,
          fonts,
          indexes,
          safeFilename,
          dpi,
          updateProgress
        );
      else
        await exportImages(
          document,
          fonts,
          indexes,
          safeFilename,
          format,
          dpi,
          updateProgress
        );
      toast.success(t.exportDone);
      onClose();
    } catch (reason) {
      const message =
        reason instanceof Error && reason.message
          ? reason.message
          : t.exportFailed;
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={t.exportTitle}
    >
      <div className="export-dialog">
        <label className="field">
          <span>{t.fileName}</span>
          <input
            aria-label={t.fileName}
            value={filename}
            maxLength={120}
            onChange={event => setFilename(event.target.value)}
            disabled={busy}
          />
        </label>
        <label className="field">
          <span>{t.format}</span>
          <select
            aria-label={t.format}
            value={format}
            onChange={event => setFormat(event.target.value as ExportFormat)}
            disabled={busy}
          >
            <option value="pdf">PDF</option>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
        </label>
        <fieldset className="export-scope" disabled={busy}>
          <legend>{t.pageSelection}</legend>
          <label>
            <input
              type="radio"
              checked={scope === "all"}
              onChange={() => setScope("all")}
            />
            {t.allPages} ({document.pages.length})
          </label>
          <label>
            <input
              type="radio"
              checked={scope === "current"}
              onChange={() => setScope("current")}
            />
            {t.currentPage} (
            {Math.min(document.pages.length, currentPageIndex + 1)})
          </label>
          <label>
            <input
              type="radio"
              checked={scope === "selected"}
              onChange={() => setScope("selected")}
            />
            {t.selectedPages}
          </label>
          {scope === "selected" && (
            <label className="field">
              <span>{t.pageRange}</span>
              <input
                aria-label={t.pageRange}
                value={range}
                placeholder="1, 3–5"
                onChange={event => setRange(event.target.value)}
                aria-describedby="page-range-help"
              />
              <small id="page-range-help" className="muted">
                {t.pageRangeHint}
              </small>
            </label>
          )}
        </fieldset>
        <label className="field">
          <span>{t.resolution}</span>
          <select
            aria-label={t.resolution}
            value={dpi}
            onChange={event => setDpi(Number(event.target.value))}
            disabled={busy}
          >
            <option value={96}>96 dpi</option>
            <option value={150}>150 dpi</option>
            <option value={300}>300 dpi</option>
          </select>
        </label>
        <p className="muted export-paper-size">
          {t.paperSize}: {sizeSummary}
        </p>
        <p className="export-info">
          {format === "pdf" ? (
            <>
              <FileText size={16} />
              {t.pdfInfo}
            </>
          ) : (
            <>
              <FileImage size={16} />
              {t.imageExportInfo}
            </>
          )}
        </p>
        {progress && (
          <p className="export-progress">
            <LoaderCircle size={16} className="spin" />
            {t.exportProgress
              .replace("{current}", String(progress.current))
              .replace("{total}", String(progress.total))}
          </p>
        )}
        {error && (
          <p className="export-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose} disabled={busy}>
            {t.cancel}
          </button>
          <button
            className="btn primary"
            onClick={() => void startExport()}
            disabled={busy || !indexes.length}
          >
            <Download size={16} />
            {busy ? t.exporting : t.exportStart}
          </button>
        </div>
      </div>
    </Modal>
  );
}
