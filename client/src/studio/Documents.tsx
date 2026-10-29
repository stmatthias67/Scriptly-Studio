import { useState } from "react";
import { useLocation } from "wouter";
import {
  Plus,
  Search,
  Star,
  MoreHorizontal,
  FileText,
  Pencil,
  Copy,
  Trash2,
  Download,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useStudio } from "./store";
import { de, appCopy as c } from "./locales/app";
import { Modal, EmptyState } from "./components";
import PaperPreview from "./PaperPreview";
import ExportDialog from "./ExportDialog";
import type { StudioDocument } from "./types";

export function DocumentCard({ document: doc }: { document: StudioDocument }) {
  const { data, updateDocument, deleteDocument, duplicateDocument } =
    useStudio();
  const [, navigate] = useLocation();
  const [rename, setRename] = useState(false);
  const [name, setName] = useState(doc.title);
  const [exporting, setExporting] = useState(false);
  const favorite = () => updateDocument({ ...doc, favorite: !doc.favorite });
  const items = [
    {
      label: de.open,
      icon: ArrowRight,
      action: () => navigate(`/dokumente/${doc.id}`),
    },
    {
      label: de.rename,
      icon: Pencil,
      action: () => {
        setName(doc.title);
        setRename(true);
      },
    },
    {
      label: de.duplicate,
      icon: Copy,
      action: () => {
        duplicateDocument(doc.id);
        toast.success(de.copied);
      },
    },
    { label: de.export, icon: Download, action: () => setExporting(true) },
    {
      label: de.remove,
      icon: Trash2,
      action: () => {
        if (confirm(de.deleteDocument)) {
          deleteDocument(doc.id);
          toast.success(de.deleted);
        }
      },
    },
  ];
  return (
    <article className="document-card">
      <button
        className="document-preview"
        onClick={() => navigate(`/dokumente/${doc.id}`)}
        aria-label={`${de.open}: ${doc.title}`}
      >
        <PaperPreview page={doc.pages[0]} fonts={data.fonts} />
        <span className="document-page-badge">
          {doc.pages.length} {doc.pages.length === 1 ? de.page : de.pages}
        </span>
      </button>
      <button
        className={`favorite-button ${doc.favorite ? "is-favorite" : ""}`}
        aria-label={doc.favorite ? de.unfavorite : de.favorite}
        onClick={favorite}
      >
        <Star size={16} fill={doc.favorite ? "currentColor" : "none"} />
      </button>
      <div className="document-card-info">
        <button
          className="document-title"
          onClick={() => navigate(`/dokumente/${doc.id}`)}
        >
          {doc.title}
        </button>
        <Dropdown.Root>
          <Dropdown.Trigger
            className="icon-btn"
            aria-label={`${c.actions} ${doc.title}`}
          >
            <MoreHorizontal size={20} />
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content
              className="dropdown-content"
              sideOffset={5}
              align="end"
            >
              {items.map(({ label, icon: Icon, action }) => (
                <Dropdown.Item
                  className={`dropdown-item ${label === de.remove ? "danger" : ""}`}
                  key={label}
                  onSelect={action}
                >
                  <Icon size={15} />
                  {label}
                </Dropdown.Item>
              ))}
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
        <small className="muted">
          {new Intl.DateTimeFormat("de-DE", {
            day: "numeric",
            month: "short",
          }).format(doc.updatedAt)}{" "}
          · {doc.pages[0].paper.format}
        </small>
      </div>
      <Modal
        open={rename}
        onClose={() => setRename(false)}
        title={c.renameTitle}
      >
        <form
          onSubmit={event => {
            event.preventDefault();
            if (!name.trim() || name.trim().length > 100)
              return toast.error(de.titleRequired);
            updateDocument({ ...doc, title: name.trim() });
            setRename(false);
          }}
        >
          <label className="field">
            <span>{de.title}</span>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              autoFocus
              maxLength={100}
              required
            />
          </label>
          <div className="modal-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={() => setRename(false)}
            >
              {de.cancel}
            </button>
            <button className="btn primary" type="submit">
              {de.save}
            </button>
          </div>
        </form>
      </Modal>
      <ExportDialog
        document={doc}
        fonts={data.fonts}
        open={exporting}
        onClose={() => setExporting(false)}
      />
    </article>
  );
}
export default function Documents() {
  const { data } = useStudio();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState("recent");
  const docs = data.documents
    .filter(
      doc =>
        (!favoritesOnly || doc.favorite) &&
        doc.title
          .toLocaleLowerCase("de")
          .includes(search.toLocaleLowerCase("de"))
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "de")
        : sort === "oldest"
          ? a.createdAt - b.createdAt
          : b.updatedAt - a.updatedAt
    );
  return (
    <div className="content-width library-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">GEDANKEN ZUM WIEDERFINDEN</p>
          <h1>{de.documents}</h1>
          <p className="muted">
            Deine Ideen, Notizen und kleinen Meisterwerke. Alles an einem Ort.
          </p>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            navigate("/dokumente/neu");
          }}
        >
          <Plus size={18} />
          {de.newDocument}
        </button>
      </div>
      <div className="library-toolbar">
        <div className="segmented">
          <button
            className={!favoritesOnly ? "selected" : ""}
            onClick={() => setFavoritesOnly(false)}
          >
            {de.all}
            <span>{data.documents.length}</span>
          </button>
          <button
            className={favoritesOnly ? "selected" : ""}
            onClick={() => setFavoritesOnly(true)}
          >
            <Star size={14} />
            {de.favorites}
          </button>
        </div>
        <label className="search-box">
          <Search size={17} />
          <input
            aria-label={c.documentSearch}
            placeholder={de.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label={de.sort}
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          <option value="recent">{de.recentSort}</option>
          <option value="title">{de.titleSort}</option>
          <option value="oldest">{de.oldestSort}</option>
        </select>
      </div>
      {docs.length ? (
        <div className="document-grid library-grid">
          {docs.map(doc => (
            <DocumentCard document={doc} key={doc.id} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FileText size={27} />}
          title={data.documents.length ? de.resultsEmpty : de.noDocuments}
          description={
            data.documents.length ? de.resultsEmptyText : de.noDocumentsText
          }
          action={data.documents.length ? undefined : de.newDocument}
          onAction={() => {
            navigate("/dokumente/neu");
          }}
        />
      )}
    </div>
  );
}
