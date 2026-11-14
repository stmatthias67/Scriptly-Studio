import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Link, useLocation } from "wouter";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bold,
  ChevronDown,
  ChevronUp,
  Copy,
  FileImage,
  FilePlus2,
  Italic,
  Lock,
  LockOpen,
  Maximize2,
  Move,
  PanelRight,
  Plus,
  Redo2,
  RotateCw,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "./components";
import ExportDialog from "./ExportDialog";
import PaperPreview from "./PaperPreview";
import { PaperControls } from "./PaperControls";
import { NumberField } from "./components";
import {
  missingGlyphs,
  pagePixelDimensions,
  splitTextForHeight,
} from "./render";
import { useStudio } from "./store";
import {
  createPage,
  paperDimensions,
  uid,
  type PageElement,
  type StudioDocument,
  type StudioPage,
} from "./types";
import { loadFontVariants } from "./font-engine";
import {
  editorText as t,
  elementLabels,
  editorDefaults,
} from "./locales/editor";
import "./Editor.css";

type Gesture = {
  elementId: string;
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  recorded: boolean;
};

const clone = <T,>(value: T): T => structuredClone(value);
const limitHistory = <T,>(history: T[]) => history.slice(-60);

function numeric(
  value: string,
  fallback: number,
  min = -10_000,
  max = 10_000
): number {
  const candidate = Number(value);
  return Number.isFinite(candidate)
    ? Math.max(min, Math.min(max, candidate))
    : fallback;
}

function isTextInput(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
  );
}

