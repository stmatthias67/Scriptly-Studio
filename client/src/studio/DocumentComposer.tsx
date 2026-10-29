import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, FileText, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useStudio } from "./store";
import { appCopy as c, de } from "./locales/app";
import { basePaper, createPage, createText, paperLabels } from "./types";
import type { FontProject, PaperSettings, StudioPage } from "./types";
import { mmToPx, pagePixelDimensions, splitTextForHeight } from "./render";
import "./DocumentComposer.css";

function clonePaper(paper: PaperSettings): PaperSettings {
  return structuredClone(paper);
}

function paperForLineLayout(paper: PaperSettings): PaperSettings {
  return paper;
}

function generatedPages(
  text: string,
  paper: PaperSettings,
  fontId: string,
  color: string,
  fontSize: number,
  settings: ReturnType<typeof useStudio>["settings"]
): StudioPage[] {
  const pages: StudioPage[] = [];
  let remaining = text.trim();
  const linedPaper = paperForLineLayout(paper);
  const dimensions = pagePixelDimensions(linedPaper);
  const margin = mmToPx(Math.max(0, linedPaper.margin));
  const innerLeft = Math.min(margin, dimensions.width / 3);
  const innerRight = Math.max(innerLeft + 4, dimensions.width - margin);
  const firstLine = margin;
  const top =
    linedPaper.type === "lined" || linedPaper.type === "custom"
      ? firstLine - fontSize * 0.72
      : margin;
  const bottom = dimensions.height - margin;
  const height = Math.max(fontSize * 1.6, bottom - top);
  const lineHeight =
    linedPaper.type === "lined" || linedPaper.type === "custom"
      ? Math.max(0.7, linedPaper.spacing / (fontSize / (96 / 25.4)))
      : settings.defaultLineHeight;
  let safety = 0;
  while (remaining && safety < 100) {
    const page = createPage(clonePaper(linedPaper));
    const element = createText(
      { ...settings, defaultFontId: fontId },
      innerLeft,
      top
    );
    element.text = remaining;
    element.fontId = fontId;
    element.color = color;
    element.fontSize = fontSize;
    element.x = innerLeft;
    element.y = top;
    element.width = innerRight - innerLeft;
    element.height = height;
    element.lineHeight = lineHeight;
    element.letterSpacing = 0;
    element.paragraphSpacing = 0;
    const split = splitTextForHeight(element);
    const visible = split.visible.trimEnd();
    if (!visible) {
      element.height = dimensions.height - margin * 1.5;
      element.text = remaining;
      page.elements.push(element);
      pages.push(page);
      break;
    }
    element.text = visible;
    page.elements.push(element);
    pages.push(page);
    remaining = split.overflow.trimStart();
    safety += 1;
  }
  if (!pages.length) {
    const page = createPage(clonePaper(linedPaper));
    const empty = createText(settings, innerLeft, top);
    empty.text = "";
    empty.fontId = fontId;
    empty.color = color;
    empty.fontSize = fontSize;
    empty.width = innerRight - innerLeft;
    empty.height = height;
    empty.lineHeight = lineHeight;
    page.elements.push(empty);
    pages.push(page);
  }
  return pages;
}

function FontOption({ font }: { font: FontProject }) {
  return <option value={font.id}>{font.name}</option>;
}

