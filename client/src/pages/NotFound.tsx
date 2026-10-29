import { useEffect } from "react";
import { Link } from "wouter";
import { FileQuestion } from "lucide-react";
import { appCopy as t } from "../studio/locales/app";
export default function NotFound() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    if (window.location.pathname.replace(/\/$/, "") !== "/404")
      window.location.replace("/404");
    return () => meta.remove();
  }, []);
  return (
    <div className="app-loading">
      <FileQuestion size={36} />
      <p className="eyebrow">404</p>
      <h1>{t.pageMissing}</h1>
      <p>{t.missingHint}</p>
      <Link href="/" className="btn primary">
        {t.backOverview}
      </Link>
    </div>
  );
}
