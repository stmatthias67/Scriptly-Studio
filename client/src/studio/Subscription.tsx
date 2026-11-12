import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  FlaskConical,
  LoaderCircle,
  Smartphone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./components";
import { useStudio } from "./store";
import {
  formatPrice,
  plans,
  type BillingCycle,
  type Plan,
  type PlanId,
} from "./plan";
import "./Subscription.css";

type PaymentMethod = "google-play" | "card" | "paypal";
type Step = "method" | "confirm" | "processing" | "done";

interface Checkout {
  plan: Plan;
  cycle: BillingCycle | "once";
}

const methods: Array<{
  id: PaymentMethod;
  label: string;
  hint: string;
  icon: typeof CreditCard;
}> = [
  {
    id: "google-play",
    label: "Google Play (Test)",
    hint: "Simuliert den Kauf über das Play-Store-Konto",
    icon: Smartphone,
  },
  {
    id: "card",
    label: "Kreditkarte (Test)",
    hint: "Feste Testkarte, es werden keine echten Kartendaten abgefragt",
    icon: CreditCard,
  },
  {
    id: "paypal",
    label: "PayPal (Test)",
    hint: "Simuliert die Weiterleitung und Freigabe",
    icon: Wallet,
  },
];

function priceFor(plan: Plan, cycle: BillingCycle | "once") {
  return plan.prices[cycle] ?? 0;
}

function cycleLabel(cycle: BillingCycle | "once") {
  if (cycle === "monthly") return "pro Monat";
  if (cycle === "yearly") return "pro Jahr";
  return "einmalig";
}

/**
 * A complete purchase flow that only simulates payment. Nothing is charged and no
 * payment data is entered, stored or sent; the chosen plan is saved on this device.
 */
