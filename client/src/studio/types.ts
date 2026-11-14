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
  | "custom"
  | "image";
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
  /** Sheet image (built-in path or uploaded data URL) for image papers. */
  background?: string;
  /** Where handwriting sits on an image paper. */
  textLayout?: PaperTextLayout;
}
/** Writing grid of a sheet, all values in millimetres from the page edges. */
export interface PaperTextLayout {
  /** Distance from the top edge to the first writing line. */
  firstLine: number;
  /** Distance between two writing lines. */
  lineSpacing: number;
  insetLeft: number;
  insetRight: number;
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
  /** Fixed elements stay where they are and cannot be dragged or resized. */
  locked?: boolean;
  /** Extra space added to every space character, in page pixels. */
  wordSpacing?: number;
  /** Horizontal letter width in percent (100 = as drawn). */
  widthScale?: number;
  /** Slant in degrees; positive leans to the right. */
  slant?: number;
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
  /** Membership chosen in the demo checkout; stored only on this device. */
  plan: "free" | "pro" | "lifetime";
  planCycle?: "monthly" | "yearly";
}
export const uid = () => crypto.randomUUID();
const sheetDefaults: Omit<PaperSettings, "type" | "background" | "textLayout"> =
  {
    format: "A4",
    width: 210,
    height: 297,
    orientation: "portrait",
    color: "#ffffff",
    lineColor: "#d6d9dc",
    spacing: 6.175,
    lineWidth: 0.2,
    margin: 0,
    header: "",
    footer: "",
    border: false,
    texture: false,
    pageNumbers: false,
  };
/** The standard sheets. Their writing grids were measured from the sheet images. */
export const builtInSheets = {
  lined: {
    ...sheetDefaults,
    type: "image",
    background: "/papers/liniert.jpg",
    spacing: 6.175,
    textLayout: {
      firstLine: 17.7,
      lineSpacing: 6.175,
      insetLeft: 10,
      insetRight: 10,
    },
  },
  dotted: {
    ...sheetDefaults,
    type: "image",
    background: "/papers/punktiert.jpg",
    spacing: 5.644,
    textLayout: {
      firstLine: 22.58,
      lineSpacing: 5.644,
      insetLeft: 16.93,
      insetRight: 11.29,
    },
  },
  grid: {
    ...sheetDefaults,
    type: "image",
    background: "/papers/kariert.jpg",
    spacing: 5.646,
    textLayout: {
      firstLine: 22.42,
      lineSpacing: 5.646,
      insetLeft: 16.77,
      insetRight: 11.12,
    },
  },
} satisfies Record<string, PaperSettings>;
export const basePaper: PaperSettings = builtInSheets.lined;
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
  plan: "free",
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
  image: "Eigenes Blatt",
};
export const builtInTemplates: PaperTemplate[] = [
  {
    id: "sheet-lined",
    name: "Liniert",
    paper: builtInSheets.lined,
    favorite: true,
    builtIn: true,
  },
  {
    id: "sheet-dotted",
    name: "Punktiert",
    paper: builtInSheets.dotted,
    favorite: true,
    builtIn: true,
  },
  {
    id: "sheet-grid",
    name: "Kariert",
    paper: builtInSheets.grid,
    favorite: true,
    builtIn: true,
  },
];

/** Keeps only sheets of the current system: the standard sheets plus uploaded ones. */
export function currentTemplates(
  templates: PaperTemplate[] = []
): PaperTemplate[] {
  const uploaded = templates.filter(
    template =>
      !template.builtIn &&
      template.paper.type === "image" &&
      template.paper.background
  );
  return [...structuredClone(builtInTemplates), ...uploaded];
}
