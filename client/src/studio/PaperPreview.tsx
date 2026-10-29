import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { FontProject, StudioPage } from "./types";
import { pageAspectRatio, renderPage } from "./render";

export interface PaperPreviewProps {
  page: StudioPage;
  fonts?: FontProject[];
  className?: string;
  style?: CSSProperties;
  pageNumber?: number;
}

/** A responsive canvas preview with the exact same visual renderer as the export pipeline. */
export default function PaperPreview({
  page,
  fonts = [],
  className = "",
  style,
  pageNumber = 1,
}: PaperPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      try {
        const rendered = await renderPage(page, fonts, 1.25, pageNumber);
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = rendered.width;
        canvas.height = rendered.height;
        const context = canvas.getContext("2d");
        context?.drawImage(rendered, 0, 0);
      } catch {
        // The parent surface remains usable; export exposes the actionable error.
      }
    };
    void draw();
    return () => {
      cancelled = true;
    };
  }, [page, fonts, pageNumber]);

  return (
    <div
      className={`paper-preview ${className}`.trim()}
      style={{ aspectRatio: String(pageAspectRatio(page.paper)), ...style }}
      aria-label={`Vorschau Seite ${pageNumber}`}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
