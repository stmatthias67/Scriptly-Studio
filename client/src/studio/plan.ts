export type PlanId = "free" | "pro" | "lifetime";
export type BillingCycle = "monthly" | "yearly";

export interface PlanFeature {
  label: string;
  /** Features that do not exist in the app yet are shown as announced, never as included. */
  soon?: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  prices: Partial<Record<BillingCycle | "once", number>>;
  features: PlanFeature[];
  limits: { fonts: number; sheets: number };
}

/** Test prices for the demo checkout. Nothing is charged anywhere. */
export const plans: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Zum Ausprobieren",
    prices: {},
    limits: { fonts: 2, sheets: 1 },
    features: [
      { label: "2 eigene Handschriften" },
      { label: "1 eigenes Blatt im Papier-Studio" },
      { label: "Die drei Standardblätter" },
      { label: "PDF-Export für GoodNotes" },
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Für alle, die viel schreiben",
    prices: { monthly: 4.99, yearly: 39.99 },
    limits: { fonts: Infinity, sheets: Infinity },
    features: [
      { label: "Unbegrenzt viele Handschriften" },
      { label: "Unbegrenzt viele eigene Blätter" },
      { label: "Feines Raster: Zeilenabstand auf 0,05 mm genau" },
      { label: "Export in 300 dpi, PNG und JPEG" },
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
    limits: { fonts: Infinity, sheets: Infinity },
    features: [
      { label: "Alles aus Pro, dauerhaft freigeschaltet" },
      { label: "Kein laufendes Abo" },
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