function CheckoutDialog({
  checkout,
  onClose,
}: {
  checkout: Checkout | null;
  onClose: () => void;
}) {
  const { updateSettings } = useStudio();
  const [method, setMethod] = useState<PaymentMethod>("google-play");
  const [step, setStep] = useState<Step>("method");
  const [reference, setReference] = useState("");

  const close = () => {
    if (step === "processing") return;
    setStep("method");
    onClose();
  };

  const pay = () => {
    if (!checkout) return;
    setStep("processing");
    window.setTimeout(() => {
      updateSettings({
        plan: checkout.plan.id,
        planCycle: checkout.cycle === "once" ? undefined : checkout.cycle,
      });
      setReference(`TEST-${Date.now().toString(36).toUpperCase()}`);
      setStep("done");
    }, 1400);
  };

  if (!checkout) return null;
  const price = priceFor(checkout.plan, checkout.cycle);
  const methodLabel = methods.find(entry => entry.id === method)?.label ?? "";

  return (
    <Modal open onClose={close} title={`${checkout.plan.name} kaufen`}>
      <div className="checkout">
        <p className="checkout-test-banner">
          <FlaskConical size={16} />
          Testmodus: Es wird nichts abgebucht, und keine Zahlungsdaten verlassen
          dieses Gerät.
        </p>

        <div className="checkout-summary">
          <div>
            <strong>Scriptly {checkout.plan.name}</strong>
            <small>{checkout.plan.tagline}</small>
          </div>
          <div className="checkout-price">
            <strong>{formatPrice(price)}</strong>
            <small>{cycleLabel(checkout.cycle)}</small>
          </div>
        </div>

        {step === "method" && (
          <>
            <div
              className="checkout-methods"
              role="radiogroup"
              aria-label="Zahlungsart"
            >
              {methods.map(entry => {
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="radio"
                    aria-checked={method === entry.id}
                    className={`checkout-method ${method === entry.id ? "active" : ""}`}
                    onClick={() => setMethod(entry.id)}
                  >
                    <Icon size={18} />
                    <span>
                      <strong>{entry.label}</strong>
                      <small>{entry.hint}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={close}>
                Abbrechen
              </button>
              <button
                className="btn primary"
                onClick={() => setStep("confirm")}
              >
                Weiter
              </button>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            {method === "card" && (
              <div className="checkout-card" aria-label="Testkarte">
                <span>Testkarte</span>
                <strong>4242 4242 4242 4242</strong>
                <small>Gültig bis 12/34 · Prüfnummer 123</small>
              </div>
            )}
            {method === "google-play" && (
              <p className="checkout-step-text">
                Im echten Ablauf öffnet sich hier das Kaufblatt von Google Play
                mit deinem Play-Store-Konto. Im Test bestätigst du direkt.
              </p>
            )}
            {method === "paypal" && (
              <p className="checkout-step-text">
                Im echten Ablauf wirst du zu PayPal weitergeleitet und gibst den
                Kauf dort frei. Im Test bestätigst du direkt.
              </p>
            )}
            <div className="modal-actions">
              <button
                className="btn secondary"
                onClick={() => setStep("method")}
              >
                Zurück
              </button>
              <button className="btn primary" onClick={pay}>
                Testkauf über {formatPrice(price)} bestätigen
              </button>
            </div>
          </>
        )}

        {step === "processing" && (
          <p className="checkout-processing" role="status">
            <LoaderCircle size={18} className="spin" />
            Zahlung über {methodLabel} wird simuliert …
          </p>
        )}

        {step === "done" && (
          <>
            <div className="checkout-done" role="status">
              <CheckCircle2 size={28} />
              <strong>{checkout.plan.name} ist aktiv</strong>
              <small>
                Testbeleg {reference} · {methodLabel} · {formatPrice(price)}{" "}
                {cycleLabel(checkout.cycle)}
              </small>
            </div>
            <div className="modal-actions">
              <button className="btn primary" onClick={close}>
                Fertig
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function Subscription() {
  const { settings, updateSettings, data } = useStudio();
  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const current: PlanId = settings.plan ?? "free";
  const uploads = data.templates.filter(template => !template.builtIn).length;
  const monthlyEquivalent = (plans.pro.prices.yearly ?? 0) / 12;

  const choose = (plan: Plan) => {
    if (plan.id === "free") {
      if (current === "free") return;
      if (!confirm("Zurück zu Free wechseln? Im Test endet das Abo sofort."))
        return;
      updateSettings({ plan: "free", planCycle: undefined });
      toast.success("Du nutzt jetzt Free.");
      return;
    }
    setCheckout({ plan, cycle: plan.id === "lifetime" ? "once" : cycle });
  };

  return (
    <div className="subscription content-width">
      <header className="subscription-header">
        <div>
          <p className="eyebrow">Mitgliedschaft</p>
          <h1>Pläne und Preise</h1>
          <p className="muted">
            Du nutzt gerade <strong>{plans[current].name}</strong>
            {settings.planCycle
              ? ` (${settings.planCycle === "yearly" ? "jährlich" : "monatlich"})`
              : ""}
            . {data.fonts.length} Handschriften und {uploads} eigene Blätter
            angelegt.
          </p>
        </div>
        <div className="cycle-toggle" role="group" aria-label="Abrechnung">
          <button
            type="button"
            className={cycle === "monthly" ? "active" : ""}
            onClick={() => setCycle("monthly")}
          >
            Monatlich
          </button>
          <button
            type="button"
            className={cycle === "yearly" ? "active" : ""}
            onClick={() => setCycle("yearly")}
          >
            Jährlich
          </button>
        </div>
      </header>

      <p className="subscription-test-note">
        <FlaskConical size={15} />
        Testpreise und Test-Checkout. Echte Zahlungen werden später angebunden.
      </p>

      <div className="plan-grid">
        {(Object.values(plans) as Plan[]).map(plan => {
          const active = plan.id === current;
          const planCycle = plan.id === "lifetime" ? "once" : cycle;
          const price = priceFor(plan, planCycle);
          return (
            <article
              key={plan.id}
              className={`plan-card card ${plan.id === "pro" ? "featured" : ""} ${active ? "current" : ""}`}
            >
              <header>
                <h2>{plan.name}</h2>
                <p>{plan.tagline}</p>
              </header>
              <div className="plan-price">
                {plan.id === "free" ? (
                  <strong>0 €</strong>
                ) : (
                  <>
                    <strong>{formatPrice(price)}</strong>
                    <small>{cycleLabel(planCycle)}</small>
                  </>
                )}
              </div>
              {plan.id === "pro" && cycle === "yearly" && (
                <p className="plan-saving">
                  Entspricht {formatPrice(monthlyEquivalent)} im Monat
                </p>
              )}
              <ul>
                {plan.features.map(feature => (
                  <li
                    key={feature.label}
                    className={feature.soon ? "soon" : ""}
                  >
                    {feature.soon ? <Clock3 size={14} /> : <Check size={14} />}
                    <span>
                      {feature.label}
                      {feature.soon && <em>bald verfügbar</em>}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`btn ${plan.id === "pro" ? "primary" : "secondary"}`}
                disabled={active}
                onClick={() => choose(plan)}
              >
                {active
                  ? "Aktueller Plan"
                  : plan.id === "free"
                    ? "Zu Free wechseln"
                    : `${plan.name} wählen`}
              </button>
            </article>
          );
        })}
      </div>

      <CheckoutDialog
        key={checkout ? `${checkout.plan.id}-${checkout.cycle}` : "none"}
        checkout={checkout}
        onClose={() => setCheckout(null)}
      />
    </div>
  );
}
