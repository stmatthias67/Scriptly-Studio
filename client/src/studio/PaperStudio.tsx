import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  FilePlus2,
  ImagePlus,
  Lock,
  Ruler,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { NumberField } from "./components";
import PaperPreview from "./PaperPreview";
import { paperLocale as t } from "./locales/paper";
import { useStudio } from "./store";
import { loadFontVariants } from "./font-engine";
import { textBoxOnPaper } from "./render";
import { detectSheetLines } from "./sheet-detect";
import { planLimits } from "./plan";
import {
  createText,
  uid,
  type PaperSettings,
  type PaperTemplate,
  type PaperTextLayout,
  type StudioPage,
} from "./types";
import "./PaperStudio.css";

export type PaperStudioProps = { templateId?: string };

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

interface SheetDraft {
  id: string;
  name: string;
  paper: PaperSettings;
  /** True once the person set or confirmed the writing grid themselves. */
  configured: boolean;
  isNew: boolean;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function decodeImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode"));
    image.src = source;
  });
}

/** Turns an uploaded image into an image paper with a first guess of its grid. */
async function sheetFromFile(file: File): Promise<{
  paper: PaperSettings;
  detected: boolean;
}> {
  const background = await readAsDataUrl(file);
  const image = await decodeImage(background);
  const portrait = image.naturalHeight >= image.naturalWidth;
  const ratio =
    Math.max(image.naturalWidth, image.naturalHeight) /
    Math.min(image.naturalWidth, image.naturalHeight);
  const a4 = Math.abs(ratio - 297 / 210) < 0.03;
  const short = 210;
  const long = a4 ? 297 : Math.min(600, Math.round(short * ratio * 10) / 10);
  const width = portrait ? short : long;
  const height = portrait ? long : short;
  const found = detectSheetLines(image, height);
  const textLayout: PaperTextLayout = {
    firstLine: found?.firstLine ?? 20,
    lineSpacing: found?.lineSpacing ?? 8,
    insetLeft: 12,
    insetRight: 12,
  };
  return {
    detected: Boolean(found),
    paper: {
      type: "image",
      format: a4 ? "A4" : "custom",
      width,
      height,
      orientation: portrait ? "portrait" : "landscape",
      color: "#ffffff",
      lineColor: "#d6d9dc",
      spacing: textLayout.lineSpacing,
      lineWidth: 0.2,
      margin: 0,
      header: "",
      footer: "",
      border: false,
      texture: false,
      pageNumbers: false,
      background,
      textLayout,
    },
  };
}

/** Updates the address without remounting the studio, so a reload reopens the sheet. */
function replaceAddress(path: string) {
  window.history.replaceState(window.history.state, "", path);
}

function draftFrom(template: PaperTemplate): SheetDraft {
  return {
    id: template.id,
    name: template.name,
    paper: structuredClone(template.paper),
    configured: !template.builtIn,
    isNew: false,
  };
}

