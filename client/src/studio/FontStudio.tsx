import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Check,
  ChevronLeft,
  CircleHelp,
  Copy,
  Download,
  Eraser,
  Eye,
  Feather,
  FilePenLine,
  Minus,
  PenLine,
  Plus,
  Redo2,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Undo2,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import type { FontProject, FontSettings, Glyph, Point, Stroke } from "./types";
import { buildFont, getFontFamily, loadFont } from "./font-engine";
import { Modal } from "./components";
import { useStudio } from "./store";
import {
  fontCharacterGroups,
  fontTexts as t,
  type FontGroupId,
} from "./locales/fonts";
import "./FontStudio.css";

const MAX_VARIANTS = 3;
const DRAWING_SIZE = 400;

type Tool = "pen" | "eraser";
type StrokeHistory = Stroke[][];

function cloneStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.map(stroke => ({
    width: stroke.width,
    points: stroke.points.map(point => ({ ...point })),
  }));
}

function containsInk(strokes: Stroke[] | undefined) {
  return Boolean(strokes?.some(stroke => stroke.points.length > 0));
}

function getVariants(glyph: Glyph | undefined) {
  return glyph?.variants?.length ? glyph.variants : [[]];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pathData(stroke: Stroke) {
  return stroke.points
    .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");
}

function projectCharacterCount(project: FontProject) {
  return Object.values(project.glyphs).filter(glyph =>
    glyph.variants.some(containsInk)
  ).length;
}

function currentVariantStrokes(
  project: FontProject,
  character: string,
  variantIndex: number
) {
  const variants = getVariants(project.glyphs[character]);
  return variants[variantIndex] ?? variants[0] ?? [];
}

function missingPreviewCharacters(
  project: FontProject,
  text: string,
  variantIndex: number
) {
  return [
    ...new Set(
      [...text].filter(
        character =>
          !/\s/.test(character) &&
          !containsInk(currentVariantStrokes(project, character, variantIndex))
      )
    ),
  ];
}

function safeFileName(value: string) {
  return (
    (value.trim() || "meine-handschrift")
      .replace(/[^a-z0-9äöüß]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "meine-handschrift"
  );
}

function previewVariantFor(
  project: FontProject,
  character: string,
  index: number,
  baseVariant: number
) {
  const variants = getVariants(project.glyphs[character]);
  const available = variants
    .map((strokes, variant) => (containsInk(strokes) ? variant : -1))
    .filter(variant => variant >= 0);
  if (!available.length) return baseVariant;
  const preferred = available.includes(baseVariant)
    ? baseVariant
    : available[0];
  if (project.settings.variation <= 0 || available.length < 2) return preferred;
  const seed = [...character].reduce(
    (total, letter) => total + (letter.codePointAt(0) ?? 0),
    index * 37 + 17
  );
  if (seed % 100 >= project.settings.variation) return preferred;
  const alternatives = available.filter(variant => variant !== preferred);
  return alternatives[seed % alternatives.length] ?? preferred;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(timestamp);
}

function FontSample({
  project,
  variantIndex = 0,
  className = "",
}: {
  project: FontProject;
  variantIndex?: number;
  className?: string;
}) {
  const [family, setFamily] = useState(() =>
    getFontFamily(project.id, variantIndex)
  );
  useEffect(() => {
    let active = true;
    void loadFont(project, variantIndex)
      .then(loadedFamily => {
        if (active) setFamily(loadedFamily);
      })
      .catch(() => {
        if (active) setFamily(getFontFamily(project.id, variantIndex));
      });
    return () => {
      active = false;
    };
  }, [project, variantIndex]);
  return (
    <span
      className={`font-sample ${className}`}
      style={{ fontFamily: `"${family}", Caveat, cursive` }}
    >
      Abc
    </span>
  );
}

function RangeSetting({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="font-range">
      <span>
        {label}
        <output>
          {value}
          {suffix}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function FontWorkspace({ initialProject }: { initialProject: FontProject }) {
  const { updateFont } = useStudio();
  const [, navigate] = useLocation();
  const projectRef = useRef<FontProject>(initialProject);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const activePointer = useRef<number | null>(null);
  const strokesRef = useRef<Stroke[]>(
    cloneStrokes(currentVariantStrokes(initialProject, "A", 0))
  );
  const [project, setProject] = useState(initialProject);
  const [groupId, setGroupId] = useState<FontGroupId>("upper");
  const [activeCharacter, setActiveCharacter] = useState("A");
  const [activeVariant, setActiveVariant] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>(() =>
    cloneStrokes(strokesRef.current)
  );
  const [undoStack, setUndoStack] = useState<StrokeHistory>([]);
  const [redoStack, setRedoStack] = useState<StrokeHistory>([]);
  const [tool, setTool] = useState<Tool>("pen");
  const [penWidth, setPenWidth] = useState(8);
  const [showGuides, setShowGuides] = useState(true);
  const [clearOpen, setClearOpen] = useState(false);
  const [previewText, setPreviewText] = useState<string>(t.previewDefault);
  const [previewFamilies, setPreviewFamilies] = useState<string[]>(() =>
    Array.from({ length: MAX_VARIANTS }, (_, index) =>
      getFontFamily(initialProject.id, index)
    )
  );
  const [fontName, setFontName] = useState(initialProject.name);

  const replaceStrokes = useCallback((next: Stroke[]) => {
    const copy = cloneStrokes(next);
    strokesRef.current = copy;
    setStrokes(copy);
  }, []);

  const commitProject = useCallback(
    (transform: (current: FontProject) => FontProject) => {
      const next = transform(projectRef.current);
      projectRef.current = next;
      setProject(next);
      updateFont(next);
      return next;
    },
    [updateFont]
  );

  const persistStrokes = useCallback(
    (
      nextStrokes: Stroke[],
      character = activeCharacter,
      variant = activeVariant
    ) => {
      return commitProject(current => {
        const glyphs = { ...current.glyphs };
        const variants = getVariants(glyphs[character]).map(cloneStrokes);
        while (variants.length <= variant) variants.push([]);
        variants[variant] = cloneStrokes(nextStrokes);
        if (variants.some(containsInk)) glyphs[character] = { variants };
        else delete glyphs[character];
        return { ...current, glyphs, updatedAt: Date.now() };
      });
    },
    [activeCharacter, activeVariant, commitProject]
  );

  const loadCharacter = useCallback(
    (character: string, variant: number) => {
      const stored = currentVariantStrokes(
        projectRef.current,
        character,
        variant
      );
      replaceStrokes(stored);
      setUndoStack([]);
      setRedoStack([]);
    },
    [replaceStrokes]
  );

  useEffect(() => {
    const variants = getVariants(projectRef.current.glyphs[activeCharacter]);
    const safeVariant = Math.min(activeVariant, variants.length - 1);
    if (safeVariant !== activeVariant) {
      setActiveVariant(safeVariant);
      return;
    }
    loadCharacter(activeCharacter, safeVariant);
  }, [activeCharacter, activeVariant, loadCharacter]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void Promise.all(
        Array.from({ length: MAX_VARIANTS }, (_, index) =>
          loadFont(project, index)
        )
      )
        .then(families => {
          if (active) setPreviewFamilies(families);
        })
        .catch(() => {
          if (active)
            setPreviewFamilies(
              Array.from({ length: MAX_VARIANTS }, (_, index) =>
                getFontFamily(project.id, index)
              )
            );
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [project, activeVariant]);

  const currentVariants = getVariants(project.glyphs[activeCharacter]);
  const group =
    fontCharacterGroups.find(item => item.id === groupId) ??
    fontCharacterGroups[0];
  const allCharacters = fontCharacterGroups.flatMap(item => item.characters);
  const finished = projectCharacterCount(project);
  const overallProgress = allCharacters.length
    ? Math.round((finished / allCharacters.length) * 100)
    : 0;
  const selectedStatus = containsInk(
    currentVariantStrokes(project, activeCharacter, activeVariant)
  )
    ? t.statusComplete
    : containsInk(strokes)
      ? t.statusInProgress
      : t.statusNotStarted;
  const previewMissing = useMemo(
    () => missingPreviewCharacters(project, previewText, activeVariant),
    [project, previewText, activeVariant]
  );

  function rememberCurrent() {
    const snapshot = cloneStrokes(strokesRef.current);
    setUndoStack(history => [...history.slice(-59), snapshot]);
    setRedoStack([]);
  }

  function localPoint(
    event: ReactPointerEvent<SVGSVGElement>
  ): Point | undefined {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds || !bounds.width || !bounds.height) return undefined;
    return {
      x: clamp(
        ((event.clientX - bounds.left) / bounds.width) * DRAWING_SIZE,
        0,
        DRAWING_SIZE
      ),
      y: clamp(
        ((event.clientY - bounds.top) / bounds.height) * DRAWING_SIZE,
        0,
        DRAWING_SIZE
      ),
      pressure: event.pressure > 0 ? event.pressure : undefined,
    };
  }

  function eraseAt(point: Point) {
    const radius = Math.max(14, penWidth * 1.75);
    const next = strokesRef.current.filter(
      stroke =>
        !stroke.points.some(
          candidate =>
            Math.hypot(candidate.x - point.x, candidate.y - point.y) <=
            radius + stroke.width / 2
        )
    );
    if (next.length === strokesRef.current.length) return;
    replaceStrokes(next);
    persistStrokes(next);
  }

  function beginDrawing(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const point = localPoint(event);
    if (!point) return;
    event.preventDefault();
    rememberCurrent();
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "eraser") {
      eraseAt(point);
      return;
    }
    replaceStrokes([
      ...strokesRef.current,
      {
        width: Math.max(
          1,
          penWidth * (point.pressure ? 0.55 + point.pressure * 0.45 : 1)
        ),
        points: [point],
      },
    ]);
  }

  function moveDrawing(event: ReactPointerEvent<SVGSVGElement>) {
    if (activePointer.current !== event.pointerId) return;
    const point = localPoint(event);
    if (!point) return;
    event.preventDefault();
    if (tool === "eraser") {
      eraseAt(point);
      return;
    }
    const next = cloneStrokes(strokesRef.current);
    const activeStroke = next[next.length - 1];
    if (!activeStroke) return;
    const previous = activeStroke.points[activeStroke.points.length - 1];
    if (
      previous &&
      Math.hypot(previous.x - point.x, previous.y - point.y) < 0.5
    )
      return;
    activeStroke.points.push(point);
    replaceStrokes(next);
  }

  function endDrawing(event: ReactPointerEvent<SVGSVGElement>) {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    persistStrokes(strokesRef.current);
  }

  function switchCharacter(character: string) {
    if (character === activeCharacter) return;
    persistStrokes(strokesRef.current);
    setActiveCharacter(character);
    setActiveVariant(0);
  }

  function undo() {
    if (!undoStack.length) {
      toast.message(t.noUndo);
      return;
    }
    const next = cloneStrokes(undoStack[undoStack.length - 1]);
    const currentSnapshot = cloneStrokes(strokesRef.current);
    setUndoStack(history => history.slice(0, -1));
    setRedoStack(history => [...history, currentSnapshot]);
    replaceStrokes(next);
    persistStrokes(next);
  }

  function redo() {
    if (!redoStack.length) {
      toast.message(t.noRedo);
      return;
    }
    const next = cloneStrokes(redoStack[redoStack.length - 1]);
    const currentSnapshot = cloneStrokes(strokesRef.current);
    setRedoStack(history => history.slice(0, -1));
    setUndoStack(history => [...history, currentSnapshot]);
    replaceStrokes(next);
    persistStrokes(next);
  }

  function saveCharacter() {
    persistStrokes(strokesRef.current);
    toast.success(t.characterSaved);
  }

  function clearCharacter() {
    rememberCurrent();
    replaceStrokes([]);
    persistStrokes([]);
    setClearOpen(false);
    toast.success(t.clearSaved);
  }

  function addVariant() {
    if (currentVariants.length >= MAX_VARIANTS) {
      toast.message(t.variantLimit);
      return;
    }
    persistStrokes(strokesRef.current);
    const nextIndex = currentVariants.length;
    commitProject(current => {
      const glyphs = { ...current.glyphs };
      const variants = getVariants(glyphs[activeCharacter]).map(cloneStrokes);
      variants.push([]);
      glyphs[activeCharacter] = { variants };
      return { ...current, glyphs, updatedAt: Date.now() };
    });
    setActiveVariant(nextIndex);
  }

  function removeVariant() {
    if (currentVariants.length <= 1) {
      toast.message(t.firstVariant);
      return;
    }
    persistStrokes(strokesRef.current);
    const nextIndex = Math.max(0, activeVariant - 1);
    commitProject(current => {
      const glyphs = { ...current.glyphs };
      const variants = getVariants(glyphs[activeCharacter]).map(cloneStrokes);
      variants.splice(activeVariant, 1);
      if (variants.some(containsInk)) glyphs[activeCharacter] = { variants };
      else delete glyphs[activeCharacter];
      return { ...current, glyphs, updatedAt: Date.now() };
    });
    setActiveVariant(nextIndex);
  }

  function changeSetting(key: keyof FontSettings, value: number) {
    commitProject(current => ({
      ...current,
      settings: { ...current.settings, [key]: value },
      updatedAt: Date.now(),
    }));
  }

  function saveName() {
    const nextName = fontName.trim().slice(0, 80);
    if (!nextName) {
      setFontName(project.name);
      toast.error(t.nameRequired);
      return;
    }
    if (nextName !== project.name) {
      commitProject(current => ({
        ...current,
        name: nextName,
        updatedAt: Date.now(),
      }));
      toast.success(t.renamed);
    }
  }

  function downloadFont() {
    if (!finished) {
      toast.error(t.exportEmpty);
      return;
    }
    try {
      const file = buildFont(project).toArrayBuffer();
      const blob = new Blob([file], { type: "font/otf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeFileName(project.name)}.otf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t.exportReady);
    } catch (error) {
      console.error(error);
      toast.error(t.exportError);
    }
  }

  return (
    <main className="font-studio page-shell">
      <header className="font-studio-header">
        <button
          className="font-back"
          type="button"
          onClick={() => navigate("/schriften")}
        >
          <ChevronLeft size={17} />
          {t.backToFonts}
        </button>
        <div className="font-title-wrap">
          <p className="eyebrow">{t.studioEyebrow}</p>
          <h1>{t.studioTitle}</h1>
          <p>{t.studioDescription}</p>
        </div>
        <div className="font-header-actions">
          <label className="font-name-field">
            <span>{t.nameLabel}</span>
            <input
              value={fontName}
              maxLength={80}
              onChange={event => {
                const value = event.target.value;
                setFontName(value);
                if (value.trim())
                  commitProject(current => ({
                    ...current,
                    name: value.slice(0, 80),
                    updatedAt: Date.now(),
                  }));
              }}
              onBlur={saveName}
              aria-label={t.nameLabel}
            />
          </label>
          <button className="btn primary" type="button" onClick={downloadFont}>
            <Download size={16} />
            {t.export}
          </button>
        </div>
      </header>

      <section className="font-overview card" aria-label={t.progress}>
        <div className="font-progress-label">
          <span>{t.progress}</span>
          <strong>
            {finished} / {allCharacters.length} {t.completed}
          </strong>
        </div>
        <div className="font-progress-track" aria-hidden="true">
          <span style={{ width: `${overallProgress}%` }} />
        </div>
        <span className="font-progress-number">{overallProgress}%</span>
      </section>

      <div className="font-studio-layout">
        <aside className="font-characters card">
          <div className="font-side-heading">
            <div>
              <p className="eyebrow">{t.characterGroups}</p>
              <h2>{group.label}</h2>
            </div>
            <FilePenLine size={19} />
          </div>
          <div
            className="font-group-tabs"
            role="tablist"
            aria-label={t.characterGroups}
          >
            {fontCharacterGroups.map(item => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={groupId === item.id}
                className={groupId === item.id ? "active" : ""}
                onClick={() => {
                  setGroupId(item.id);
                  switchCharacter(item.characters[0]);
                }}
              >
                {item.label}
                <span>
                  {
                    item.characters.filter(character =>
                      containsInk(currentVariantStrokes(project, character, 0))
                    ).length
                  }
                  /{item.characters.length}
                </span>
              </button>
            ))}
          </div>
          <div className="character-grid" aria-label={group.label}>
            {group.characters.map(character => {
              const drawn = containsInk(
                currentVariantStrokes(project, character, 0)
              );
              const inProgress =
                character === activeCharacter && containsInk(strokes) && !drawn;
              const label = inProgress
                ? t.statusInProgress
                : drawn
                  ? t.statusComplete
                  : t.statusNotStarted;
              return (
                <button
                  key={character}
                  type="button"
                  className={`character-cell ${character === activeCharacter ? "selected" : ""} ${drawn ? "complete" : ""} ${inProgress ? "in-progress" : ""}`}
                  onClick={() => switchCharacter(character)}
                  aria-label={`${character}: ${label}`}
                >
                  <span>{character}</span>
                  {drawn && <Check size={12} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </aside>

        <section
          className="font-drawing-card card"
          aria-label={`${t.drawingArea} ${activeCharacter}`}
        >
          <div className="font-drawing-heading">
            <div>
              <p className="eyebrow">{t.selectedCharacter}</p>
              <h2>
                <span>{activeCharacter}</span>
                <small>{selectedStatus}</small>
              </h2>
            </div>
            <div className="font-variant-controls" aria-label={t.variants}>
              {currentVariants.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={index === activeVariant ? "active" : ""}
                  onClick={() => {
                    persistStrokes(strokesRef.current);
                    setActiveVariant(index);
                  }}
                  aria-label={`${t.variant} ${index + 1}`}
                >
                  {index + 1}
                </button>
              ))}
              <button
                className="icon-btn"
                type="button"
                onClick={addVariant}
                aria-label={t.addVariant}
              >
                <Plus size={15} />
              </button>
              <button
                className="icon-btn"
                type="button"
                onClick={removeVariant}
                aria-label={t.removeVariant}
              >
                <Minus size={15} />
              </button>
            </div>
          </div>

          <div className="font-canvas-wrap">
            <svg
              ref={svgRef}
              className={`font-canvas ${tool === "eraser" ? "erasing" : ""}`}
              viewBox={`0 0 ${DRAWING_SIZE} ${DRAWING_SIZE}`}
              role="img"
              aria-label={`${t.drawingArea} ${activeCharacter}`}
              onPointerDown={beginDrawing}
              onPointerMove={moveDrawing}
              onPointerUp={endDrawing}
              onPointerCancel={endDrawing}
            >
              {showGuides && (
                <g className="font-guides" aria-hidden="true">
                  <line
                    x1="0"
                    x2={DRAWING_SIZE}
                    y1={project.settings.baseline}
                    y2={project.settings.baseline}
                    className="baseline"
                  />
                  <line
                    x1="0"
                    x2={DRAWING_SIZE}
                    y1={Math.max(20, project.settings.baseline - 165)}
                    y2={Math.max(20, project.settings.baseline - 165)}
                  />
                  <line x1="200" x2="200" y1="0" y2={DRAWING_SIZE} />
                  <line x1="0" x2={DRAWING_SIZE} y1="45" y2="45" />
                </g>
              )}
              {strokes.map((stroke, index) =>
                stroke.points.length === 1 ? (
                  <circle
                    key={index}
                    cx={stroke.points[0].x}
                    cy={stroke.points[0].y}
                    r={stroke.width / 2}
                    className="font-stroke"
                  />
                ) : (
                  <path
                    key={index}
                    d={pathData(stroke)}
                    className="font-stroke"
                    strokeWidth={stroke.width}
                  />
                )
              )}
            </svg>
            {!containsInk(strokes) && (
              <p className="font-empty-drawing">
                <PenLine size={18} />
                {t.emptyDrawing}
              </p>
            )}
          </div>

          <div className="font-tool-row">
            <div
              className="font-tool-toggle"
              role="group"
              aria-label={t.penWidth}
            >
              <button
                type="button"
                className={tool === "pen" ? "active" : ""}
                onClick={() => setTool("pen")}
              >
                <PenLine size={16} />
                {t.pen}
              </button>
              <button
                type="button"
                className={tool === "eraser" ? "active" : ""}
                onClick={() => setTool("eraser")}
              >
                <Eraser size={16} />
                {t.eraser}
              </button>
            </div>
            <label className="font-width-control">
              <span>{t.penWidth}</span>
              <input
                type="range"
                min="2"
                max="28"
                value={penWidth}
                onChange={event => setPenWidth(Number(event.target.value))}
              />
              <output>{penWidth}</output>
            </label>
            <div className="font-tool-actions">
              <button
                className="icon-btn"
                type="button"
                onClick={undo}
                aria-label={t.undo}
              >
                <Undo2 size={17} />
              </button>
              <button
                className="icon-btn"
                type="button"
                onClick={redo}
                aria-label={t.redo}
              >
                <Redo2 size={17} />
              </button>
              <button
                className={`icon-btn ${showGuides ? "active" : ""}`}
                type="button"
                onClick={() => setShowGuides(value => !value)}
                aria-label={showGuides ? t.hideGuides : t.showGuides}
              >
                <Eye size={17} />
              </button>
              <button
                className="icon-btn danger"
                type="button"
                onClick={() => setClearOpen(true)}
                aria-label={t.clear}
              >
                <Trash2 size={17} />
              </button>
            </div>
            <button
              className="btn primary small"
              type="button"
              onClick={saveCharacter}
            >
              <Check size={15} />
              {t.saveCharacter}
            </button>
          </div>
          {tool === "eraser" && (
            <p className="font-inline-hint">
              <Eraser size={14} />
              {t.eraserHint}
            </p>
          )}
          <p className="font-variant-note">
            <CircleHelp size={14} />
            {t.variantDescription}
          </p>
        </section>

        <aside className="font-settings card">
          <div className="font-side-heading">
            <div>
              <p className="eyebrow">{t.settings}</p>
              <h2>
                <SlidersHorizontal size={17} />
                {project.name}
              </h2>
            </div>
          </div>
          <RangeSetting
            label={t.size}
            value={project.settings.size}
            min={30}
            max={200}
            suffix="%"
            onChange={value => changeSetting("size", value)}
          />
          <RangeSetting
            label={t.baseline}
            value={project.settings.baseline}
            min={200}
            max={360}
            onChange={value => changeSetting("baseline", value)}
          />
          <RangeSetting
            label={t.spacing}
            value={project.settings.spacing}
            min={-200}
            max={500}
            onChange={value => changeSetting("spacing", value)}
          />
          <RangeSetting
            label={t.wordSpacing}
            value={project.settings.wordSpacing}
            min={0}
            max={1000}
            onChange={value => changeSetting("wordSpacing", value)}
          />
          <RangeSetting
            label={t.width}
            value={project.settings.width}
            min={30}
            max={200}
            suffix="%"
            onChange={value => changeSetting("width", value)}
          />
          <RangeSetting
            label={t.slant}
            value={project.settings.slant}
            min={-45}
            max={45}
            suffix="°"
            onChange={value => changeSetting("slant", value)}
          />
          <RangeSetting
            label={t.smoothness}
            value={project.settings.smoothness}
            min={0}
            max={100}
            suffix="%"
            onChange={value => changeSetting("smoothness", value)}
          />
          <RangeSetting
            label={t.variation}
            value={project.settings.variation}
            min={0}
            max={100}
            suffix="%"
            onChange={value => changeSetting("variation", value)}
          />
          <p className="font-setting-note">
            <RotateCcw size={14} />
            {t.variationDescription}
          </p>
        </aside>
      </div>

      <section className="font-preview card">
        <div className="font-preview-heading">
          <div>
            <p className="eyebrow">{t.preview}</p>
            <h2>{t.preview}</h2>
          </div>
          <span className="tag">
            <Feather size={14} />
            {t.selectedVariant} {activeVariant + 1}
          </span>
        </div>
        <label className="font-preview-input">
          <span>{t.previewText}</span>
          <textarea
            aria-label={t.previewText}
            value={previewText}
            rows={3}
            onChange={event => setPreviewText(event.target.value.slice(0, 700))}
          />
        </label>
        <p className="font-preview-text">
          {[...previewText].map((character, index) => {
            const variant = previewVariantFor(
              project,
              character,
              index,
              activeVariant
            );
            const family = previewFamilies[variant] ?? previewFamilies[0];
            return (
              <span
                className="font-preview-letter"
                key={`${index}-${character}`}
                style={{ fontFamily: `"${family}", Caveat, cursive` }}
              >
                {character}
              </span>
            );
          })}
        </p>
        <div
          className={`font-missing ${previewMissing.length ? "warning" : "ok"}`}
        >
          {previewMissing.length ? (
            <>
              <CircleHelp size={16} />
              <div>
                <strong>
                  {t.missingCharacters}: {previewMissing.join(" ")}
                </strong>
                <span>{t.previewFallback}</span>
              </div>
            </>
          ) : (
            <>
              <Check size={16} />
              <span>{t.noMissingCharacters}</span>
            </>
          )}
        </div>
      </section>

      <section className="font-export-note card">
        <Download size={18} />
        <div>
          <strong>{t.export}</strong>
          <p>{t.exportDescription}</p>
          <small>{t.installHint}</small>
        </div>
        <button
          className="btn secondary small"
          type="button"
          onClick={downloadFont}
        >
          {t.export}
        </button>
      </section>

      <Modal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title={t.clearTitle}
      >
        <p className="font-modal-copy">{t.clearDescription}</p>
        <div className="font-modal-actions">
          <button
            className="btn secondary"
            type="button"
            onClick={() => setClearOpen(false)}
          >
            {t.cancel}
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={clearCharacter}
          >
            {t.confirmClear}
          </button>
        </div>
      </Modal>
    </main>
  );
}

export default function FontStudio({ projectId }: { projectId?: string }) {
  const { data, createFont } = useStudio();
  const [, navigate] = useLocation();
  const creating = useRef(false);
  const project = projectId
    ? data.fonts.find(font => font.id === projectId)
    : undefined;

  useEffect(() => {
    if (projectId || creating.current) return;
    creating.current = true;
    const created = createFont();
    navigate(`/schriften/${created.id}`);
  }, [createFont, navigate, projectId]);

  if (!projectId)
    return (
      <main className="font-route-state page-shell">
        <p className="eyebrow">{t.studioEyebrow}</p>
        <h1>{t.loadingNew}</h1>
      </main>
    );
  if (!project)
    return (
      <main className="font-route-state page-shell">
        <p className="eyebrow">{t.studioEyebrow}</p>
        <h1>{t.missingProjectTitle}</h1>
        <p>{t.missingProjectDescription}</p>
        <button
          className="btn primary"
          type="button"
          onClick={() => navigate("/schriften")}
        >
          {t.backToFonts}
        </button>
      </main>
    );
  return <FontWorkspace key={project.id} initialProject={project} />;
}

export function FontsPage() {
  const { data, createFont, updateFont, deleteFont } = useStudio();
  const [, navigate] = useLocation();
  const [renaming, setRenaming] = useState<FontProject | null>(null);
  const [deleting, setDeleting] = useState<FontProject | null>(null);
  const [name, setName] = useState("");

  function create() {
    const project = createFont();
    navigate(`/schriften/${project.id}`);
  }

  function duplicate(font: FontProject) {
    const duplicateId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${font.id}-${Date.now()}`;
    const copy: FontProject = {
      ...structuredClone(font),
      id: duplicateId,
      name: `${font.name} – Kopie`.slice(0, 80),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    updateFont(copy);
    toast.success(t.duplicated);
    navigate(`/schriften/${copy.id}`);
  }

  function startRename(font: FontProject) {
    setRenaming(font);
    setName(font.name);
  }

  function saveRename() {
    if (!renaming) return;
    const nextName = name.trim().slice(0, 80);
    if (!nextName) {
      toast.error(t.nameRequired);
      return;
    }
    updateFont({ ...renaming, name: nextName, updatedAt: Date.now() });
    setRenaming(null);
    toast.success(t.renamed);
  }

  function confirmDelete() {
    if (!deleting) return;
    deleteFont(deleting.id);
    setDeleting(null);
    toast.success(t.deleted);
  }

  return (
    <main className="fonts-page page-shell">
      <header className="fonts-page-heading">
        <div>
          <p className="eyebrow">{t.galleryEyebrow}</p>
          <h1>{t.galleryTitle}</h1>
          <p>{t.galleryDescription}</p>
        </div>
        <button className="btn primary" type="button" onClick={create}>
          <Plus size={17} />
          {t.create}
        </button>
      </header>
      {!data.fonts.length ? (
        <section className="font-gallery-empty empty-state">
          <div className="empty-icon">
            <Feather size={25} />
          </div>
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyDescription}</p>
          <button className="btn primary" type="button" onClick={create}>
            <Plus size={16} />
            {t.createFirst}
          </button>
        </section>
      ) : (
        <section className="font-gallery" aria-label={t.galleryTitle}>
          {data.fonts.map(font => (
            <article className="font-gallery-card card" key={font.id}>
              <div className="font-gallery-paper">
                <FontSample project={font} />
                <span>
                  {projectCharacterCount(font)} {t.completed}
                </span>
              </div>
              <div className="font-gallery-info">
                <div>
                  <h2>{font.name}</h2>
                  <p>{formatDate(font.updatedAt)}</p>
                </div>
                <div className="font-card-actions">
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => navigate(`/schriften/${font.id}`)}
                    aria-label={t.editAria}
                  >
                    <FilePenLine size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => startRename(font)}
                    aria-label={t.rename}
                  >
                    <PenLine size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => duplicate(font)}
                    aria-label={t.duplicateAria}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon-btn danger"
                    type="button"
                    onClick={() => setDeleting(font)}
                    aria-label={t.deleteAria}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <button
                className="btn secondary small font-open-button"
                type="button"
                onClick={() => navigate(`/schriften/${font.id}`)}
              >
                {t.open}
              </button>
            </article>
          ))}
        </section>
      )}

      <Modal
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title={t.rename}
      >
        <label className="font-modal-field">
          <span>{t.nameLabel}</span>
          <input
            autoFocus
            value={name}
            maxLength={80}
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") saveRename();
            }}
          />
          <small>{t.nameHint}</small>
        </label>
        <div className="font-modal-actions">
          <button
            className="btn secondary"
            type="button"
            onClick={() => setRenaming(null)}
          >
            {t.cancel}
          </button>
          <button className="btn primary" type="button" onClick={saveRename}>
            {t.saved}
          </button>
        </div>
      </Modal>
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={t.removeTitle}
      >
        <p className="font-modal-copy">{t.removeDescription}</p>
        <div className="font-modal-actions">
          <button
            className="btn secondary"
            type="button"
            onClick={() => setDeleting(null)}
          >
            {t.cancel}
          </button>
          <button className="btn primary" type="button" onClick={confirmDelete}>
            {t.confirmRemove}
          </button>
        </div>
      </Modal>
    </main>
  );
}
