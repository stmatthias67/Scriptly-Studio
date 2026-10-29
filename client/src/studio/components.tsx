import { de } from "./locales/app";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowRight, Feather } from "lucide-react";
import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={value => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal-content ${wide ? "wide" : ""}`}
          aria-describedby={undefined}
        >
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label={de.close}>
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Feather size={23} strokeWidth={1.5} />
      </span>
      {!compact && (
        <span className="brand-type">
          Scriptly<span>STUDIO</span>
        </span>
      )}
    </div>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon || <Feather size={25} />}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="btn secondary" onClick={onAction}>
          {action}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(
        children as ReactElement<{ id?: string; "aria-label"?: string }>,
        { id, "aria-label": label }
      )
    : children;
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {control}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}
