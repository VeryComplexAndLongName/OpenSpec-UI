import { iconFor, type IconMeaning } from "../icons.js";

/** An icon beside a label, never its only carrier of meaning (ADR 0032). It
 * is hidden from the accessible name: the label beside it says what it is. */
export function Icon({ meaning }: { meaning: IconMeaning }) {
  return <span className={iconFor(meaning)} aria-hidden="true" />;
}
