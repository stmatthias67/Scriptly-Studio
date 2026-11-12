import { Check } from "lucide-react";
import { useStudio } from "./store";
import type { PaperSettings } from "./types";
import { paperLocale } from "./locales/paper";

/**
 * Picks the sheet for a page or a default: the standard sheets plus every
 * uploaded sheet. Sheets are only designed in the Papier-Studio.
 */
export function PaperControls({
  paper,
  onChange,
  compact = false,
}: {
  paper: PaperSettings;
  onChange: (paper: PaperSettings) => void;
  compact?: boolean;
}) {
  const { data } = useStudio();
  return (
    <div
      className={`sheet-picker ${compact ? "compact" : ""}`}
      role="radiogroup"
      aria-label={paperLocale.chooseSheet}
    >
      {data.templates.map(template => {
        const active =
          paper.type === "image" &&
          paper.background === template.paper.background;
        return (
          <button
            key={template.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`sheet-picker-option ${active ? "active" : ""}`}
            onClick={() => onChange(structuredClone(template.paper))}
          >
            <span className="sheet-picker-thumb">
              {template.paper.background && (
                <img src={template.paper.background} alt="" loading="lazy" />
              )}
              {active && (
                <i>
                  <Check size={12} />
                </i>
              )}
            </span>
            <span className="sheet-picker-name">{template.name}</span>
          </button>
        );
      })}
    </div>
  );
}
