import { useLocation } from "wouter";
import {
  ArrowRight,
  Plus,
  PenLine,
  SlidersHorizontal,
  FileText,
  Sparkles,
  Feather,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useStudio } from "./store";
import { de, appCopy as c } from "./locales/app";
import {
  basePaper,
  createText,
  defaultSettings,
  type StudioPage,
} from "./types";
import { loadFonts, getFontFamily } from "./font-engine";
import PaperPreview from "./PaperPreview";
import { EmptyState, Modal } from "./components";
import { DocumentCard } from "./Documents";

const sampleText = {
  ...createText(defaultSettings, 88, 155),
  text: "Mehr von dem,\nwas dir wichtig ist.\n\nKleine Gedanken.\nGroße Möglichkeiten.\n\nUnd ein bisschen\nmehr du.",
  fontSize: 43,
  width: 590,
  height: 700,
  rotation: -2,
  lineHeight: 1.65,
};
const samplePage: StudioPage = {
  id: "sample",
  paper: {
    ...basePaper,
    type: "lined",
    color: "#fffdf8",
    lineColor: "#d7ded3",
    spacing: 10,
  },
  elements: [sampleText],
};
export default function Dashboard() {
  const { data, settings } = useStudio();
  const [, navigate] = useLocation();
  const [help, setHelp] = useState(false);
  const [, setFontRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void loadFonts(data.fonts).then(() => {
      if (active) setFontRevision(v => v + 1);
    });
    return () => {
      active = false;
    };
  }, [data.fonts]);
  const newDocument = () => {
    navigate("/dokumente/neu");
  };
  const recent = [...data.documents]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3);
  const favorites = data.templates.filter(t => t.favorite).slice(0, 4);
  return (
    <div className="dashboard content-width">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">{c.creativeSpace}</p>
          <h1>
            {settings.name
              ? `Schön, dass du da bist, ${settings.name}.`
              : `${de.hello}.`}
          </h1>
          <p className="muted">{c.thoughtStart}</p>
        </div>
        <button className="btn primary" onClick={newDocument}>
          <Plus size={18} />
          {de.newDocument}
        </button>
      </div>
      <section className="atelier-hero">
        <div className="hero-copy">
          <span className="hero-pill">
            <span />
            {c.heroEyebrow}
          </span>
          <h2>
            {c.heroLineOne}
            <br />
            <em>{c.heroLineTwo}</em>
          </h2>
          <p>{de.heroDescription}</p>
          <button
            className="btn primary"
            onClick={() => navigate("/schrift-erstellen")}
          >
            <PenLine size={17} />
            {de.createFont}
            <ArrowRight size={17} />
          </button>
          <div className="hero-footnote">
            <Check size={13} /> Ganz persönlich. Ganz bei dir.
          </div>
        </div>
        <div
          className="hero-papers"
          aria-label="Beispiel einer gestalteten Papierseite"
        >
          <div className="paper-stack-back" />
          <div className="paper-stack-middle" />
          <div className="hero-paper">
            <PaperPreview page={samplePage} />
            <span className="sample-label">{de.example}</span>
          </div>
          <div className="handwritten-note">
            {c.forIdeas}
            <span>↗</span>
          </div>
        </div>
      </section>
      <div className="quick-actions">
        <button
          className="quick-action"
          onClick={() => navigate("/schrift-erstellen")}
        >
          <span className="quick-icon sage">
            <Feather size={22} />
          </span>
          <span>
            <strong>{de.fontAction}</strong>
            <small>{de.fontDescription}</small>
          </span>
          <ArrowUpRight size={20} />
        </button>
        <button
          className="quick-action"
          onClick={() => navigate("/papierstudio")}
        >
          <span className="quick-icon lilac">
            <SlidersHorizontal size={22} />
          </span>
          <span>
            <strong>{de.paperAction}</strong>
            <small>{de.paperDescription}</small>
          </span>
          <ArrowUpRight size={20} />
        </button>
      </div>
      <section className="dashboard-section">
        <div className="section-heading">
          <h2>
            {de.recent}
            <span className="count">{data.documents.length}</span>
          </h2>
          <button className="text-link" onClick={() => navigate("/dokumente")}>
            {de.allDocuments}
            <ArrowRight size={16} />
          </button>
        </div>
        {recent.length ? (
          <div className="document-grid">
            {recent.map(doc => (
              <DocumentCard key={doc.id} document={doc} />
            ))}
            <button className="new-document-tile" onClick={newDocument}>
              <span>
                <Plus size={23} />
              </span>
              <strong>{c.newPage}</strong>
              <small>{c.nextThought}</small>
            </button>
          </div>
        ) : (
          <div className="dashboard-empty">
            <div>
              <span className="empty-icon">
                <FileText size={24} />
              </span>
              <h3>{de.noDocuments}</h3>
              <p>{de.noDocumentsText}</p>
            </div>
            <button className="new-document-tile" onClick={newDocument}>
              <span>
                <Plus size={23} />
              </span>
              <strong>{c.firstDocument}</strong>
              <small>{c.justStart}</small>
            </button>
          </div>
        )}
      </section>
      <div className="dashboard-lower">
        <section>
          <div className="section-heading">
            <h2>{de.yourFonts}</h2>
            <button
              className="text-link"
              onClick={() => navigate("/schriften")}
            >
              {de.allFonts}
              <ArrowRight size={16} />
            </button>
          </div>
          {data.fonts.length ? (
            <div className="mini-fonts">
              {data.fonts.slice(0, 2).map(font => (
                <button
                  key={font.id}
                  className="mini-font"
                  onClick={() => navigate(`/schriften/${font.id}`)}
                >
                  <span
                    className="mini-font-sample"
                    style={{
                      fontFamily: `"${getFontFamily(font.id)}", Caveat, cursive`,
                    }}
                  >
                    Aa Bb Cc
                  </span>
                  <strong>{font.name}</strong>
                  <small>
                    {
                      Object.keys(font.glyphs).filter(char =>
                        font.glyphs[char].variants.some(v => v.length)
                      ).length
                    }{" "}
                    {c.createdCharacters}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <div className="font-empty">
              <span className="font-empty-sample">Aa Bb Cc</span>
              <div>
                <h3>{de.noFonts}</h3>
                <p>{de.noFontsText}</p>
                <button
                  className="text-link"
                  onClick={() => navigate("/schrift-erstellen")}
                >
                  {c.makeFont}
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
        </section>
        <section className="getting-started">
          <span className="quick-icon cream">
            <Sparkles size={20} />
          </span>
          <div>
            <p className="eyebrow">{c.firstStep}</p>
            <h3>{de.start}</h3>
            <p>{c.onboardingText}</p>
            <button className="text-link" onClick={() => setHelp(true)}>
              {c.howItWorks}
              <ArrowRight size={15} />
            </button>
          </div>
        </section>
      </div>
      <section className="dashboard-section">
        <div className="section-heading">
          <h2>{de.favoriteTemplates}</h2>
          <button className="text-link" onClick={() => navigate("/vorlagen")}>
            {de.allTemplates}
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="favorite-paper-grid">
          {favorites.map(template => (
            <button
              className="favorite-paper"
              key={template.id}
              onClick={() => {
                navigate("/dokumente/neu");
              }}
            >
              <div className="favorite-paper-preview">
                <PaperPreview
                  page={{
                    id: template.id,
                    paper: template.paper,
                    elements: [],
                  }}
                />
                <span className="paper-size-tag">{template.paper.format}</span>
              </div>
              <strong>{template.name}</strong>
              <small>
                {template.paper.type === "weekly" ? c.yourWeek : c.nextPaper}
              </small>
            </button>
          ))}
          {!favorites.length && (
            <EmptyState
              title={c.noPaper}
              description={c.noPaperHint}
              action={c.discoverTemplates}
              onAction={() => navigate("/vorlagen")}
            />
          )}
        </div>
      </section>
      <div className="dashboard-footer">
        <Feather size={14} />
        <span>{de.privacy}</span>
        <span>{c.crafted}</span>
      </div>
      <HelpModal open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
export function HelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={de.helpTitle}>
      <div className="help-steps">
        {de.helpSteps.map(([title, text]) => (
          <section key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </section>
        ))}
        <div className="notice">{de.storageWarning}</div>
      </div>
    </Modal>
  );
}
