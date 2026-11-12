import type { FontProject, Stroke } from "./types";
import { inkedVariants } from "./font-engine";
import { pressureWidth } from "./stroke-tools";
import { fontCharacterGroups } from "./locales/fonts";
import "./HandwritingSample.css";

const DRAWING_SIZE = 400;

function pathData(stroke: Stroke) {
  return stroke.points
    .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");
}

/** One drawn stroke; with pen pressure every segment gets its own width. */
export function InkStroke({ stroke }: { stroke: Stroke }) {
  const points = stroke.points;
  if (!points.length) return null;
  if (points.length === 1)
    return (
      <circle
        cx={points[0].x}
        cy={points[0].y}
        r={pressureWidth(stroke.width, points[0].pressure) / 2}
        className="font-stroke-dot"
      />
    );
  if (!points.some(point => point.pressure !== undefined))
    return (
      <path
        d={pathData(stroke)}
        className="font-stroke"
        strokeWidth={stroke.width}
      />
    );
  return (
    <g className="font-stroke">
      {points.slice(1).map((point, index) => {
        const previous = points[index];
        return (
          <line
            key={index}
            x1={previous.x}
            y1={previous.y}
            x2={point.x}
            y2={point.y}
            strokeWidth={pressureWidth(
              stroke.width,
              ((previous.pressure ?? 0.5) + (point.pressure ?? 0.5)) / 2
            )}
          />
        );
      })}
    </g>
  );
}

function sampleCharacters(project: FontProject, preferred: string) {
  const drawn = (character: string) =>
    inkedVariants(project.glyphs?.[character]).length > 0;
  const wanted = [...preferred].filter(drawn);
  if (wanted.length) return wanted;
  return fontCharacterGroups
    .flatMap(group => [...group.characters])
    .filter(drawn)
    .slice(0, preferred.length || 3);
}

/**
 * Shows a font exactly as it was written: the saved strokes themselves, not a
 * rebuilt font file and never a fallback typeface.
 */
export function HandwritingSample({
  project,
  text = "Abc",
  className = "",
  emptyLabel = "Noch keine Zeichen",
}: {
  project: FontProject;
  text?: string;
  className?: string;
  emptyLabel?: string;
}) {
  const characters = sampleCharacters(project, text);
  if (!characters.length)
    return (
      <span className={`handwriting-sample empty ${className}`}>
        {emptyLabel}
      </span>
    );
  const baseline = project.settings?.baseline ?? 300;
  const top = Math.max(0, baseline - 280);
  const bottom = Math.min(DRAWING_SIZE, baseline + 100);
  return (
    <span
      className={`handwriting-sample ${className}`}
      role="img"
      aria-label={characters.join("")}
    >
      {characters.map((character, index) => {
        const variant = inkedVariants(project.glyphs[character])[0] ?? 0;
        const strokes = project.glyphs[character]?.variants?.[variant] ?? [];
        const xs = strokes.flatMap(stroke =>
          stroke.points.map(point => point.x)
        );
        const pad = 18;
        const left = Math.max(0, Math.min(...xs) - pad);
        const right = Math.min(DRAWING_SIZE, Math.max(...xs) + pad);
        return (
          <svg
            key={`${character}-${index}`}
            viewBox={`${left} ${top} ${Math.max(40, right - left)} ${bottom - top}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            {strokes.map((stroke, strokeIndex) => (
              <InkStroke key={strokeIndex} stroke={stroke} />
            ))}
          </svg>
        );
      })}
    </span>
  );
}
