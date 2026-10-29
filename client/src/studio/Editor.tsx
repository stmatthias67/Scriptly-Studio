import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
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
  ArrowRight,
  ArrowUp,
  Bold,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Copy,
  FileImage,
  FilePlus2,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  List,
  Maximize2,
  Minus,
  Move,
  PanelRight,
  Plus,
  Redo2,
  RotateCw,
  Rows3,
  Square,
  TextCursorInput,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "./components";
import ExportDialog from "./ExportDialog";
import PaperPreview from "./PaperPreview";
import { PaperControls } from "./PaperControls";
import {
  missingGlyphs,
  pagePixelDimensions,
  splitTextForHeight,
} from "./render";
import { useStudio } from "./store";
import {
  createPage,
  createText,
  paperDimensions,
  uid,
  type PageElement,
  type StudioDocument,
  type StudioPage,
} from "./types";
import { loadFonts } from "./font-engine";
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

function standardElement(
  type: PageElement["type"],
  settings: ReturnType<typeof useStudio>["settings"],
  x = 86,
  y = 96
): PageElement {
  const base: PageElement = {
    id: uid(),
    type,
    x,
    y,
    width: 230,
    height: 96,
    rotation: 0,
    text: "",
    fontId: settings.defaultFontId,
    fontSize: settings.defaultFontSize,
    color: settings.defaultColor,
    bold: false,
    italic: false,
    align: "left",
    lineHeight: settings.defaultLineHeight,
    letterSpacing: 0,
    paragraphSpacing: 0,
  };
  switch (type) {
    case "line":
      return { ...base, width: 230, height: 12 };
    case "arrow":
      return { ...base, width: 230, height: 36 };
    case "checkbox":
      return { ...base, width: 28, height: 28, checked: false };
    case "highlight":
      return { ...base, width: 240, height: 32, color: "#e8bd4b" };
    case "image":
      return { ...base, width: 240, height: 180 };
    default:
      return base;
  }
}

