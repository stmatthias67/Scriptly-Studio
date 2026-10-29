import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  basePaper,
  builtInTemplates,
  createPage,
  defaultFontSettings,
  defaultSettings,
  uid,
  type FontProject,
  type PaperSettings,
  type PaperTemplate,
  type StudioData,
  type StudioDocument,
  type StudioSettings,
} from "./types";
import { readWorkspace, writeWorkspace } from "./storage";
import { de, appCopy as c } from "./locales/app";

type SaveStatus = "saving" | "saved" | "error";
interface StudioContextValue {
  data: StudioData;
  settings: StudioSettings;
  loaded: boolean;
  loadError: boolean;
  saveStatus: SaveStatus;
  retryLoad: () => void;
  flushSave: () => Promise<void>;
  updateSettings: (patch: Partial<StudioSettings>) => void;
  createDocument: (paper?: PaperSettings) => StudioDocument;
  updateDocument: (doc: StudioDocument) => void;
  deleteDocument: (id: string) => void;
  duplicateDocument: (id: string) => StudioDocument | undefined;
  createFont: (name?: string) => FontProject;
  updateFont: (font: FontProject) => void;
  deleteFont: (id: string) => void;
  updateTemplate: (template: PaperTemplate) => void;
  deleteTemplate: (id: string) => void;
  replaceData: (data: StudioData) => Promise<void>;
}
const Context = createContext<StudioContextValue | null>(null);
const initialData = (): StudioData => ({
  documents: [],
  fonts: [],
  templates: structuredClone(builtInTemplates),
});
function loadSettings(): StudioSettings {
  try {
    const raw = JSON.parse(localStorage.getItem("scriptly-settings") || "null");
    if (!raw || typeof raw !== "object")
      return structuredClone(defaultSettings);
    return {
      ...structuredClone(defaultSettings),
      ...raw,
      defaultPaper: { ...basePaper, ...raw.defaultPaper },
      theme: raw.theme === "dark" ? "dark" : "light",
      accent: /^#[0-9a-f]{6}$/i.test(raw.accent)
        ? raw.accent
        : defaultSettings.accent,
    };
  } catch {
    return structuredClone(defaultSettings);
  }
}
export function StudioProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StudioData>(initialData);
  const [settings, setSettings] = useState<StudioSettings>(loadSettings);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const dataRef = useRef(data);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirty = useRef(false);
  const generation = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  dataRef.current = data;
  useEffect(() => {
    let live = true;
    setLoadError(false);
    readWorkspace()
      .then(saved => {
        if (live) {
          if (saved) {
            dataRef.current = saved;
            setData(saved);
          }
          setLoaded(true);
        }
      })
      .catch(() => {
        if (live) setLoadError(true);
      });
    return () => {
      live = false;
    };
  }, [loadAttempt]);
  const flushSave = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const snapshot = dataRef.current;
    const revision = generation.current;
    setSaveStatus("saving");
    const write = queue.current
      .catch(() => {})
      .then(() => writeWorkspace(snapshot));
    queue.current = write;
    try {
      await write;
      if (revision === generation.current) {
        dirty.current = false;
        setSaveStatus("saved");
      }
    } catch (error) {
      setSaveStatus("error");
      toast.error(c.backupStorageError);
      throw error;
    }
  }, []);
  useEffect(() => {
    if (!loaded || !dirty.current) return;
    setSaveStatus("saving");
    timer.current = setTimeout(() => {
      void flushSave().catch(() => {});
    }, 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data, loaded, flushSave]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const visibility = () => {
      if (document.visibilityState === "hidden" && dirty.current && loaded)
        void flushSave().catch(() => {});
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [loaded, flushSave]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.classList.toggle(
      "dark",
      settings.theme === "dark"
    );
    document.documentElement.style.setProperty("--accent", settings.accent);
    const channels = (
      settings.accent.slice(1).match(/[0-9a-f]{2}/gi) || ["31", "5c", "4c"]
    ).map(value => Number.parseInt(value, 16) / 255);
    const linear = channels.map(value =>
      value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
    );
    const luminance =
      linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    document.documentElement.style.setProperty(
      "--accent-foreground",
      luminance > 0.32 ? "#213529" : "#ffffff"
    );
    document.documentElement.style.setProperty(
      "--accent-ink",
      settings.theme === "dark" && luminance < 0.25
        ? "#bfd3c5"
        : luminance > 0.55
          ? "#263c32"
          : settings.accent
    );
    document.documentElement.dataset.density = settings.density;
  }, [settings]);
  function mutate(fn: (current: StudioData) => StudioData) {
    const next = fn(dataRef.current);
    dataRef.current = next;
    dirty.current = true;
    generation.current += 1;
    setSaveStatus("saving");
    setData(next);
  }
  function updateSettings(patch: Partial<StudioSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      localStorage.setItem("scriptly-settings", JSON.stringify(next));
    } catch {
      toast.error(c.preferencesError);
    }
  }
  function createDocument(paper = settings.defaultPaper) {
    const doc: StudioDocument = {
      id: uid(),
      title: c.untitled,
      pages: [createPage(paper)],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      favorite: false,
    };
    mutate(d => ({ ...d, documents: [doc, ...d.documents] }));
    return doc;
  }
  function updateDocument(doc: StudioDocument) {
    const updated = { ...doc, updatedAt: Date.now() };
    mutate(d => ({
      ...d,
      documents: d.documents.some(x => x.id === doc.id)
        ? d.documents.map(x => (x.id === doc.id ? updated : x))
        : [updated, ...d.documents],
    }));
  }
  function deleteDocument(id: string) {
    mutate(d => ({ ...d, documents: d.documents.filter(x => x.id !== id) }));
  }
  function duplicateDocument(id: string) {
    const original = dataRef.current.documents.find(d => d.id === id);
    if (!original) return;
    const doc = {
      ...structuredClone(original),
      id: uid(),
      title: `${original.title.slice(0, 92)} – Kopie`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      favorite: false,
    };
    doc.pages = doc.pages.map(p => ({
      ...p,
      id: uid(),
      elements: p.elements.map(e => ({ ...e, id: uid() })),
    }));
    mutate(d => ({ ...d, documents: [doc, ...d.documents] }));
    return doc;
  }
  function createFont(name = c.defaultFontName) {
    const font: FontProject = {
      id: uid(),
      name,
      glyphs: {},
      settings: { ...defaultFontSettings },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    mutate(d => ({ ...d, fonts: [font, ...d.fonts] }));
    return font;
  }
  function updateFont(font: FontProject) {
    const updated = { ...font, updatedAt: Date.now() };
    mutate(d => ({
      ...d,
      fonts: d.fonts.some(f => f.id === font.id)
        ? d.fonts.map(f => (f.id === font.id ? updated : f))
        : [updated, ...d.fonts],
    }));
  }
  function deleteFont(id: string) {
    mutate(d => ({ ...d, fonts: d.fonts.filter(f => f.id !== id) }));
  }
  function updateTemplate(template: PaperTemplate) {
    mutate(d => ({
      ...d,
      templates: d.templates.some(t => t.id === template.id)
        ? d.templates.map(t => (t.id === template.id ? template : t))
        : [template, ...d.templates],
    }));
  }
  function deleteTemplate(id: string) {
    mutate(d => ({ ...d, templates: d.templates.filter(t => t.id !== id) }));
  }
  async function replaceData(next: StudioData) {
    if (timer.current) clearTimeout(timer.current);
    await queue.current.catch(() => {});
    await writeWorkspace(next);
    dataRef.current = next;
    dirty.current = false;
    generation.current += 1;
    setData(next);
    setSaveStatus("saved");
  }
  return (
    <Context.Provider
      value={{
        data,
        settings,
        loaded,
        loadError,
        saveStatus,
        retryLoad: () => setLoadAttempt(v => v + 1),
        flushSave,
        updateSettings,
        createDocument,
        updateDocument,
        deleteDocument,
        duplicateDocument,
        createFont,
        updateFont,
        deleteFont,
        updateTemplate,
        deleteTemplate,
        replaceData,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStudio() {
  const context = useContext(Context);
  if (!context) throw new Error("StudioProvider fehlt.");
  return context;
}
export const saveStatusLabels: Record<SaveStatus, string> = {
  saved: de.saved,
  saving: de.saving,
  error: de.saveError,
};
