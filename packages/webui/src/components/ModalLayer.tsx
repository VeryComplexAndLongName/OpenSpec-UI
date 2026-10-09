// What waits for a person is a dialog (ADR 0047, what-waits-for-a-person-is-a-
// dialog). The layer stands over the whole view: what is behind it is dimmed
// and cannot be pressed, focus moves into the dialog and stays there, and
// returns to the control that opened it when it closes. It closes only by
// the dialog's own answer or Cancel, or by Escape - never by a click beside
// it. The dialog itself is the child, with its role, its name and
// `aria-modal`.

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.getAttribute("aria-hidden") !== "true");
}

export function ModalLayer({ onCancel, children, testId = "modal-layer" }: {
  /** Escape: what the dialog's own Cancel does. */
  onCancel: () => void;
  children: ReactNode;
  testId?: string;
}): JSX.Element {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = layer.current;
    // A dialog that put its focus somewhere already keeps it; otherwise the
    // first thing in it that takes focus does, or the dialog itself.
    if (node !== null && !node.contains(document.activeElement)) {
      const dialog = node.querySelector<HTMLElement>('[role="dialog"]') ?? node;
      (focusables(dialog)[0] ?? dialog).focus();
    }
    return () => {
      if (opener !== null && opener.isConnected) opener.focus();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== "Tab" || layer.current === null) return;
    const inside = focusables(layer.current);
    if (inside.length === 0) {
      event.preventDefault();
      return;
    }
    const first = inside[0] as HTMLElement;
    const last = inside[inside.length - 1] as HTMLElement;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div ref={layer} className="openspec-modal-layer" data-testid={testId} onKeyDown={onKeyDown}>
      <div className="openspec-modal-backdrop" aria-hidden="true" />
      <div className="openspec-modal-content">{children}</div>
    </div>
  );
}
