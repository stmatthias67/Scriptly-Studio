import { useEffect, useRef, useState } from "react";
import {
  Sun,
  Moon,
  Check,
  Download,
  Upload,
  ShieldCheck,
  HardDrive,
  RotateCcw,
  Settings2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useStudio } from "./store";
import { de } from "./locales/app";
import { settingsText as t } from "./locales/settings";
import { Field } from "./components";
import { PaperControls } from "./PaperControls";
import { defaultSettings } from "./types";
import { backupJson, validateBackup } from "./storage";
const accentColors = [
  { color: "#315c4c", name: "Waldgrün" },
  { color: "#725965", name: "Malve" },
  { color: "#586779", name: "Schieferblau" },
  { color: "#8d6742", name: "Karamell" },
  { color: "#55534a", name: "Graphit" },
];
export default function Settings() {
  const { data, settings, updateSettings, replaceData } = useStudio();
  const file = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);
  const [storage, setStorage] = useState("");
  useEffect(() => {
    navigator.storage
      ?.estimate()
      .then(estimate =>
        setStorage(
          `${((estimate.usage || 0) / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB belegt`
        )
      )
      .catch(() => {});
  }, [data]);
  function downloadBackup() {
    const url = URL.createObjectURL(
      new Blob([backupJson(data)], { type: "application/json" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Scriptly-Sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast.success(t.backupSuccess);
  }
  async function restoreBackup(input: File | undefined) {
    if (!input) return;
    if (input.size > 30 * 1024 * 1024) {
      toast.error(t.largeBackup);
      return;
    }
    setRestoring(true);
    try {
      const restored = validateBackup(JSON.parse(await input.text()));
      if (!confirm(t.restoreConfirm)) return;
      await replaceData(restored);
      toast.success(t.restoreSuccess);
    } catch {
      toast.error(t.invalidBackup);
    } finally {
      setRestoring(false);
      if (file.current) file.current.value = "";
    }
  }
  return (
    <div className="content-width settings-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p className="muted">{t.subtitle}</p>
        </div>
        <span className="tag">
          <ShieldCheck size={14} />
          {t.localOnly}
        </span>
      </div>
      <div className="settings-layout">
        <div className="settings-main">
          <section className="settings-card">
            <div className="settings-section-heading">
              <UserRound size={19} />
              <div>
                <h2>{t.profile}</h2>
                <p>{t.profileDescription}</p>
              </div>
            </div>
            <Field label={t.name}>
              <input
                value={settings.name}
                onChange={e =>
                  updateSettings({ name: e.target.value.slice(0, 40) })
                }
                placeholder={t.namePlaceholder}
                maxLength={40}
              />
            </Field>
          </section>
          <section className="settings-card">
            <div className="settings-section-heading">
              <Settings2 size={19} />
              <h2>{t.appearance}</h2>
            </div>
            <div className="field">
              <span>{t.theme}</span>
              <div className="theme-options">
                <button
                  className={`theme-card ${settings.theme === "light" ? "active" : ""}`}
                  onClick={() => updateSettings({ theme: "light" })}
                >
                  <div className="theme-mini light">
                    <span />
                    <div />
                  </div>
                  <span>
                    <Sun size={15} />
                    {t.light}
                    {settings.theme === "light" && <Check size={15} />}
                  </span>
                </button>
                <button
                  className={`theme-card ${settings.theme === "dark" ? "active" : ""}`}
                  onClick={() => updateSettings({ theme: "dark" })}
                >
                  <div className="theme-mini dark">
                    <span />
                    <div />
                  </div>
                  <span>
                    <Moon size={15} />
                    {t.dark}
                    {settings.theme === "dark" && <Check size={15} />}
                  </span>
                </button>
              </div>
            </div>
            <div className="field">
              <span>{t.accent}</span>
              <div className="color-palette">
                {accentColors.map(({ color, name }) => (
                  <button
                    key={color}
                    className={`color-swatch ${settings.accent === color ? "selected" : ""}`}
                    style={{ background: color }}
                    aria-label={name}
                    onClick={() => updateSettings({ accent: color })}
                  >
                    {settings.accent === color && <Check size={15} />}
                  </button>
                ))}
                <input
                  type="color"
                  value={settings.accent}
                  aria-label={t.customAccent}
                  onChange={e => updateSettings({ accent: e.target.value })}
                />
              </div>
            </div>
            <div className="settings-fields">
              <Field label={t.density}>
                <select
                  value={settings.density}
                  onChange={e =>
                    updateSettings({
                      density: e.target.value as "comfortable" | "compact",
                    })
                  }
                >
                  <option value="comfortable">{t.comfortable}</option>
                  <option value="compact">{t.compact}</option>
                </select>
              </Field>
              <Field label={t.start}>
                <select
                  value={settings.startScreen}
                  onChange={e =>
                    updateSettings({ startScreen: e.target.value })
                  }
                >
                  <option value="/">{de.overview}</option>
                  <option value="/dokumente">{de.documents}</option>
                  <option value="/schriften">{de.fonts}</option>
                  <option value="/papierstudio">{de.paper}</option>
                  <option value="/vorlagen">{de.templates}</option>
                </select>
              </Field>
            </div>
            <label className="toggle-row">
              <span>{t.sidebar}</span>
              <input
                type="checkbox"
                role="switch"
                checked={settings.sidebarCollapsed}
                onChange={e =>
                  updateSettings({ sidebarCollapsed: e.target.checked })
                }
              />
            </label>
            <label className="toggle-row">
              <span>
                {t.shortcuts}
                <small>
                  Strg/⌘ + Z · Rückgängig, Strg/⌘ + Umschalt + Z · Wiederholen
                </small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={settings.shortcuts}
                onChange={e => updateSettings({ shortcuts: e.target.checked })}
              />
            </label>
          </section>
          <section className="settings-card">
            <div className="settings-section-heading">
              <PenIcon />
              <div>
                <h2>{t.defaults}</h2>
                <p>{t.defaultsDescription}</p>
              </div>
            </div>
            <div className="settings-fields">
              <Field label={t.font}>
                <select
                  value={settings.defaultFontId}
                  onChange={e =>
                    updateSettings({ defaultFontId: e.target.value })
                  }
                >
                  <option value="caveat">{t.fontExample}</option>
                  <option value="manrope">{t.interfaceFont}</option>
                  {data.fonts.map(font => (
                    <option key={font.id} value={font.id}>
                      {font.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t.size}>
                <input
                  type="number"
                  min={8}
                  max={150}
                  value={settings.defaultFontSize}
                  onChange={e =>
                    updateSettings({
                      defaultFontSize: Math.max(
                        8,
                        Math.min(150, Number(e.target.value) || 8)
                      ),
                    })
                  }
                />
              </Field>
              <Field label={t.color}>
                <input
                  type="color"
                  value={settings.defaultColor}
                  onChange={e =>
                    updateSettings({ defaultColor: e.target.value })
                  }
                />
              </Field>
              <Field label={t.lineHeight}>
                <input
                  type="number"
                  step={0.1}
                  min={0.8}
                  max={3}
                  value={settings.defaultLineHeight}
                  onChange={e =>
                    updateSettings({
                      defaultLineHeight: Math.max(
                        0.8,
                        Math.min(3, Number(e.target.value) || 1.5)
                      ),
                    })
                  }
                />
              </Field>
            </div>
            <div className="defaults-paper">
              <PaperControls
                paper={settings.defaultPaper}
                onChange={defaultPaper => updateSettings({ defaultPaper })}
                compact
              />
            </div>
          </section>
          <button
            className="btn secondary"
            onClick={() => {
              if (confirm(t.resetConfirm)) {
                updateSettings(structuredClone(defaultSettings));
                toast.success(t.resetSuccess);
              }
            }}
          >
            <RotateCcw size={16} />
            {t.reset}
          </button>
        </div>
        <aside className="settings-aside">
          <section className="privacy-card">
            <span className="privacy-icon">
              <ShieldCheck size={27} strokeWidth={1.5} />
            </span>
            <h2>{t.privacyTitle}</h2>
            <p>{t.privacy}</p>
            <div className="privacy-rule" />
            <h3>Eine Kopie für alle Fälle.</h3>
            <p>{t.backupDescription}</p>
            <button className="btn primary" onClick={downloadBackup}>
              <Download size={16} />
              {t.backup}
            </button>
            <button
              className="btn secondary"
              disabled={restoring}
              onClick={() => file.current?.click()}
            >
              <Upload size={16} />
              {restoring ? t.restoring : t.restore}
            </button>
            <input
              hidden
              ref={file}
              type="file"
              accept=".json,application/json"
              onChange={e => void restoreBackup(e.target.files?.[0])}
            />
          </section>
          <section className="storage-card">
            <HardDrive size={18} />
            <h3>{t.storage}</h3>
            <p>{storage || t.storageUnavailable}</p>
            <button
              className="text-link"
              onClick={async () => {
                try {
                  const granted = await navigator.storage?.persist?.();
                  toast.info(granted ? t.persistGranted : t.persistDenied);
                } catch {
                  toast.info(t.persistDenied);
                }
              }}
            >
              {t.persist}
              <Check size={14} />
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
function PenIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="m16 3 5 5-13 13H3v-5zM14 5l5 5" />
    </svg>
  );
}
