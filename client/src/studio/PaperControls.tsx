import type { ChangeEvent, CSSProperties } from "react";
import { Check, Palette, Ruler, SlidersHorizontal } from "lucide-react";
import type { PageFormat, PaperSettings, PaperType } from "./types";
import {
  paperColorPalette,
  paperFormatLabels,
  paperLocale,
  paperTypeDescriptions,
  paperTypeLabels,
} from "./locales/paper";
import "./PaperStudio.css";

type PaperControlsProps = {
  paper: PaperSettings;
  onChange: (paper: PaperSettings) => void;
  compact?: boolean;
};

const PAPER_TYPES: PaperType[] = [
  "blank",
  "lined",
  "grid",
  "dotted",
  "cornell",
  "todo",
  "weekly",
  "daily",
  "study",
  "journal",
  "custom",
];
const PAGE_FORMATS: Exclude<PageFormat, "custom">[] = ["A4", "A5", "Letter"];
const STANDARD_DIMENSIONS: Record<
  Exclude<PageFormat, "custom">,
  [number, number]
> = {
  A4: [210, 297],
  A5: [148, 210],
  Letter: [215.9, 279.4],
};

const LIMITS = {
  width: [50, 600],
  height: [50, 600],
  spacing: [2, 40],
  lineWidth: [0.05, 2],
  margin: [0, 80],
} as const;

function dimensionsFor(
  format: Exclude<PageFormat, "custom">,
  orientation: PaperSettings["orientation"]
) {
  const [shortEdge, longEdge] = STANDARD_DIMENSIONS[format];
  return orientation === "landscape"
    ? { width: longEdge, height: shortEdge }
    : { width: shortEdge, height: longEdge };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function displayNumber(value: number) {
  return String(value);
}

function colorLabel(type: PaperType) {
  if (type === "grid") return paperLocale.gridColor;
  if (type === "dotted") return paperLocale.dotColor;
  return paperLocale.ruleColor;
}

function ColorPicker({
  label,
  color,
  onChange,
}: {
  label: string;
  color: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="paper-color-control">
      <span className="paper-control-label">{label}</span>
      <div className="paper-swatch-row" role="group" aria-label={label}>
        {paperColorPalette.map(candidate => (
          <button
            type="button"
            className={`paper-swatch ${color.toLowerCase() === candidate.toLowerCase() ? "is-selected" : ""}`}
            key={candidate}
            style={{ "--swatch-color": candidate } as CSSProperties}
            onClick={() => onChange(candidate)}
            aria-label={`${label}: ${candidate}`}
            aria-pressed={color.toLowerCase() === candidate.toLowerCase()}
          >
            {color.toLowerCase() === candidate.toLowerCase() && (
              <Check size={12} strokeWidth={3} />
            )}
          </button>
        ))}
        <label className="paper-custom-color" title={paperLocale.customColor}>
          <Palette size={14} aria-hidden="true" />
          <input
            type="color"
            value={color}
            onChange={event => onChange(event.currentTarget.value)}
            aria-label={paperLocale.customColor}
          />
        </label>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="paper-toggle-row">
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.currentTarget.checked)}
      />
      <span className="paper-toggle-indicator" aria-hidden="true">
        <span />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}