export default function DocumentComposer() {
  const { data, settings, createDocument, updateDocument } = useStudio();
  const [, navigate] = useLocation();
  const linedTemplate = useMemo(
    () => data.templates.find(template => template.paper.type === "lined"),
    [data.templates]
  );
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [fontId, setFontId] = useState(settings.defaultFontId || "caveat");
  const [color, setColor] = useState(settings.defaultColor);
  const [fontSize, setFontSize] = useState(settings.defaultFontSize);
  const [paperId, setPaperId] = useState(linedTemplate?.id ?? "default-lined");

  const paperChoices = useMemo<
    Array<{ id: string; name: string; paper: PaperSettings }>
  >(
    () => [
      ...(linedTemplate
        ? [
            {
              id: linedTemplate.id,
              name: linedTemplate.name,
              paper: linedTemplate.paper,
            },
          ]
        : []),
      ...data.templates
        .filter(template => template.id !== linedTemplate?.id)
        .map(template => ({
          id: template.id,
          name: template.name,
          paper: template.paper,
        })),
      {
        id: "default-lined",
        name: "Liniertes Blatt · A4",
        paper: {
          ...basePaper,
          type: "lined",
          spacing: 8,
          color: "#fffdfb",
          lineColor: "#d7ded3",
        },
      },
    ],
    [data.templates, linedTemplate]
  );
  const selectedPaper =
    paperChoices.find(choice => choice.id === paperId)?.paper ??
    paperChoices[0]?.paper ??
    basePaper;

  const generate = () => {
    if (!text.trim()) {
      toast.error("Bitte gib zuerst einen Text ein.");
      return;
    }
    const document = createDocument(selectedPaper);
    const pages = generatedPages(
      text,
      selectedPaper,
      fontId,
      color,
      fontSize,
      settings
    );
    updateDocument({
      ...document,
      title: title.trim().slice(0, 100) || "Neues handschriftliches Dokument",
      pages,
      updatedAt: Date.now(),
    });
    toast.success("Dein Text liegt jetzt sauber auf den Linien.");
    navigate(`/dokumente/${document.id}`);
  };

  return (
    <main className="document-composer">
      <header className="composer-header">
        <button
          className="composer-back"
          onClick={() => navigate("/dokumente")}
        >
          <ArrowLeft size={17} /> {de.documents}
        </button>
        <div className="composer-step">
          <span className="step-active">1</span>
          <span /> <span>2</span> <span /> <span>3</span>
        </div>
      </header>
      <section className="composer-intro">
        <span className="composer-mark">
          <Sparkles size={19} />
        </span>
        <p className="eyebrow">DEIN TEXT WIRD ZUM BLATT</p>
        <h1>
          Was möchtest du
          <br />
          <em>aufschreiben?</em>
        </h1>
        <p>
          Gib deinen Inhalt zuerst ganz in Ruhe ein. Danach bestimmst du
          Handschrift, Farbe und liniertes Papier – Scriptly setzt alles passend
          zusammen.
        </p>
      </section>
      <section className="composer-form" aria-label="Dokument vorbereiten">
        <label className="composer-field composer-title-field">
          <span>
            Dokumentname <small>optional</small>
          </span>
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            maxLength={100}
            placeholder="z. B. Meine Notizen"
          />
        </label>
        <label className="composer-field composer-text-field">
          <span>Dein Text</span>
          <textarea
            value={text}
            onChange={event => setText(event.target.value.slice(0, 100000))}
            placeholder="Schreibe oder füge hier deinen Text ein …"
            autoFocus
            rows={12}
            maxLength={100000}
          />
          <small>
            {text.length.toLocaleString("de-DE")} Zeichen · Absätze bleiben
            erhalten
          </small>
        </label>
        <div className="composer-options">
          <label className="composer-field">
            <span>Handschrift</span>
            <select
              value={fontId}
              onChange={event => setFontId(event.target.value)}
            >
              <option value="caveat">Caveat · Beispielhandschrift</option>
              <option value="manrope">Manrope · klar und ruhig</option>
              {data.fonts.map(font => (
                <FontOption key={font.id} font={font} />
              ))}
            </select>
          </label>
          <label className="composer-field">
            <span>Schriftfarbe</span>
            <span className="color-input-wrap">
              <input
                type="color"
                value={color}
                onChange={event => setColor(event.target.value)}
              />
              <code>{color.toUpperCase()}</code>
            </span>
          </label>
          <label className="composer-field">
            <span>Schriftgröße</span>
            <select
              value={fontSize}
              onChange={event => setFontSize(Number(event.target.value))}
            >
              {[22, 24, 26, 28, 30, 32, 36].map(size => (
                <option value={size} key={size}>
                  {size} px
                </option>
              ))}
            </select>
          </label>
          <label className="composer-field composer-paper-field">
            <span>Blatt</span>
            <select
              value={paperId}
              onChange={event => setPaperId(event.target.value)}
            >
              {paperChoices.map(choice => (
                <option value={choice.id} key={choice.id}>
                  {choice.name} · {paperLabels[choice.paper.type]}
                </option>
              ))}
            </select>
            <small>
              Der Text wird bei linierten Blättern automatisch auf die Zeilen
              gesetzt.
            </small>
          </label>
        </div>
        <div className="composer-actions">
          <div>
            <FileText size={18} />
            <span>
              <strong>Bereit zum Generieren</strong>
              <small>Danach kannst du alles noch im Editor anpassen.</small>
            </span>
          </div>
          <button
            className="btn primary composer-generate"
            onClick={generate}
            disabled={!text.trim()}
          >
            <Sparkles size={17} /> Generieren <ChevronRight size={17} />
          </button>
        </div>
      </section>
    </main>
  );
}
