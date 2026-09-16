// What a tab is reading, said while it reads (a-screen-says-what-it-is-doing).
// A moving bar and a spinner answer "is it alive" at a glance; the sentence
// says what is outstanding; past three seconds the elapsed seconds say how
// long it has been. The owner approved this as the third screen of the
// redesign mockup, after a tab stood blank for a minute.
//
// The sentence is the status message. The seconds sit beside it, hidden from
// assistive technology: inside the status node they would have a screen
// reader announce the whole sentence again every second.

import { useEffect, useState } from "react";

/** How long a reading runs before the elapsed seconds are shown. Shorter
 * waits are the ordinary pace of a local read and need no count. */
export const ELAPSED_SHOWN_AFTER_SECONDS = 3;

export function PanelStatus({ reading, testId }: { reading: string | null; testId: string }) {
  const active = reading !== null;
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setSeconds(0);
    if (!active) return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [active]);

  if (!active) return null;
  return (
    <div className="openspec-panel-status" data-testid={testId}>
      <span className="openspec-panel-status-bar" aria-hidden="true"><span /></span>
      <span className="openspec-panel-status-spinner" aria-hidden="true" />
      <p role="status" className="openspec-panel-status-text">{reading}</p>
      {seconds >= ELAPSED_SHOWN_AFTER_SECONDS
        ? <span className="openspec-panel-status-elapsed" aria-hidden="true" data-testid={`${testId}-elapsed`}>{seconds} s</span>
        : null}
    </div>
  );
}