function textForTool(
  tool: "text" | "heading" | "subheading" | "list" | "checklist" | "date"
): string {
  if (tool === "heading") return editorDefaults.heading;
  if (tool === "subheading") return editorDefaults.subheading;
  if (tool === "list") return editorDefaults.list;
  if (tool === "checklist") return editorDefaults.checklist;
  if (tool === "date")
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(
      new Date()
    );
  return editorDefaults.text;
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
    void loadFonts(data.fonts)
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const addText = (
    tool: "text" | "heading" | "subheading" | "list" | "checklist" | "date"
  ) => {
    if (!currentPage) return;
    const element = createText(
      settings,
      80,
      90 + currentPage.elements.length * 18
    );
    element.text = textForTool(tool);
    if (tool === "heading") {
      element.fontSize = Math.max(32, settings.defaultFontSize * 1.65);
      element.bold = true;
      element.height = 80;
    }
    if (tool === "subheading") {
      element.fontSize = Math.max(23, settings.defaultFontSize * 1.18);
      element.height = 70;
    }
    if (tool === "list" || tool === "checklist") element.height = 150;
    if (tool === "date") {
      element.fontSize = Math.max(18, settings.defaultFontSize * 0.85);
      element.height = 45;
    }
    mutateDocument(draft =>
      draft.pages[currentPageIndex]?.elements.push(element)
    );
    setSelectedElementId(element.id);
  };

  const addGraphic = (type: Exclude<PageElement["type"], "text" | "image">) => {
    if (!currentPage) return;
    const element = standardElement(
      type,
      settings,
      90,
      110 + currentPage.elements.length * 14
    );
    mutateDocument(draft =>
      draft.pages[currentPageIndex]?.elements.push(element)
    );
    setSelectedElementId(element.id);
  };

  const selectImage = () => fileInputRef.current?.click();

  const importImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      toast.error(t.imageError);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast.error(t.imageReadError);
    reader.onload = () => {
      if (typeof reader.result !== "string" || !currentPage) return;
      const element = {
        ...standardElement("image", settings, 92, 112),
        src: reader.result,
      };
      mutateDocument(draft =>
        draft.pages[currentPageIndex]?.elements.push(element)
      );
      setSelectedElementId(element.id);
    };
    reader.readAsDataURL(file);
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
            className="btn primary small"
            onClick={() => setExportOpen(true)}
          >
            <FileImage size={16} />
            {t.export}
          </button>
        </div>
      </header>

      <div className="editor-toolbar" role="toolbar" aria-label={t.toolbar}>
        <div className="tool-group">
          <span>{t.text}</span>
          <button
            className="icon-btn"
            onClick={() => addText("text")}
            title={t.text}
            aria-label={t.text}
          >
            <TextCursorInput size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={() => addText("heading")}
            title={t.heading}
            aria-label={t.heading}
          >
            <Heading1 size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={() => addText("subheading")}
            title={t.subheading}
            aria-label={t.subheading}
          >
            <Heading2 size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={() => addText("list")}
            title={t.list}
            aria-label={t.list}
          >
            <List size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={() => addText("checklist")}
            title={t.checklist}
            aria-label={t.checklist}
          >
            <ClipboardCheck size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={() => addText("date")}
            title={t.date}
            aria-label={t.date}
          >
            <Rows3 size={17} />
          </button>
        </div>
        <div className="tool-group">
          <span>{t.addElement}</span>
          <button
            className="icon-btn"
            onClick={selectImage}
            title={t.image}
            aria-label={t.image}
          >
            <ImagePlus size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={() => addGraphic("rectangle")}
            title={t.rectangle}
            aria-label={t.rectangle}
          >
            <Square size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={() => addGraphic("ellipse")}
            title={t.ellipse}
            aria-label={t.ellipse}
          >
            <span className="ellipse-icon" />
          </button>
          <button
            className="icon-btn"
            onClick={() => addGraphic("line")}
            title={t.line}
            aria-label={t.line}
          >
            <Minus size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={() => addGraphic("arrow")}
            title={t.arrow}
            aria-label={t.arrow}
          >
            <ArrowRight size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={() => addGraphic("checkbox")}
            title={t.checkbox}
            aria-label={t.checkbox}
          >
            <ClipboardCheck size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={() => addGraphic("highlight")}
            title={t.highlight}
            aria-label={t.highlight}
          >
            <span className="highlight-icon" />
          </button>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={importImage}
          />
        </div>
        <button
          className={`btn secondary small preview-toggle ${showAllPages ? "active" : ""}`}
          onClick={() => setShowAllPages(value => !value)}
        >
          <PanelRight size={16} />
          {showAllPages ? t.editPage : t.overview}
        </button>
      </div>

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
                      className={`canvas-element ${selectedElementId === element.id ? "selected" : ""} type-${element.type}`}
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
                        <Move size={11} />
                        {element.type === "text"
                          ? element.text.slice(0, 34) || t.text
                          : elementLabels[element.type]}
                      </span>
                      {selectedElementId === element.id && (
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
                {selectedElement.type === "image" && (
                  <button className="btn secondary small" onClick={selectImage}>
                    <ImagePlus size={16} />
                    {t.image}
                  </button>
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
                        <input
                          type="number"
                          min="8"
                          max="180"
                          value={selectedElement.fontSize}
                          onChange={event =>
                            updateElement(selectedElement.id, {
                              fontSize: numeric(
                                event.target.value,
                                selectedElement.fontSize,
                                8,
                                180
                              ),
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
                        <input
                          type="number"
                          min="0.7"
                          max="3"
                          step="0.1"
                          value={selectedElement.lineHeight}
                          onChange={event =>
                            updateElement(selectedElement.id, {
                              lineHeight: numeric(
                                event.target.value,
                                selectedElement.lineHeight,
                                0.7,
                                3
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>{t.letterSpacing}</span>
                        <input
                          type="number"
                          min="-4"
                          max="20"
                          step="0.2"
                          value={selectedElement.letterSpacing}
                          onChange={event =>
                            updateElement(selectedElement.id, {
                              letterSpacing: numeric(
                                event.target.value,
                                selectedElement.letterSpacing,
                                -4,
                                20
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>{t.paragraphSpacing}</span>
                        <input
                          type="number"
                          min="0"
                          max="80"
                          value={selectedElement.paragraphSpacing}
                          onChange={event =>
                            updateElement(selectedElement.id, {
                              paragraphSpacing: numeric(
                                event.target.value,
                                selectedElement.paragraphSpacing,
                                0,
                                80
                              ),
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
                <div className="geometry-grid">
                  <span className="field-label">{t.position}</span>
                  <label className="field">
                    <span>{t.x}</span>
                    <input
                      type="number"
                      value={Math.round(selectedElement.x)}
                      onChange={event =>
                        updateElement(selectedElement.id, {
                          x: numeric(
                            event.target.value,
                            selectedElement.x,
                            -3000,
                            3000
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>{t.y}</span>
                    <input
                      type="number"
                      value={Math.round(selectedElement.y)}
                      onChange={event =>
                        updateElement(selectedElement.id, {
                          y: numeric(
                            event.target.value,
                            selectedElement.y,
                            -3000,
                            3000
                          ),
                        })
                      }
                    />
                  </label>
                  <span className="field-label">{t.dimensions}</span>
                  <label className="field">
                    <span>{t.width}</span>
                    <input
                      type="number"
                      min="20"
                      value={Math.round(selectedElement.width)}
                      onChange={event =>
                        updateElement(selectedElement.id, {
                          width: numeric(
                            event.target.value,
                            selectedElement.width,
                            20,
                            3000
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>{t.height}</span>
                    <input
                      type="number"
                      min="18"
                      value={Math.round(selectedElement.height)}
                      onChange={event =>
                        updateElement(selectedElement.id, {
                          height: numeric(
                            event.target.value,
                            selectedElement.height,
                            18,
                            5000
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="field geometry-rotate">
                    <span>{t.rotation}</span>
                    <span className="input-with-icon">
                      <RotateCw size={14} />
                      <input
                        type="number"
                        min="-180"
                        max="180"
                        value={Math.round(selectedElement.rotation)}
                        onChange={event =>
                          updateElement(selectedElement.id, {
                            rotation: numeric(
                              event.target.value,
                              selectedElement.rotation,
                              -180,
                              180
                            ),
                          })
                        }
                      />
                      <em>°</em>
                    </span>
                  </label>
                </div>
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
            <label className="field template-select">
              <span>{t.template}</span>
              <select
                aria-label={t.template}
                defaultValue=""
                onChange={event => {
                  applyTemplate(event.target.value);
                  event.currentTarget.value = "";
                }}
              >
                <option value="">{t.selectTemplate}</option>
                {data.templates.map(template => (
                  <option value={template.id} key={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
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
