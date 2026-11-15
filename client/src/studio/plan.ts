export type PlanId = "free" | "pro" | "lifetime";
export type BillingCycle = "monthly" | "yearly";

export interface PlanFeature {
  label: string;
  /** Features that do not exist in the app yet are shown as announced, never as included. */
  soon?: boolean;
}

export interface PlanLimits {
  /** Own handwritings. */
  fonts: number;
  /** Uploaded sheets in the Papier-Studio. */
  sheets: number;
  /** Drawn variants per character. */
  variants: number;
  /** Pages per document. */
  pages: number;
  /** Highest export resolution. */
  dpi: number;
  /** PNG and JPEG export besides GoodNotes. */
  imageExport: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  prices: Partial<Record<BillingCycle | "once", number>>;
  features: PlanFeature[];
  limits: PlanLimits;
}

const unlimited: PlanLimits = {
  fonts: Infinity,
  sheets: Infinity,
  variants: 3,
  pages: Infinity,
  dpi: 300,
  imageExport: true,
};

/**
 * Test plans for the demo checkout. Nothing is charged anywhere. Every feature
 * listed without "soon" is enforced in the app through the limits below.
 */
export const plans: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Zum Ausprobieren",
    prices: {},
    limits: {
      fonts: 1,
      sheets: 1,
      variants: 1,
      pages: 3,
      dpi: 150,
      imageExport: false,
    },
    features: [
      { label: "1 eigene Handschrift" },
      { label: "1 Variante pro Buchstabe" },
      { label: "1 eigenes Blatt im Papier-Studio" },
      { label: "Dokumente mit bis zu 3 Seiten" },
      { label: "GoodNotes-Export in 150 dpi" },
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Für alle, die viel schreiben",
    prices: { monthly: 4.99, yearly: 39.99 },
    limits: unlimited,
    features: [
      { label: "Unbegrenzt viele Handschriften" },
      { label: "3 Varianten pro Buchstabe, die sich automatisch abwechseln" },
      { label: "Unbegrenzt viele eigene Blätter" },
      { label: "Dokumente ohne Seitenlimit" },
      { label: "GoodNotes-Export in 300 dpi" },
      { label: "Zusätzlicher Export als PNG und JPEG" },
      { label: "SVG-Export", soon: true },
      { label: "Cloud-Sync und Backup für iPad, Handy und PC", soon: true },
      { label: "Werbefrei und Prioritäts-Support", soon: true },
    ],
  },
  lifetime: {
    id: "lifetime",
    name: "Lifetime",
    tagline: "Creator Edition, einmal zahlen",
    prices: { once: 89 },
    limits: unlimited,
    features: [
      { label: "Alle Pro-Funktionen, dauerhaft freigeschaltet" },
      { label: "Kein laufendes Abo, keine Verlängerung" },
      { label: "Alle künftigen Pro-Funktionen ohne Aufpreis" },
      { label: "Vorlagen mit Freunden und der Klasse teilen", soon: true },
      { label: "Spezielle Schul-Lineaturen", soon: true },
    ],
  },
};

export function planLimits(plan: PlanId | undefined) {
  return plans[plan ?? "free"]?.limits ?? plans.free.limits;
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
