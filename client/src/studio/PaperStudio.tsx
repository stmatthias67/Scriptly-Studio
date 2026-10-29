import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  FilePlus2,
  Heart,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Modal } from "./components";
import { PaperControls } from "./PaperControls";
import PaperPreview from "./PaperPreview";
import { paperLocale, paperTypeLabels } from "./locales/paper";
import { useStudio } from "./store";
import {
  uid,
  type PaperSettings,
  type PaperTemplate,
  type StudioDocument,
  type StudioPage,
} from "./types";
import "./PaperStudio.css";

export type PaperStudioProps = { templateId?: string };
type ApplyScope = "all" | "one";

function clonePaper(paper: PaperSettings): PaperSettings {
  return { ...paper };
}

function previewPage(paper: PaperSettings, id = "preview"): StudioPage {
  return { id, paper: clonePaper(paper), elements: [] };
}

function paperDescription(template: PaperTemplate) {
  return `${paperTypeLabels[template.paper.type]} · ${template.paper.format} · ${template.paper.orientation === "portrait" ? "Hochformat" : "Querformat"}`;
}

export default function PaperStudio({ templateId }: PaperStudioProps) {
  const { data, settings, updateTemplate } = useStudio();
  const [, navigate] = useLocation();
  const [createdTemplateId, setCreatedTemplateId] = useState<
    string | undefined
  >();
  const activeTemplateId = templateId ?? createdTemplateId;
  const template = data.templates.find(entry => entry.id === activeTemplateId);
  const [name, setName] = useState(template?.name ?? "");
  const [paper, setPaper] = useState<PaperSettings>(() =>
    clonePaper(template?.paper ?? settings.defaultPaper)
  );

  useEffect(() => {
    if (template) {
      setName(template.name);
      setPaper(clonePaper(template.paper));
      return;
    }
    if (!activeTemplateId) {
      setName("");
      setPaper(clonePaper(settings.defaultPaper));
    }
  }, [activeTemplateId, settings.defaultPaper, template]);

  const isEditing = Boolean(template);
  const reset = () => {
    setName(template?.name ?? "");
    setPaper(clonePaper(template?.paper ?? settings.defaultPaper));
  };
  const saveTemplate = () => {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      toast.error(paperLocale.templateNameRequired);
      return;
    }
    if (template) {
      updateTemplate({
        ...template,
        name: trimmedName,
        paper: clonePaper(paper),
      });
      toast.success(paperLocale.updatedTemplate);
      return;
    }
    const id = uid();
    updateTemplate({
      id,
      name: trimmedName,
      paper: clonePaper(paper),
      favorite: false,
      builtIn: false,
    });
    setCreatedTemplateId(id);
    toast.success(paperLocale.savedTemplate);
    navigate(`/papierstudio/${id}`);
  };
  const startDocument = () => {
    navigate("/dokumente/neu");
  };

  return (
    <main className="paper-studio">
      <header className="paper-studio-header">
        <div>
          <p className="eyebrow">{paperLocale.eyebrow}</p>
          <h1>{isEditing ? paperLocale.editTemplate : paperLocale.title}</h1>
          <p>
            {isEditing
              ? "Passe diese gespeicherte Vorlage an. Name, Favorit und Kennung bleiben dabei erhalten."
              : paperLocale.description}
          </p>
        </div>
        <div className="paper-studio-header-actions">
          <button
            type="button"
            className="btn secondary"
            onClick={reset}
            title={paperLocale.resetHint}
          >
            {paperLocale.reset}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={startDocument}
          >
            <FilePlus2 size={17} />
            {paperLocale.startDocument}
          </button>
          <button type="button" className="btn primary" onClick={saveTemplate}>
            {isEditing ? paperLocale.saveChanges : paperLocale.saveTemplate}
          </button>
        </div>
      </header>

      <div className="paper-editor-shell">
        <section className="paper-stage" aria-labelledby="paper-preview-title">
          <div className="paper-stage-topline">
            <div>
              <p className="eyebrow">{paperLocale.livePreview}</p>
              <h2 id="paper-preview-title">
                {name.trim() || paperLocale.newTemplate}
              </h2>
            </div>
            <p>{paperLocale.livePreviewHint}</p>
          </div>
          <div className="paper-stage-preview">
            <PaperPreview
              page={previewPage(paper)}
              fonts={data.fonts}
              className="paper-studio-canvas"
              pageNumber={1}
            />
          </div>
        </section>

        <section
          className="paper-control-dock"
          aria-label={paperLocale.controls}
        >
          <div className="paper-control-dock-title">
            <div>
              <p className="eyebrow">{paperLocale.controlsHint}</p>
              <h2>{paperLocale.controls}</h2>
            </div>
            <SlidersHorizontal size={20} aria-hidden="true" />
          </div>
          <div className="paper-control-section">
            <label className="field">
              <span>{paperLocale.templateName}</span>
              <input
                value={name}
                onChange={event => setName(event.currentTarget.value)}
                placeholder={paperLocale.templateNamePlaceholder}
                maxLength={100}
              />
            </label>
          </div>
          <PaperControls paper={paper} onChange={setPaper} />
        </section>
      </div>
    </main>
  );
}