export default function Editor({ documentId }: { documentId: string }) {
  const { data, settings, updateDocument, createDocument, saveStatus } =
    useStudio();
  const [, navigate] = useLocation();
  const document = data.documents.find(item => item.id === documentId);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null
  );
  const [showAllPages, setShowAllPages] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [undoHistory, setUndoHistory] = useState<StudioDocument[]>([]);
  const [redoHistory, setRedoHistory] = useState<StudioDocument[]>([]);
  const [titleDraft, setTitleDraft] = useState(document?.title ?? "");
  const [textDraft, setTextDraft] = useState("");
  const [, setFontRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void loadFontVariants(data.fonts)
      .then(() => window.document.fonts?.load('400 28px "Caveat"'))
      .catch(() => {})
      .then(() => {
        if (active) setFontRevision(v => v + 1);
      });
    return () => {
      active = false;
    };
  }, [data.fonts]);
  const stageRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef(document);
  const gestureRef = useRef<Gesture | null>(null);

  documentRef.current = document;
  const currentPage =
    document?.pages[
      Math.min(currentPageIndex, Math.max(0, (document?.pages.length ?? 1) - 1))
    ];
  const selectedElement =
    currentPage?.elements.find(element => element.id === selectedElementId) ??
    null;

  useEffect(() => {
    if (!document) return;
    setCurrentPageIndex(index => Math.min(index, document.pages.length - 1));
    setTitleDraft(document.title);
  }, [document?.id, document?.pages.length, document?.title]);

  useEffect(() => {
    setTextDraft(selectedElement?.type === "text" ? selectedElement.text : "");
  }, [selectedElement?.id, selectedElement?.text, selectedElement?.type]);

  const writeDocument = useCallback(
    (next: StudioDocument) => {
      const saved = { ...next, updatedAt: Date.now() };
      documentRef.current = saved;
      updateDocument(saved);
    },
    [updateDocument]
  );

  const saveSnapshot = useCallback(() => {
    const current = documentRef.current;
    if (!current) return;
    setUndoHistory(history => limitHistory([...history, clone(current)]));
    setRedoHistory([]);
  }, []);

  const mutateDocument = useCallback(
    (recipe: (draft: StudioDocument) => void, record = true) => {
      const current = documentRef.current;
      if (!current) return;
      if (record) saveSnapshot();
      const next = clone(current);
      recipe(next);
      writeDocument(next);
    },
    [saveSnapshot, writeDocument]
  );

  const updateElement = useCallback(
    (elementId: string, patch: Partial<PageElement>, record = true) => {
      mutateDocument(draft => {
        for (const page of draft.pages) {
          const target = page.elements.find(
            element => element.id === elementId
          );
          if (target) {
            Object.assign(target, patch);
            break;
          }
        }
      }, record);
    },
    [mutateDocument]
  );

  const undo = useCallback(() => {
    const current = documentRef.current;
    if (!current || !undoHistory.length) {
      toast.message(t.noUndo);
      return;
    }
    const snapshot = undoHistory[undoHistory.length - 1];
    setUndoHistory(history => history.slice(0, -1));
    setRedoHistory(history => limitHistory([...history, clone(current)]));
    writeDocument(snapshot);
  }, [undoHistory, writeDocument]);

  const redo = useCallback(() => {
    const current = documentRef.current;
    if (!current || !redoHistory.length) {
      toast.message(t.noRedo);
      return;
    }
    const snapshot = redoHistory[redoHistory.length - 1];
    setRedoHistory(history => history.slice(0, -1));
    setUndoHistory(history => limitHistory([...history, clone(current)]));
    writeDocument(snapshot);
  }, [redoHistory, writeDocument]);

  const selectPage = (index: number) => {
    setCurrentPageIndex(index);
    setSelectedElementId(null);
  };

  const addPage = (afterIndex = currentPageIndex) => {
    if (!documentRef.current) return;
    const paper =
      documentRef.current.pages[Math.max(0, afterIndex)]?.paper ??
      settings.defaultPaper;
    mutateDocument(draft =>
      draft.pages.splice(afterIndex + 1, 0, createPage(paper))
    );
    setCurrentPageIndex(afterIndex + 1);
    setSelectedElementId(null);
    toast.success(t.pageAdded);
  };

  const duplicatePage = (index: number) => {
    mutateDocument(draft => {
      const source = draft.pages[index];
      if (!source) return;
      const duplicated = clone(source);
      duplicated.id = uid();
      duplicated.elements = duplicated.elements.map(element => ({
        ...element,
        id: uid(),
      }));
      draft.pages.splice(index + 1, 0, duplicated);
    });
    setCurrentPageIndex(index + 1);
    setSelectedElementId(null);
    toast.success(t.pageDuplicated);
  };

  const deletePage = (index: number) => {
    if (!document || document.pages.length <= 1) {
      toast.error(t.onePageRequired);
      return;
    }
    if (!window.confirm(t.deletePageConfirm)) return;
    mutateDocument(draft => draft.pages.splice(index, 1));
    setCurrentPageIndex(Math.max(0, index - 1));
    setSelectedElementId(null);
    toast.success(t.pageDeleted);
  };

  const movePage = (index: number, direction: -1 | 1) => {
    mutateDocument(draft => {
      const target = index + direction;
      if (target < 0 || target >= draft.pages.length) return;
      [draft.pages[index], draft.pages[target]] = [
        draft.pages[target],
        draft.pages[index],
      ];
    });
    setCurrentPageIndex(index + direction);
  };

  const duplicateElement = () => {
    if (!currentPage || !selectedElement) return;
    const next = {
      ...clone(selectedElement),
      id: uid(),
      x: selectedElement.x + 18,
      y: selectedElement.y + 18,
    };
    mutateDocument(draft => draft.pages[currentPageIndex]?.elements.push(next));
    setSelectedElementId(next.id);
  };

  const deleteElement = () => {
    if (!selectedElement) return;
    mutateDocument(draft => {
      for (const page of draft.pages)
        page.elements = page.elements.filter(
          element => element.id !== selectedElement.id
        );
    });
    setSelectedElementId(null);
  };

  const applyText = () => {
    if (selectedElement?.type !== "text" || textDraft === selectedElement.text)
      return;
    updateElement(selectedElement.id, { text: textDraft });
  };

  const continueText = () => {
    if (!selectedElement || selectedElement.type !== "text" || !currentPage)
      return;
    const split = splitTextForHeight(selectedElement);
    if (!split.overflow) {
      toast.message(t.continuationFailed);
      return;
    }
    const continuation = {
      ...clone(selectedElement),
      id: uid(),
      text: split.overflow,
      x: selectedElement.x,
      y: 90,
      height: Math.max(
        selectedElement.height,
        pagePixelDimensions(currentPage.paper).height - 160
      ),
    };
    mutateDocument(draft => {
      const page = draft.pages[currentPageIndex];
      const element = page?.elements.find(
        item => item.id === selectedElement.id
      );
      if (element) element.text = split.visible;
      const nextPage = createPage(page?.paper ?? currentPage.paper);
      nextPage.elements.push(continuation);
      draft.pages.splice(currentPageIndex + 1, 0, nextPage);
    });
    setCurrentPageIndex(currentPageIndex + 1);
    setSelectedElementId(continuation.id);
  };

  const applyPaper = (paper: StudioPage["paper"]) => {
    if (!currentPage) return;
    mutateDocument(draft => {
      if (draft.pages[currentPageIndex])
        draft.pages[currentPageIndex].paper = paper;
    });
  };

  const applyTemplate = (templateId: string) => {
    const template = data.templates.find(item => item.id === templateId);
    if (!template || !currentPage) return;
    applyPaper(clone(template.paper));
    toast.success(t.templateApplied);
  };

  const updateGesture = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    const page = currentPage;
    const stage = stageRef.current;
    if (!gesture || !page || !stage) return;
    const rect = stage.getBoundingClientRect();
    const base = pagePixelDimensions(page.paper);
    const deltaX =
      ((event.clientX - gesture.startClientX) / rect.width) * base.width;
    const deltaY =
      ((event.clientY - gesture.startClientY) / rect.height) * base.height;
    if (!gesture.recorded && (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1)) {
      saveSnapshot();
      gesture.recorded = true;
    }
    if (!gesture.recorded) return;
    if (gesture.mode === "move")
      updateElement(
        gesture.elementId,
        {
          x: Math.max(-base.width * 0.3, gesture.startX + deltaX),
          y: Math.max(-base.height * 0.2, gesture.startY + deltaY),
        },
        false
      );
    else
      updateElement(
        gesture.elementId,
        {
          width: Math.max(20, gesture.startWidth + deltaX),
          height: Math.max(18, gesture.startHeight + deltaY),
        },
        false
      );
  };

  const startGesture = (
    event: PointerEvent<HTMLDivElement>,
    element: PageElement,
    mode: Gesture["mode"]
  ) => {
    event.stopPropagation();
    if (element.locked) {
      setSelectedElementId(element.id);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedElementId(element.id);
    gestureRef.current = {
      elementId: element.id,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: element.x,
      startY: element.y,
      startWidth: element.width,
      startHeight: element.height,
      recorded: false,
    };
  };

  const endGesture = () => {
    gestureRef.current = null;
  };

  const saveTitle = () => {
    if (
      !document ||
      !titleDraft.trim() ||
      titleDraft.trim() === document.title
    ) {
      setTitleDraft(document?.title ?? "");
      return;
    }
    mutateDocument(draft => {
      draft.title = titleDraft.trim().slice(0, 100);
    });
  };

  const onEditorKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!settings.shortcuts || isTextInput(event.target)) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (modifier && event.key.toLowerCase() === "d" && selectedElement) {
      event.preventDefault();
      duplicateElement();
      return;
    }
    if (
      (event.key === "Delete" || event.key === "Backspace") &&
      selectedElement
    ) {
      event.preventDefault();
      deleteElement();
    }
  };

  const activePageNumber = currentPageIndex + 1;
  const missing = useMemo(
    () =>
      selectedElement?.type === "text"
        ? missingGlyphs(
            selectedElement.text,
            selectedElement.fontId,
            data.fonts
          )
        : [],
    [data.fonts, selectedElement]
  );
  const overflow =
    selectedElement?.type === "text"
      ? splitTextForHeight(selectedElement).overflow
      : "";

  if (!document || !currentPage) {
    return (
      <div className="editor-empty">
        <EmptyState
          title={editorDefaults.notFound}
          description={editorDefaults.notFoundDescription}
          action={editorDefaults.backToDocuments}
          onAction={() => navigate("/dokumente")}
        />
        <button
          className="btn primary"
          onClick={() => {
            const next = createDocument();
            navigate(`/dokumente/${next.id}`);
          }}
        >
          <FilePlus2 size={16} />
          {t.addPage}
        </button>
      </div>
    );
  }

  const pageBase = pagePixelDimensions(currentPage.paper);
  const stageStyle = {
    "--page-ratio": `${paperDimensions(currentPage.paper).width} / ${paperDimensions(currentPage.paper).height}`,
  } as CSSProperties;

  return (
    <section
      className="studio-editor"
      tabIndex={0}
      onKeyDown={onEditorKeyDown}
      aria-label={editorDefaults.editorLabel}
    >
      <header className="editor-header">
        <Link className="editor-back" href="/dokumente">
          <ArrowLeft size={17} />
          {t.back}
        </Link>
        <label className="editor-title">
          <span className="sr-only">{t.changeTitle}</span>
          <input
            value={titleDraft}
            onFocus={saveSnapshot}
            onChange={event => {
              const value = event.target.value;
              setTitleDraft(value);
              if (value.trim())
                mutateDocument(draft => {
                  draft.title = value.slice(0, 100);
                }, false);
            }}
            onBlur={saveTitle}
            onKeyDown={event => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            maxLength={100}
            aria-label={t.changeTitle}
          />
        </label>
        <div className="editor-header-actions">
          <span className={`editor-save ${saveStatus}`}>{t.saveState}</span>
          <button
            className="btn secondary small"
            onClick={undo}
            disabled={!undoHistory.length}
            title={t.undo}
          >
            <Undo2 size={16} />
            {t.undo}
          </button>
          <button
            className="btn secondary small"
            onClick={redo}
            disabled={!redoHistory.length}
            title={t.redo}
          >
            <Redo2 size={16} />
            {t.redo}
          </button>
          <button
            className={`btn secondary small preview-toggle ${showAllPages ? "active" : ""}`}
            onClick={() => setShowAllPages(value => !value)}
          >
            <PanelRight size={16} />
            {showAllPages ? t.editPage : t.overview}
          </button>
          <button
            className="btn primary small"
            onClick={() => setExportOpen(true)}
          >
            <FileImage size={16} />
            {t.export}
          </button>
        </div>
      </header>

      <div className="editor-layout">
        <aside className="editor-pages" aria-label={t.pages}>
          <div className="editor-panel-heading">
            <div>
              <span className="eyebrow">{t.pages}</span>
              <strong>{document.pages.length}</strong>
            </div>
            <button
              className="icon-btn"
              title={t.addPage}
              aria-label={t.addPage}
              onClick={() => addPage()}
            >
              <Plus size={17} />
            </button>
          </div>
          <div className="page-list">
            {document.pages.map((page, index) => (
              <article
                key={page.id}
                className={`page-thumb ${index === currentPageIndex ? "active" : ""}`}
              >
                <button
                  className="page-thumb-main"
                  onClick={() => selectPage(index)}
                  aria-current={index === currentPageIndex ? "page" : undefined}
                >
                  <PaperPreview
                    page={page}
                    fonts={data.fonts}
                    pageNumber={index + 1}
                  />
                  <span>
                    {t.page} {index + 1}
                  </span>
                </button>
                <div className="page-actions">
                  <button
                    className="icon-btn"
                    onClick={() => movePage(index, -1)}
                    disabled={index === 0}
                    title={t.movePageUp}
                    aria-label={t.movePageUp}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => movePage(index, 1)}
                    disabled={index === document.pages.length - 1}
                    title={t.movePageDown}
                    aria-label={t.movePageDown}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => duplicatePage(index)}
                    title={t.duplicatePage}
                    aria-label={t.duplicatePage}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    className="icon-btn danger"
                    onClick={() => deletePage(index)}
                    title={t.deletePage}
                    aria-label={t.deletePage}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          <button
            className="btn secondary small page-add"
            onClick={() => addPage()}
          >
            <Plus size={16} />
            {t.addPage}
          </button>
        </aside>

        <main
          className={`editor-canvas-area ${showAllPages ? "overview" : ""}`}
        >
          {showAllPages ? (
            <div className="all-pages-preview">
              {document.pages.map((page, index) => (
                <button
                  className={`all-page-card ${index === currentPageIndex ? "active" : ""}`}
                  key={page.id}
                  onClick={() => {
                    selectPage(index);
                    setShowAllPages(false);
                  }}
                >
                  <PaperPreview
                    page={page}
                    fonts={data.fonts}
                    pageNumber={index + 1}
                  />
                  <span>
                    {t.page} {index + 1}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="page-workspace">
              <div
                className="page-stage"
                ref={stageRef}
                style={stageStyle}
                onPointerMove={updateGesture}
                onPointerUp={endGesture}
                onPointerCancel={endGesture}
                onPointerDown={() => setSelectedElementId(null)}
              >
                <PaperPreview
                  page={currentPage}
                  fonts={data.fonts}
                  pageNumber={activePageNumber}
                  className="editor-paper"
                />
                <div
                  className="element-overlay"
                  aria-label={`${t.page} ${activePageNumber}`}
                >
                  {currentPage.elements.map(element => (
                    <div
                      key={element.id}
                      className={`canvas-element ${selectedElementId === element.id ? "selected" : ""} type-${element.type} ${element.locked ? "locked" : ""}`}
                      style={{
                        left: `${(element.x / pageBase.width) * 100}%`,
                        top: `${(element.y / pageBase.height) * 100}%`,
                        width: `${(element.width / pageBase.width) * 100}%`,
                        height: `${(element.height / pageBase.height) * 100}%`,
                        transform: `rotate(${element.rotation}deg)`,
                      }}
                      onPointerDown={event =>
                        startGesture(event, element, "move")
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={event => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedElementId(element.id);
                        }
                      }}
                      aria-label={`${elementLabels[element.type]} ${t.selected}`}
                    >
                      <span className="canvas-element-label">
                        {element.locked ? (
                          <Lock size={11} />
                        ) : (
                          <Move size={11} />
                        )}
                        {element.type === "text"
                          ? element.text.slice(0, 34) || t.text
                          : elementLabels[element.type]}
                      </span>
                      {selectedElementId === element.id && !element.locked && (
                        <button
                          type="button"
                          className="resize-handle"
                          onPointerDown={event =>
                            startGesture(
                              event as unknown as PointerEvent<HTMLDivElement>,
                              element,
                              "resize"
                            )
                          }
                          aria-label={t.dimensions}
                        >
                          <Maximize2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <p className="page-caption">
                {t.page} {activePageNumber} ·{" "}
                {paperDimensions(currentPage.paper).width} ×{" "}
                {paperDimensions(currentPage.paper).height} mm
              </p>
            </div>
          )}
        </main>

        <aside
          className="editor-properties"
          aria-label={editorDefaults.properties}
        >
          <section className="properties-section">
            <div className="editor-panel-heading">
              <div>
                <span className="eyebrow">{t.elementSettings}</span>
                <strong>
                  {selectedElement ? elementLabels[selectedElement.type] : "—"}
                </strong>
              </div>
              {selectedElement && (
                <div className="properties-actions">
                  <button
                    className={`icon-btn ${selectedElement.locked ? "active" : ""}`}
                    onClick={() =>
                      updateElement(selectedElement.id, {
                        locked: !selectedElement.locked,
                      })
                    }
                    title={
                      selectedElement.locked ? t.unlockElement : t.lockElement
                    }
                    aria-label={
                      selectedElement.locked ? t.unlockElement : t.lockElement
                    }
                    aria-pressed={!!selectedElement.locked}
                  >
                    {selectedElement.locked ? (
                      <Lock size={16} />
                    ) : (
                      <LockOpen size={16} />
                    )}
                  </button>
                  <button
                    className="icon-btn"
                    onClick={duplicateElement}
                    title={t.duplicateElement}
                    aria-label={t.duplicateElement}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon-btn danger"
                    onClick={deleteElement}
                    title={t.deleteElement}
                    aria-label={t.deleteElement}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            {!selectedElement ? (
              <p className="properties-empty">{t.noElement}</p>
            ) : (
              <div className="element-form">
                {selectedElement.type === "text" && (
                  <>
                    <label className="field">
                      <span>{t.textContent}</span>
                      <textarea
                        aria-label={t.textContent}
                        value={textDraft}
                        onFocus={saveSnapshot}
                        onChange={event => {
                          setTextDraft(event.target.value);
                          updateElement(
                            selectedElement.id,
                            { text: event.target.value.slice(0, 100000) },
                            false
                          );
                        }}
                        onBlur={applyText}
                        rows={5}
                        maxLength={100000}
                      />
                    </label>
                    <button
                      className="btn secondary small text-apply"
                      onClick={applyText}
                    >
                      {t.applyText}
                    </button>
                    <label className="field">
                      <span>{t.font}</span>
                      <select
                        aria-label={t.font}
                        value={selectedElement.fontId}
                        onChange={event =>
                          updateElement(selectedElement.id, {
                            fontId: event.target.value,
                          })
                        }
                      >
                        <option value="caveat">{t.sampleHandwriting}</option>
                        <option value="manrope">{t.systemFont}</option>
                        {data.fonts.map(font => (
                          <option value={font.id} key={font.id}>
                            {font.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {missing.length > 0 && (
                      <p className="glyph-warning">
                        {t.missingGlyphs} <strong>{missing.join(" ")}</strong>
                      </p>
                    )}
                    {overflow && (
                      <div className="overflow-warning">
                        <p>{t.overflow}</p>
                        <button
                          className="btn secondary small"
                          onClick={continueText}
                        >
                          <FilePlus2 size={15} />
                          {t.continueOnNext}
                        </button>
                      </div>
                    )}
                  </>
                )}
                {selectedElement.type === "checkbox" && (
                  <label className="editor-check">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedElement.checked)}
                      onChange={event =>
                        updateElement(selectedElement.id, {
                          checked: event.target.checked,
                        })
                      }
                    />
                    {t.checked}
                  </label>
                )}
                <div className="format-grid">
                  <label className="field">
                    <span>{t.color}</span>
                    <input
                      type="color"
                      value={selectedElement.color}
                      onChange={event =>
                        updateElement(selectedElement.id, {
                          color: event.target.value,
                        })
                      }
                    />
                  </label>
                  {selectedElement.type === "text" && (
                    <>
                      <label className="field">
                        <span>{t.size}</span>
                        <NumberField
                          value={selectedElement.fontSize}
                          min={8}
                          max={180}
                          onChange={value =>
                            updateElement(selectedElement.id, {
                              fontSize: value,
                            })
                          }
                        />
                      </label>
                      <div className="format-toggles">
                        <button
                          className={`icon-btn ${selectedElement.bold ? "active" : ""}`}
                          onClick={() =>
                            updateElement(selectedElement.id, {
                              bold: !selectedElement.bold,
                            })
                          }
                          aria-label={t.bold}
                          title={t.bold}
                        >
                          <Bold size={16} />
                        </button>
                        <button
                          className={`icon-btn ${selectedElement.italic ? "active" : ""}`}
                          onClick={() =>
                            updateElement(selectedElement.id, {
                              italic: !selectedElement.italic,
                            })
                          }
                          aria-label={t.italic}
                          title={t.italic}
                        >
                          <Italic size={16} />
                        </button>
                      </div>
                      <div
                        className="align-controls"
                        role="group"
                        aria-label={t.alignment}
                      >
                        <button
                          className={`icon-btn ${selectedElement.align === "left" ? "active" : ""}`}
                          onClick={() =>
                            updateElement(selectedElement.id, { align: "left" })
                          }
                          aria-label={t.left}
                          title={t.left}
                        >
                          <AlignLeft size={16} />
                        </button>
                        <button
                          className={`icon-btn ${selectedElement.align === "center" ? "active" : ""}`}
                          onClick={() =>
                            updateElement(selectedElement.id, {
                              align: "center",
                            })
                          }
                          aria-label={t.center}
                          title={t.center}
                        >
                          <AlignCenter size={16} />
                        </button>
                        <button
                          className={`icon-btn ${selectedElement.align === "right" ? "active" : ""}`}
                          onClick={() =>
                            updateElement(selectedElement.id, {
                              align: "right",
                            })
                          }
                          aria-label={t.right}
                          title={t.right}
                        >
                          <AlignRight size={16} />
                        </button>
                      </div>
                      <label className="field">
                        <span>{t.lineHeight}</span>
                        <NumberField
                          value={selectedElement.lineHeight}
                          min={0.7}
                          max={3}
                          decimals={1}
                          onChange={value =>
                            updateElement(selectedElement.id, {
                              lineHeight: value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>{t.letterSpacing}</span>
                        <NumberField
                          value={selectedElement.letterSpacing}
                          min={-10}
                          max={50}
                          decimals={1}
                          onChange={value =>
                            updateElement(selectedElement.id, {
                              letterSpacing: value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>{t.wordSpacing}</span>
                        <NumberField
                          value={selectedElement.wordSpacing ?? 0}
                          min={-50}
                          max={200}
                          decimals={1}
                          onChange={value =>
                            updateElement(selectedElement.id, {
                              wordSpacing: value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>{t.widthScale}</span>
                        <NumberField
                          value={selectedElement.widthScale ?? 100}
                          min={30}
                          max={300}
                          onChange={value =>
                            updateElement(selectedElement.id, {
                              widthScale: value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>{t.slant}</span>
                        <NumberField
                          value={selectedElement.slant ?? 0}
                          min={-45}
                          max={45}
                          decimals={1}
                          onChange={value =>
                            updateElement(selectedElement.id, { slant: value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>{t.paragraphSpacing}</span>
                        <NumberField
                          value={selectedElement.paragraphSpacing}
                          min={0}
                          max={80}
                          onChange={value =>
                            updateElement(selectedElement.id, {
                              paragraphSpacing: value,
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
                <fieldset
                  className="geometry-grid"
                  disabled={!!selectedElement.locked}
                >
                  <span className="field-label">{t.position}</span>
                  <label className="field">
                    <span>{t.x}</span>
                    <NumberField
                      value={selectedElement.x}
                      min={-3000}
                      max={3000}
                      onChange={value =>
                        updateElement(selectedElement.id, { x: value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>{t.y}</span>
                    <NumberField
                      value={selectedElement.y}
                      min={-3000}
                      max={3000}
                      onChange={value =>
                        updateElement(selectedElement.id, { y: value })
                      }
                    />
                  </label>
                  <span className="field-label">{t.dimensions}</span>
                  <label className="field">
                    <span>{t.width}</span>
                    <NumberField
                      value={selectedElement.width}
                      min={20}
                      max={3000}
                      onChange={value =>
                        updateElement(selectedElement.id, { width: value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>{t.height}</span>
                    <NumberField
                      value={selectedElement.height}
                      min={18}
                      max={5000}
                      onChange={value =>
                        updateElement(selectedElement.id, { height: value })
                      }
                    />
                  </label>
                  <label className="field geometry-rotate">
                    <span>{t.rotation}</span>
                    <span className="input-with-icon">
                      <RotateCw size={14} />
                      <NumberField
                        value={selectedElement.rotation}
                        min={-180}
                        max={180}
                        onChange={value =>
                          updateElement(selectedElement.id, { rotation: value })
                        }
                      />
                      <em>°</em>
                    </span>
                  </label>
                </fieldset>
              </div>
            )}
          </section>
          <section className="properties-section paper-editor-section">
            <div className="editor-panel-heading">
              <div>
                <span className="eyebrow">{t.paper}</span>
                <strong>
                  {t.page} {activePageNumber}
                </strong>
              </div>
            </div>
            <PaperControls
              paper={currentPage.paper}
              onChange={applyPaper}
              compact
            />
          </section>
          {settings.shortcuts && (
            <p className="keyboard-hint">
              <Type size={14} />
              {t.keyboardHint}
            </p>
          )}
        </aside>
      </div>
      <ExportDialog
        document={document}
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        fonts={data.fonts}
        currentPageIndex={currentPageIndex}
      />
    </section>
  );
}
