export type PaperType =
  | "blank"
  | "lined"
  | "grid"
  | "dotted"
  | "cornell"
  | "todo"
  | "weekly"
  | "daily"
  | "study"
  | "journal"
  | "custom";
export type PageFormat = "A4" | "A5" | "Letter" | "custom";
export interface PaperSettings {
  type: PaperType;
  format: PageFormat;
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
  color: string;
  lineColor: string;
  spacing: number;
  lineWidth: number;
  margin: number;
  header: string;
  footer: string;
  border: boolean;
  texture: boolean;
  pageNumbers: boolean;
}
export interface PageElement {
  id: string;
  type:
    | "text"
    | "image"
    | "rectangle"
    | "ellipse"
    | "line"
    | "arrow"
    | "checkbox"
    | "highlight";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text: string;
  fontId: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  paragraphSpacing: number;
  src?: string;
  checked?: boolean;
}
export interface StudioPage {
  id: string;
  paper: PaperSettings;
  elements: PageElement[];
}
export interface StudioDocument {
  id: string;
  title: string;
  pages: StudioPage[];
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
}
export interface Point {
  x: number;
  y: number;
  pressure?: number;
}
export interface Stroke {
  points: Point[];
  width: number;
}
export interface Glyph {
  variants: Stroke[][];
}
export interface FontSettings {
  spacing: number;
  wordSpacing: number;
  width: number;
  slant: number;
  baseline: number;
  smoothness: number;
  variation: number;
  size: number;
}
export interface FontProject {
  id: string;
  name: string;
  glyphs: Record<string, Glyph>;
  settings: FontSettings;
  createdAt: number;
  updatedAt: number;
}
export interface PaperTemplate {
  id: string;
  name: string;
  paper: PaperSettings;
  favorite: boolean;
  builtIn?: boolean;
}
export interface StudioData {
  documents: StudioDocument[];
  fonts: FontProject[];
  templates: PaperTemplate[];
}
export interface StudioSettings {
  name: string;
  theme: "light" | "dark";
  accent: string;
  density: "comfortable" | "compact";
  sidebarCollapsed: boolean;
  startScreen: string;
  shortcuts: boolean;
  defaultFontId: string;
  defaultFontSize: number;
  defaultColor: string;
  defaultLineHeight: number;
  defaultPaper: PaperSettings;
}
export const uid = () => crypto.randomUUID();
export const basePaper: PaperSettings = {
  type: "dotted",
  format: "A4",
  width: 210,
  height: 297,
  orientation: "portrait",
  color: "#fffdf8",
  lineColor: "#b9c4b9",
  spacing: 7,
  lineWidth: 0.25,
  margin: 18,
  header: "",
  footer: "",
  border: false,
  texture: false,
  pageNumbers: false,
};
export const defaultFontSettings: FontSettings = {
  spacing: 25,
  wordSpacing: 280,
  width: 100,
  slant: 0,
  baseline: 300,
  smoothness: 0,
  variation: 0,
  size: 100,
};
export const defaultSettings: StudioSettings = {
  name: "",
  theme: "light",
  accent: "#315c4c",
  density: "comfortable",
  sidebarCollapsed: false,
  startScreen: "/",
  shortcuts: true,
  defaultFontId: "caveat",
  defaultFontSize: 28,
  defaultColor: "#354c43",
  defaultLineHeight: 1.5,
  defaultPaper: basePaper,
};
export function paperDimensions(paper: PaperSettings) {
  const sizes: Record<PageFormat, [number, number]> = {
    A4: [210, 297],
    A5: [148, 210],
    Letter: [215.9, 279.4],
    custom: [paper.width, paper.height],
  };
  const [w, h] = sizes[paper.format];
  return paper.orientation === "landscape"
    ? { width: Math.max(w, h), height: Math.min(w, h) }
    : { width: Math.min(w, h), height: Math.max(w, h) };
}
export function createPage(paper: PaperSettings = basePaper): StudioPage {
  return { id: uid(), paper: structuredClone(paper), elements: [] };
}
export function createText(
  settings: StudioSettings = defaultSettings,
  x = 68,
  y = 90
): PageElement {
  return {
    id: uid(),
    type: "text",
    x,
    y,
    width: 580,
    height: 150,
    rotation: 0,
    text: "Deine Gedanken beginnen hier.",
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
}
export const paperLabels: Record<PaperType, string> = {
  blank: "Blanko",
  lined: "Liniert",
  grid: "Kariert",
  dotted: "Gepunktet",
  cornell: "Cornell-Notizen",
  todo: "Aufgabenliste",
  weekly: "Wochenplaner",
  daily: "Tagesplaner",
  study: "Lernnotizen",
  journal: "Journal",
  custom: "Eigenes Layout",
};
export const builtInTemplates: PaperTemplate[] = [
  {
    id: "builtin-dots",
    name: "Kleine Gedanken",
    paper: { ...basePaper, type: "dotted" },
    favorite: true,
    builtIn: true,
  },
  {
    id: "builtin-lined",
    name: "Zeile für Zeile",
    paper: { ...basePaper, type: "lined", color: "#faf8f2", spacing: 8 },
    favorite: true,
    builtIn: true,
  },
  {
    id: "builtin-cornell",
    name: "Wissen sammeln",
    paper: { ...basePaper, type: "cornell", color: "#f5f7f3" },
    favorite: false,
    builtIn: true,
  },
  {
    id: "builtin-week",
    name: "Eine gute Woche",
    paper: {
      ...basePaper,
      type: "weekly",
      color: "#f9f5fa",
      orientation: "landscape",
    },
    favorite: true,
    builtIn: true,
  },
  {
    id: "builtin-grid",
    name: "Raum für Ideen",
    paper: { ...basePaper, type: "grid", spacing: 5, color: "#f6f5f0" },
    favorite: false,
    builtIn: true,
  },
  {
    id: "builtin-journal",
    name: "Für mich",
    paper: { ...basePaper, type: "journal", color: "#fcf5eb" },
    favorite: false,
    builtIn: true,
  },
];