function TemplateCard({
  template,
  fonts,
  onUse,
  onEdit,
  onDuplicate,
  onDelete,
  onFavorite,
}: {
  template: PaperTemplate;
  fonts: ReturnType<typeof useStudio>["data"]["fonts"];
  onUse: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFavorite: () => void;
}) {
  return (
    <article className="paper-template-card">
      <div className="paper-template-preview">
        <PaperPreview
          page={previewPage(template.paper, `${template.id}-preview`)}
          fonts={fonts}
        />
      </div>
      <div className="paper-template-content">
        <div className="paper-template-meta">
          <span className="tag">
            {template.builtIn
              ? paperLocale.starterTemplate
              : paperTypeLabels[template.paper.type]}
          </span>
          <button
            type="button"
            className={`paper-template-favorite ${template.favorite ? "is-favorite" : ""}`}
            onClick={onFavorite}
            aria-label={
              template.favorite ? paperLocale.unfavorite : paperLocale.favorite
            }
            title={
              template.favorite ? paperLocale.unfavorite : paperLocale.favorite
            }
          >
            <Heart
              size={17}
              fill={template.favorite ? "currentColor" : "none"}
            />
          </button>
        </div>
        <h2 title={template.name}>{template.name}</h2>
        <p>{paperDescription(template)}</p>
        <div className="paper-template-actions">
          <button type="button" className="btn primary small" onClick={onUse}>
            {paperLocale.use}
          </button>
          <details className="paper-template-more">
            <summary aria-label={`Aktionen für ${template.name}`}>
              <MoreHorizontal size={18} />
            </summary>
            <div className="paper-template-menu">
              <button type="button" onClick={onEdit}>
                <Pencil size={14} />
                {paperLocale.edit}
              </button>
              <button type="button" onClick={onDuplicate}>
                <Copy size={14} />
                {paperLocale.duplicate}
              </button>
              <button type="button" className="is-danger" onClick={onDelete}>
                <Trash2 size={14} />
                {paperLocale.delete}
              </button>
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}

/** Template collection with deliberate use choices: a new document or selected existing pages. */
export function TemplatesPage() {
  const {
    data,
    createDocument,
    updateDocument,
    updateTemplate,
    deleteTemplate,
  } = useStudio();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | PaperSettings["type"]>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [useTemplate, setUseTemplate] = useState<PaperTemplate | null>(null);
  const [applyTemplate, setApplyTemplate] = useState<PaperTemplate | null>(
    null
  );
  const [deleteCandidate, setDeleteCandidate] = useState<PaperTemplate | null>(
    null
  );
  const [documentId, setDocumentId] = useState("");
  const [pageId, setPageId] = useState("");
  const [scope, setScope] = useState<ApplyScope>("all");

  const templates = useMemo(
    () =>
      data.templates
        .filter(template => {
          const text =
            `${template.name} ${paperTypeLabels[template.paper.type]}`.toLocaleLowerCase(
              "de"
            );
          return (
            text.includes(query.trim().toLocaleLowerCase("de")) &&
            (type === "all" || template.paper.type === type) &&
            (!favoritesOnly || template.favorite)
          );
        })
        .sort(
          (left, right) =>
            Number(right.favorite) - Number(left.favorite) ||
            left.name.localeCompare(right.name, "de")
        ),
    [data.templates, favoritesOnly, query, type]
  );

  const selectedDocument = data.documents.find(
    document => document.id === documentId
  );
  useEffect(() => {
    if (!applyTemplate) return;
    const nextDocument =
      data.documents.find(document => document.id === documentId) ??
      data.documents[0];
    if (nextDocument && nextDocument.id !== documentId)
      setDocumentId(nextDocument.id);
    if (nextDocument && !nextDocument.pages.some(page => page.id === pageId))
      setPageId(nextDocument.pages[0]?.id ?? "");
  }, [applyTemplate, data.documents, documentId, pageId]);

  const beginUse = (template: PaperTemplate) => setUseTemplate(template);
  const createWithTemplate = (template: PaperTemplate) => {
    const document = createDocument(clonePaper(template.paper));
    setUseTemplate(null);
    toast.success(paperLocale.documentCreated);
    navigate(`/dokumente/${document.id}`);
  };
  const beginApply = (template: PaperTemplate) => {
    setUseTemplate(null);
    setApplyTemplate(template);
    const firstDocument = data.documents[0];
    setDocumentId(firstDocument?.id ?? "");
    setPageId(firstDocument?.pages[0]?.id ?? "");
    setScope("all");
  };
  const applyToDocument = () => {
    if (!applyTemplate || !selectedDocument || (scope === "one" && !pageId))
      return;
    const pages = selectedDocument.pages.map(page =>
      scope === "all" || page.id === pageId
        ? { ...page, paper: clonePaper(applyTemplate.paper) }
        : page
    );
    updateDocument({ ...selectedDocument, pages });
    setApplyTemplate(null);
    toast.success(paperLocale.applied);
  };
  const duplicate = (template: PaperTemplate) => {
    updateTemplate({
      ...template,
      id: uid(),
      name: `${template.name.slice(0, 90)} – Kopie`,
      paper: clonePaper(template.paper),
      favorite: false,
      builtIn: false,
    });
    toast.success(paperLocale.duplicated);
  };
  const deleteSelected = () => {
    if (!deleteCandidate) return;
    deleteTemplate(deleteCandidate.id);
    setDeleteCandidate(null);
    toast.success(paperLocale.deleted);
  };

  return (
    <main className="templates-page">
      <header className="templates-page-header">
        <div>
          <p className="eyebrow">{paperLocale.galleryEyebrow}</p>
          <h1>{paperLocale.galleryTitle}</h1>
          <p>{paperLocale.galleryDescription}</p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => navigate("/papierstudio")}
        >
          <Plus size={17} />
          {paperLocale.galleryCreate}
        </button>
      </header>

      <div className="templates-toolbar" aria-label="Vorlagen filtern">
        <label className="templates-search">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={event => setQuery(event.currentTarget.value)}
            placeholder={paperLocale.search}
            aria-label={paperLocale.search}
          />
        </label>
        <select
          className="templates-filter-select"
          value={type}
          onChange={event =>
            setType(event.currentTarget.value as "all" | PaperSettings["type"])
          }
          aria-label={paperLocale.type}
        >
          <option value="all">{paperLocale.allTypes}</option>
          {Object.entries(paperTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="templates-favorite-filter">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={event => setFavoritesOnly(event.currentTarget.checked)}
          />
          {paperLocale.onlyFavorites}
        </label>
      </div>

      {templates.length ? (
        <div className="templates-grid">
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              fonts={data.fonts}
              onUse={() => beginUse(template)}
              onEdit={() => navigate(`/papierstudio/${template.id}`)}
              onDuplicate={() => duplicate(template)}
              onDelete={() => setDeleteCandidate(template)}
              onFavorite={() =>
                updateTemplate({ ...template, favorite: !template.favorite })
              }
            />
          ))}
        </div>
      ) : (
        <section className="paper-empty">
          <Sparkles size={24} aria-hidden="true" />
          <h2>{paperLocale.noTemplates}</h2>
          <p>{paperLocale.noTemplatesHint}</p>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setQuery("");
              setType("all");
              setFavoritesOnly(false);
            }}
          >
            {paperLocale.showAll}
          </button>
        </section>
      )}

      <Modal
        open={Boolean(useTemplate)}
        onClose={() => setUseTemplate(null)}
        title={paperLocale.useTitle}
      >
        {useTemplate && (
          <div className="paper-modal-body">
            <p>{paperLocale.useHint}</p>
            <div className="paper-use-options">
              <button
                type="button"
                className="paper-use-option"
                onClick={() => createWithTemplate(useTemplate)}
              >
                <FilePlus2 size={19} />
                <span>
                  <strong>{paperLocale.useForNew}</strong>
                  <small>{paperLocale.useForNewHint}</small>
                </span>
              </button>
              <button
                type="button"
                className="paper-use-option"
                disabled={!data.documents.length}
                onClick={() => beginApply(useTemplate)}
              >
                <SlidersHorizontal size={19} />
                <span>
                  <strong>{paperLocale.applyExisting}</strong>
                  <small>
                    {data.documents.length
                      ? paperLocale.applyExistingHint
                      : paperLocale.noDocuments}
                  </small>
                </span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(applyTemplate)}
        onClose={() => setApplyTemplate(null)}
        title={paperLocale.applyExisting}
      >
        {applyTemplate && (
          <div className="paper-modal-body">
            <p>{paperLocale.applyExistingHint}</p>
            <div className="paper-apply-options">
              <label className="paper-modal-field">
                {paperLocale.chooseDocument}
                <select
                  value={documentId}
                  onChange={event => {
                    const nextId = event.currentTarget.value;
                    setDocumentId(nextId);
                    setPageId(
                      data.documents.find(document => document.id === nextId)
                        ?.pages[0]?.id ?? ""
                    );
                  }}
                >
                  {data.documents.map(document => (
                    <option key={document.id} value={document.id}>
                      {document.title}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="paper-modal-field">
                <legend>{paperLocale.applyScope}</legend>
                <div className="paper-apply-scope">
                  <label>
                    <input
                      type="radio"
                      name="apply-scope"
                      checked={scope === "all"}
                      onChange={() => setScope("all")}
                    />
                    {paperLocale.allPages}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="apply-scope"
                      checked={scope === "one"}
                      onChange={() => setScope("one")}
                    />
                    {paperLocale.onePage}
                  </label>
                </div>
              </fieldset>
              {scope === "one" && (
                <label className="paper-modal-field">
                  {paperLocale.choosePage}
                  <select
                    value={pageId}
                    onChange={event => setPageId(event.currentTarget.value)}
                  >
                    {selectedDocument?.pages.map((page, index) => (
                      <option key={page.id} value={page.id}>
                        Seite {index + 1}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="paper-modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setApplyTemplate(null)}
              >
                {paperLocale.cancel}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!selectedDocument || (scope === "one" && !pageId)}
                onClick={applyToDocument}
              >
                {paperLocale.apply}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        title={paperLocale.deleteTitle}
      >
        {deleteCandidate && (
          <div className="paper-modal-body">
            <p className="paper-delete-warning">
              {paperLocale.deleteHint.replace("{name}", deleteCandidate.name)}
            </p>
            <div className="paper-modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setDeleteCandidate(null)}
              >
                {paperLocale.cancel}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={deleteSelected}
              >
                {paperLocale.deleteConfirm}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