function SheetCard({
  template,
  active,
  onSelect,
}: {
  template: PaperTemplate;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`sheet-card ${active ? "active" : ""}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <span className="sheet-card-thumb">
        {template.paper.background && (
          <img src={template.paper.background} alt="" loading="lazy" />
        )}
      </span>
      <span className="sheet-card-meta">
        <strong>{template.name}</strong>
        <small>
          {template.builtIn ? (
            <>
              <Lock size={11} /> {t.standard}
            </>
          ) : (
            t.uploaded
          )}
        </small>
      </span>
    </button>
  );
}

export default function PaperStudio({ templateId }: PaperStudioProps) {
  const { data, settings, updateTemplate, deleteTemplate } = useStudio();
  const [, navigate] = useLocation();
  const fileInput = useRef<HTMLInputElement>(null);
  const initial =
    data.templates.find(template => template.id === templateId) ??
    data.templates[0];
  const [draft, setDraft] = useState<SheetDraft | undefined>(() =>
    initial ? draftFrom(initial) : undefined
  );
  const [previewText, setPreviewText] = useState<string>(t.previewDefault);
  const [fontId, setFontId] = useState(settings.defaultFontId || "caveat");
  const [fontSize, setFontSize] = useState(settings.defaultFontSize);
  const [fontsReady, setFontsReady] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void loadFontVariants(data.fonts).then(() => {
      if (live) setFontsReady(value => value + 1);
    });
    return () => {
      live = false;
    };
  }, [data.fonts]);

  const builtIn = data.templates.filter(template => template.builtIn);
  const uploads = data.templates.filter(template => !template.builtIn);
  const selectedTemplate = data.templates.find(
    template => template.id === draft?.id
  );
  const locked = Boolean(selectedTemplate?.builtIn);
  const layout = draft?.paper.textLayout;

  const previewPage = useMemo<StudioPage | undefined>(() => {
    if (!draft) return undefined;
    const box = textBoxOnPaper(draft.paper, fontId, fontSize);
    const element = createText(settings, box?.x ?? 60, box?.y ?? 60);
    element.text = previewText;
    element.fontId = fontId;
    element.fontSize = fontSize;
    if (box) {
      element.width = box.width;
      element.height = box.height;
      element.lineHeight = box.lineHeight;
    }
    element.paragraphSpacing = 0;
    return { id: "sheet-preview", paper: draft.paper, elements: [element] };
    // fontsReady re-measures the baseline once handwriting fonts are installed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, fontId, fontSize, previewText, settings, fontsReady]);

  const select = (template: PaperTemplate) => {
    setDraft(draftFrom(template));
    replaceAddress(`/papierstudio/${template.id}`);
  };

  const setLayout = (key: keyof PaperTextLayout, value: number) => {
    setDraft(current => {
      if (!current?.paper.textLayout) return current;
      const textLayout = { ...current.paper.textLayout, [key]: value };
      return {
        ...current,
        configured: true,
        paper: {
          ...current.paper,
          textLayout,
          spacing: textLayout.lineSpacing,
        },
      };
    });
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error(t.uploadWrongType);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(t.uploadTooLarge);
      return;
    }
    if (uploads.length >= planLimits(settings.plan).sheets) {
      toast.error(t.limitReached, {
        action: { label: "Pläne", onClick: () => navigate("/abo") },
      });
      return;
    }
    setBusy(true);
    try {
      const { paper, detected } = await sheetFromFile(file);
      setDraft({
        id: uid(),
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
        paper,
        configured: false,
        isNew: true,
      });
      toast.message(detected ? t.uploadDetected : t.uploadNotDetected);
    } catch {
      toast.error(t.uploadFailed);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const canSave =
    Boolean(draft) && !locked && Boolean(draft?.configured) && !busy;

  const save = () => {
    if (!draft || !canSave) return;
    const name = draft.name.trim();
    if (!name) {
      toast.error(t.nameRequired);
      return;
    }
    updateTemplate({
      id: draft.id,
      name,
      paper: structuredClone(draft.paper),
      favorite: false,
    });
    setDraft({ ...draft, name, isNew: false });
    replaceAddress(`/papierstudio/${draft.id}`);
    toast.success(t.saved);
  };

  const remove = () => {
    if (!draft || locked || draft.isNew) return;
    if (!confirm(t.deleteConfirm)) return;
    deleteTemplate(draft.id);
    const fallback = data.templates.find(template => template.builtIn);
    setDraft(fallback ? draftFrom(fallback) : undefined);
    replaceAddress("/papierstudio");
    toast.success(t.deleted);
  };

  const startDocument = () => {
    if (!draft) return;
    if (draft.isNew) {
      toast.error(t.confirmGridHint);
      return;
    }
    navigate(`/dokumente/neu?blatt=${encodeURIComponent(draft.id)}`);
  };

  return (
    <div className="sheet-studio content-width">
      <header className="sheet-studio-header">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p className="muted">{t.description}</p>
        </div>
      </header>

      <div className="sheet-studio-layout">
        <aside className="sheet-library card" aria-label={t.library}>
          <h2>{t.library}</h2>
          <div className="sheet-library-grid">
            {builtIn.map(template => (
              <SheetCard
                key={template.id}
                template={template}
                active={draft?.id === template.id}
                onSelect={() => select(template)}
              />
            ))}
            {uploads.map(template => (
              <SheetCard
                key={template.id}
                template={template}
                active={draft?.id === template.id}
                onSelect={() => select(template)}
              />
            ))}
            {draft?.isNew && (
              <SheetCard
                template={{
                  id: draft.id,
                  name: draft.name || t.uploaded,
                  paper: draft.paper,
                  favorite: false,
                }}
                active
                onSelect={() => undefined}
              />
            )}
          </div>
          <button
            type="button"
            className="btn secondary sheet-upload"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            <ImagePlus size={16} />
            {t.upload}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED.join(",")}
            hidden
            onChange={event => void upload(event.target.files?.[0])}
          />
          <p className="sheet-note">{t.uploadHint}</p>
        </aside>

        {draft && previewPage ? (
          <>
            <section className="sheet-preview card" aria-label={t.preview}>
              <PaperPreview
                page={previewPage}
                fonts={data.fonts}
                className="sheet-preview-paper"
              />
            </section>

            <section className="sheet-controls card" aria-label={t.grid}>
              {!locked && (
                <label className="field">
                  <span>{t.name}</span>
                  <input
                    value={draft.name}
                    placeholder={t.namePlaceholder}
                    maxLength={80}
                    onChange={event =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                  />
                </label>
              )}

              <label className="field">
                <span>{t.previewText}</span>
                <textarea
                  rows={4}
                  value={previewText}
                  onChange={event =>
                    setPreviewText(event.target.value.slice(0, 1500))
                  }
                />
              </label>
              <div className="sheet-field-row">
                <label className="field">
                  <span>{t.font}</span>
                  <select
                    value={fontId}
                    onChange={event => setFontId(event.target.value)}
                  >
                    <option value="caveat">Caveat</option>
                    {data.fonts.map(font => (
                      <option key={font.id} value={font.id}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>
                    {t.fontSize} ({t.pixels})
                  </span>
                  <NumberField
                    value={fontSize}
                    min={8}
                    max={150}
                    onChange={setFontSize}
                  />
                </label>
              </div>

              <div className="sheet-grid-heading">
                <Ruler size={16} />
                <div>
                  <strong>{t.grid}</strong>
                  <small>{t.gridHint}</small>
                </div>
              </div>
              {locked && <p className="sheet-note locked">{t.builtInLocked}</p>}
              {layout && (
                <fieldset className="sheet-grid-fields" disabled={locked}>
                  <label className="field sheet-spacing">
                    <span>
                      {t.lineSpacing} ({t.millimetres})
                    </span>
                    <div className="sheet-spacing-row">
                      <input
                        type="range"
                        min={2}
                        max={20}
                        step={0.01}
                        value={layout.lineSpacing}
                        aria-label={t.lineSpacing}
                        onChange={event =>
                          setLayout("lineSpacing", Number(event.target.value))
                        }
                      />
                      <NumberField
                        value={layout.lineSpacing}
                        min={2}
                        max={40}
                        decimals={3}
                        onChange={value => setLayout("lineSpacing", value)}
                      />
                    </div>
                  </label>
                  <label className="field">
                    <span>
                      {t.firstLine} ({t.millimetres})
                    </span>
                    <NumberField
                      value={layout.firstLine}
                      min={0}
                      max={draft.paper.height}
                      decimals={2}
                      onChange={value => setLayout("firstLine", value)}
                    />
                  </label>
                  <label className="field">
                    <span>
                      {t.insetLeft} ({t.millimetres})
                    </span>
                    <NumberField
                      value={layout.insetLeft}
                      min={0}
                      max={draft.paper.width / 2}
                      decimals={1}
                      onChange={value => setLayout("insetLeft", value)}
                    />
                  </label>
                  <label className="field">
                    <span>
                      {t.insetRight} ({t.millimetres})
                    </span>
                    <NumberField
                      value={layout.insetRight}
                      min={0}
                      max={draft.paper.width / 2}
                      decimals={1}
                      onChange={value => setLayout("insetRight", value)}
                    />
                  </label>
                </fieldset>
              )}

              {!locked && !draft.configured && (
                <div className="sheet-confirm">
                  <p className="sheet-note">{t.confirmGridHint}</p>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setDraft({ ...draft, configured: true })}
                  >
                    <Check size={15} />
                    {t.confirmGrid}
                  </button>
                </div>
              )}

              <div className="sheet-actions">
                {!locked && (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!canSave}
                    onClick={save}
                  >
                    <Save size={16} />
                    {draft.isNew ? t.save : t.saveChanges}
                  </button>
                )}
                <button
                  type="button"
                  className="btn secondary"
                  onClick={startDocument}
                >
                  <FilePlus2 size={16} />
                  {t.newDocument}
                </button>
                {!locked && !draft.isNew && (
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={remove}
                    aria-label={t.delete}
                    title={t.delete}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            </section>
          </>
        ) : (
          <p className="sheet-note">{t.missingTemplate}</p>
        )}
      </div>
    </div>
  );
}

/** Overview of every sheet: the standard ones and the uploaded ones. */
export function TemplatesPage() {
  const { data } = useStudio();
  const [, navigate] = useLocation();
  const uploads = data.templates.filter(template => !template.builtIn);
  return (
    <div className="sheet-studio content-width">
      <header className="sheet-studio-header">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.templatesTitle}</h1>
          <p className="muted">{t.templatesDescription}</p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => navigate("/papierstudio")}
        >
          <ImagePlus size={16} />
          {t.upload}
        </button>
      </header>
      <div className="sheet-overview">
        {data.templates.map(template => (
          <article className="sheet-overview-card card" key={template.id}>
            <SheetCard
              template={template}
              active={false}
              onSelect={() => navigate(`/papierstudio/${template.id}`)}
            />
            <div className="sheet-overview-actions">
              <button
                type="button"
                className="btn secondary small"
                onClick={() => navigate(`/papierstudio/${template.id}`)}
              >
                {t.open}
              </button>
              <button
                type="button"
                className="btn secondary small"
                onClick={() =>
                  navigate(
                    `/dokumente/neu?blatt=${encodeURIComponent(template.id)}`
                  )
                }
              >
                <FilePlus2 size={14} />
                {t.newDocument}
              </button>
            </div>
          </article>
        ))}
      </div>
      {!uploads.length && <p className="sheet-note">{t.emptyUploads}</p>}
    </div>
  );
}
