import {
  lazy,
  Suspense,
  useEffect,
  useState,
  Component,
  type ReactNode,
} from "react";
import { Route, Switch, Link, useLocation } from "wouter";
import { Toaster } from "sonner";
import {
  LayoutDashboard,
  Type,
  PenLine,
  FileText,
  Layers3,
  PanelsTopLeft,
  Settings2,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Sun,
  Moon,
  Check,
  ShieldCheck,
  Loader2,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import { StudioProvider, useStudio, saveStatusLabels } from "./studio/store";
import { de, appCopy as c } from "./studio/locales/app";
import { Brand } from "./studio/components";
import NotFound from "./pages/NotFound";
import Dashboard, { HelpModal } from "./studio/Dashboard";
import Documents from "./studio/Documents";
const FontStudio = lazy(() => import("./studio/FontStudio"));
const FontsPage = lazy(() =>
  import("./studio/FontStudio").then(m => ({ default: m.FontsPage }))
);
const Editor = lazy(() => import("./studio/Editor"));
const DocumentComposer = lazy(() => import("./studio/DocumentComposer"));
const PaperStudio = lazy(() => import("./studio/PaperStudio"));
const TemplatesPage = lazy(() =>
  import("./studio/PaperStudio").then(m => ({ default: m.TemplatesPage }))
);
const Settings = lazy(() => import("./studio/Settings"));
const navItems = [
  { path: "/", title: de.overview, icon: LayoutDashboard },
  { path: "/schriften", title: de.fonts, icon: Type },
  { path: "/schrift-erstellen", title: de.createFont, icon: PenLine },
  { path: "/dokumente", title: de.documents, icon: FileText },
  { path: "/papierstudio", title: de.paper, icon: PanelsTopLeft },
  { path: "/vorlagen", title: de.templates, icon: Layers3 },
];
function Shell() {
  const [location, navigate] = useLocation();
  const {
    settings,
    updateSettings,
    loaded,
    loadError,
    retryLoad,
    saveStatus,
    flushSave,
    data,
  } = useStudio();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [startApplied, setStartApplied] = useState(false);
  const compact = settings.sidebarCollapsed;
  const title =
    navItems.find(n => n.path !== "/" && location.startsWith(n.path))?.title ||
    (location.startsWith("/einstellungen") ? de.settings : de.overview);
  const isEditor = /^\/dokumente\/.+/.test(location);
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);
  useEffect(() => {
    if (loaded && !startApplied) {
      setStartApplied(true);
      if (
        location === "/" &&
        settings.startScreen !== "/" &&
        navItems.some(n => n.path === settings.startScreen)
      )
        navigate(settings.startScreen);
    }
  }, [loaded, startApplied, settings.startScreen, navigate, location]);
  if (loadError)
    return (
      <div className="app-loading">
        <AlertCircle size={32} />
        <h1>{c.loadTitle}</h1>
        <p>{c.loadHint}</p>
        <button className="btn primary" onClick={retryLoad}>
          {c.retry}
        </button>
      </div>
    );
  if (!loaded)
    return (
      <div className="app-loading">
        <Brand />
        <Loader2 className="spin" size={24} />
        <p>{de.loading}</p>
      </div>
    );
  return (
    <div
      className={`app-shell ${compact ? "sidebar-collapsed" : ""} ${isEditor ? "editor-shell" : ""}`}
    >
      {mobileOpen && (
        <button
          className="mobile-overlay"
          aria-label={de.close}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <Link
          href="/"
          className="brand-link"
          aria-label="Scriptly Studio – Übersicht"
        >
          <Brand compact={compact} />
        </Link>
        <button
          className="mobile-close icon-btn"
          aria-label={de.close}
          onClick={() => setMobileOpen(false)}
        >
          <X size={20} />
        </button>
        <p className="nav-eyebrow">{de.workspace}</p>
        <nav aria-label="Hauptnavigation">
          {navItems.map(({ path, title, icon: Icon }, index) => (
            <Link
              href={path}
              key={path}
              aria-label={title}
              title={compact ? title : undefined}
              aria-current={
                (path === "/" ? location === "/" : location.startsWith(path))
                  ? "page"
                  : undefined
              }
              className={`nav-link ${(path === "/" ? location === "/" : location.startsWith(path)) ? "active" : ""} ${index === 4 ? "nav-after-divider" : ""}`}
            >
              <Icon size={19} strokeWidth={1.6} />
              <span>{title}</span>
              {path === "/dokumente" && data.documents.length > 0 && (
                <small aria-hidden="true">{data.documents.length}</small>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="sidebar-note-icon">
              <PenLine size={19} />
            </span>
            <strong>{c.sidebarTitle}</strong>
            <p>{c.sidebarHint}</p>
            <Link href="/schrift-erstellen">
              {c.tryNow}
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link
            href="/einstellungen"
            className={`nav-link ${location === "/einstellungen" ? "active" : ""}`}
            title={compact ? de.settings : undefined}
          >
            <Settings2 size={19} strokeWidth={1.6} />
            <span>{de.settings}</span>
          </Link>
          <button
            className="nav-link"
            onClick={() => setHelp(true)}
            title={compact ? de.help : undefined}
          >
            <HelpCircle size={19} strokeWidth={1.6} />
            <span>{de.help}</span>
          </button>
          <div className="local-storage-indicator">
            <ShieldCheck size={13} />
            <span>{de.local}</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn desktop-collapse"
              onClick={() => updateSettings({ sidebarCollapsed: !compact })}
              aria-label={compact ? de.expand : de.collapse}
            >
              {compact ? (
                <PanelLeftOpen size={19} />
              ) : (
                <PanelLeftClose size={19} />
              )}
            </button>
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label={de.menu}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              {c.atelier}
              <span>/</span>
              <strong>{title}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <button
              className={`save-status ${saveStatus}`}
              onClick={() => {
                if (saveStatus === "error") void flushSave().catch(() => {});
              }}
              title={saveStatus === "error" ? c.saveRetry : de.local}
              disabled={saveStatus !== "error"}
            >
              {saveStatus === "saved" ? (
                <Check size={14} />
              ) : saveStatus === "saving" ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <AlertCircle size={14} />
              )}
              <span>{saveStatusLabels[saveStatus]}</span>
            </button>
            <span className="topbar-divider" />
            <button
              className="icon-btn"
              aria-label={de.theme}
              title={settings.theme === "light" ? c.darkMode : c.lightMode}
              onClick={() =>
                updateSettings({
                  theme: settings.theme === "light" ? "dark" : "light",
                })
              }
            >
              {settings.theme === "light" ? (
                <Moon size={18} />
              ) : (
                <Sun size={18} />
              )}
            </button>
            <Link
              href="/einstellungen"
              className="user-avatar"
              aria-label={de.settings}
            >
              {settings.name ? settings.name[0].toUpperCase() : "Du"}
            </Link>
          </div>
        </header>
        <main className="main-content">
          <Suspense
            fallback={
              <div className="page-loading">
                <Loader2 size={23} className="spin" />
                <p>{c.pageLoading}</p>
              </div>
            }
          >
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/schriften" component={FontsPage} />
              <Route path="/schrift-erstellen">{() => <FontStudio />}</Route>
              <Route path="/schriften/:id">
                {p => <FontStudio projectId={p.id} />}
              </Route>
              <Route path="/dokumente" component={Documents} />
              <Route path="/dokumente/neu" component={DocumentComposer} />
              <Route path="/dokumente/:id">
                {p => <Editor documentId={p.id} />}
              </Route>
              <Route path="/papierstudio">{() => <PaperStudio />}</Route>
              <Route path="/papierstudio/:id">
                {p => <PaperStudio templateId={p.id} />}
              </Route>
              <Route path="/vorlagen" component={TemplatesPage} />
              <Route path="/einstellungen" component={Settings} />
              <Route path="/404" component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </main>
      </div>
      <HelpModal open={help} onClose={() => setHelp(false)} />
      <Toaster
        position="bottom-right"
        richColors
        theme={settings.theme}
        closeButton
      />
    </div>
  );
}
class StudioErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="app-loading">
        <h1>{c.errorTitle}</h1>
        <p>{c.errorHint}</p>
        <button
          className="btn primary"
          onClick={() => window.location.reload()}
        >
          {c.reload}
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <StudioErrorBoundary>
      <StudioProvider>
        <Shell />
      </StudioProvider>
    </StudioErrorBoundary>
  );
}