export function PaperControls({
  paper,
  onChange,
  compact = false,
}: PaperControlsProps) {
  const patch = (changes: Partial<PaperSettings>) =>
    onChange({ ...paper, ...changes });
  const setNumeric = (
    key: keyof typeof LIMITS,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const raw = event.currentTarget.value;
    if (raw === "") return;
    const number = Number(raw);
    if (!Number.isFinite(number)) return;
    const [minimum, maximum] = LIMITS[key];
    patch({ [key]: clamp(number, minimum, maximum) } as Partial<PaperSettings>);
  };
  const chooseFormat = (format: PageFormat) => {
    if (format === "custom") {
      patch({
        format,
        width: clamp(paper.width, ...LIMITS.width),
        height: clamp(paper.height, ...LIMITS.height),
      });
      return;
    }
    patch({ format, ...dimensionsFor(format, paper.orientation) });
  };
  const chooseOrientation = (orientation: PaperSettings["orientation"]) => {
    if (orientation === paper.orientation) return;
    if (paper.format === "custom") {
      patch({ orientation, width: paper.height, height: paper.width });
      return;
    }
    patch({ orientation, ...dimensionsFor(paper.format, orientation) });
  };

  return (
    <aside
      className={`paper-controls ${compact ? "is-compact" : ""}`}
      aria-label={paperLocale.controls}
    >
      <section className="paper-control-section paper-type-section">
        <div className="paper-section-heading">
          <span className="eyebrow">{paperLocale.type}</span>
          {!compact && <p>{paperLocale.typeHint}</p>}
        </div>
        <div className="paper-type-grid">
          {PAPER_TYPES.map(type => (
            <button
              type="button"
              key={type}
              className={`paper-type-choice ${paper.type === type ? "is-selected" : ""}`}
              onClick={() => patch({ type })}
              aria-pressed={paper.type === type}
            >
              <span>{paperTypeLabels[type]}</span>
              {!compact && <small>{paperTypeDescriptions[type]}</small>}
            </button>
          ))}
        </div>
      </section>

      <section className="paper-control-section">
        <div className="paper-section-heading">
          <span className="eyebrow">
            <Ruler size={13} aria-hidden="true" /> {paperLocale.format}
          </span>
        </div>
        <div className="paper-field-grid">
          <label className="field paper-full-field">
            <span>{paperLocale.format}</span>
            <select
              aria-label={paperLocale.format}
              value={paper.format}
              onChange={event =>
                chooseFormat(event.currentTarget.value as PageFormat)
              }
            >
              {PAGE_FORMATS.map(format => (
                <option key={format} value={format}>
                  {paperFormatLabels[format]}
                </option>
              ))}
              <option value="custom">{paperFormatLabels.custom}</option>
            </select>
          </label>
          <div
            className="paper-segmented"
            role="group"
            aria-label={paperLocale.orientation}
          >
            <button
              type="button"
              className={paper.orientation === "portrait" ? "is-selected" : ""}
              onClick={() => chooseOrientation("portrait")}
              aria-pressed={paper.orientation === "portrait"}
            >
              {paperLocale.portrait}
            </button>
            <button
              type="button"
              className={paper.orientation === "landscape" ? "is-selected" : ""}
              onClick={() => chooseOrientation("landscape")}
              aria-pressed={paper.orientation === "landscape"}
            >
              {paperLocale.landscape}
            </button>
          </div>
          {paper.format === "custom" && (
            <div className="paper-field-grid paper-custom-dimensions">
              <label className="field">
                <span>{paperLocale.width}</span>
                <span className="paper-number-input">
                  <input
                    type="number"
                    min={LIMITS.width[0]}
                    max={LIMITS.width[1]}
                    step="0.1"
                    value={displayNumber(paper.width)}
                    onChange={event => setNumeric("width", event)}
                    inputMode="decimal"
                  />
                  <em>{paperLocale.millimetres}</em>
                </span>
              </label>
              <label className="field">
                <span>{paperLocale.height}</span>
                <span className="paper-number-input">
                  <input
                    type="number"
                    min={LIMITS.height[0]}
                    max={LIMITS.height[1]}
                    step="0.1"
                    value={displayNumber(paper.height)}
                    onChange={event => setNumeric("height", event)}
                    inputMode="decimal"
                  />
                  <em>{paperLocale.millimetres}</em>
                </span>
              </label>
              <p className="paper-field-note paper-full-field">
                {paperLocale.dimensionsHint}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="paper-control-section">
        <div className="paper-section-heading">
          <span className="eyebrow">
            <Palette size={13} aria-hidden="true" /> {paperLocale.colors}
          </span>
        </div>
        <ColorPicker
          label={paperLocale.backgroundColor}
          color={paper.color}
          onChange={color => patch({ color })}
        />
        <ColorPicker
          label={colorLabel(paper.type)}
          color={paper.lineColor}
          onChange={lineColor => patch({ lineColor })}
        />
      </section>

      <section className="paper-control-section">
        <div className="paper-section-heading">
          <span className="eyebrow">
            <SlidersHorizontal size={13} aria-hidden="true" />{" "}
            {paperLocale.structure}
          </span>
        </div>
        <div className="paper-field-grid paper-field-grid-three">
          <label className="field">
            <span>{paperLocale.spacing}</span>
            <span className="paper-number-input">
              <input
                type="number"
                min={LIMITS.spacing[0]}
                max={LIMITS.spacing[1]}
                step="0.5"
                value={displayNumber(paper.spacing)}
                onChange={event => setNumeric("spacing", event)}
                inputMode="decimal"
              />
              <em>{paperLocale.millimetres}</em>
            </span>
            <small className="muted">{paperLocale.spacingHint}</small>
          </label>
          <label className="field">
            <span>{paperLocale.thickness}</span>
            <span className="paper-number-input">
              <input
                type="number"
                min={LIMITS.lineWidth[0]}
                max={LIMITS.lineWidth[1]}
                step="0.05"
                value={displayNumber(paper.lineWidth)}
                onChange={event => setNumeric("lineWidth", event)}
                inputMode="decimal"
              />
              <em>{paperLocale.millimetres}</em>
            </span>
            <small className="muted">{paperLocale.thicknessHint}</small>
          </label>
          <label className="field">
            <span>{paperLocale.margin}</span>
            <span className="paper-number-input">
              <input
                type="number"
                min={LIMITS.margin[0]}
                max={LIMITS.margin[1]}
                step="1"
                value={displayNumber(paper.margin)}
                onChange={event => setNumeric("margin", event)}
                inputMode="decimal"
              />
              <em>{paperLocale.millimetres}</em>
            </span>
            <small className="muted">{paperLocale.marginHint}</small>
          </label>
        </div>
      </section>

      <section className="paper-control-section">
        <div className="paper-section-heading">
          <span className="eyebrow">{paperLocale.headings}</span>
        </div>
        <div className="paper-field-grid">
          <label className="field">
            <span>{paperLocale.header}</span>
            <input
              maxLength={200}
              value={paper.header}
              onChange={event => patch({ header: event.currentTarget.value })}
              placeholder={paperLocale.headerPlaceholder}
            />
          </label>
          <label className="field">
            <span>{paperLocale.footer}</span>
            <input
              maxLength={200}
              value={paper.footer}
              onChange={event => patch({ footer: event.currentTarget.value })}
              placeholder={paperLocale.footerPlaceholder}
            />
          </label>
        </div>
      </section>

      <section className="paper-control-section">
        <div className="paper-section-heading">
          <span className="eyebrow">{paperLocale.finishing}</span>
        </div>
        <div className="paper-toggle-stack">
          <Toggle
            checked={paper.border}
            title={paperLocale.border}
            description={paperLocale.borderHint}
            onChange={border => patch({ border })}
          />
          <Toggle
            checked={paper.texture}
            title={paperLocale.texture}
            description={paperLocale.textureHint}
            onChange={texture => patch({ texture })}
          />
          <Toggle
            checked={paper.pageNumbers}
            title={paperLocale.pageNumbers}
            description={paperLocale.pageNumbersHint}
            onChange={pageNumbers => patch({ pageNumbers })}
          />
        </div>
      </section>
    </aside>
  );
}
