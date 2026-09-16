// The standalone header's theme control (a-screen-says-what-it-is-doing 4.1).
//
// A switch, not a button. The owner read the old button, labelled "Dark
// theme" in both states, as a control that never changed. Its name cannot
// follow the theme — WCAG 2.5.3 wants the visible label inside the accessible
// name, and "Light theme" in one state would break a voice command that
// named the other — so the state moves into the role: `role="switch"` with
// `aria-checked`, a track whose knob slides, and a moon or a sun on the knob.
// The label stays "Dark theme" and reads true: the switch is on when the
// theme is dark.
//
// The glyphs are drawn here rather than taken from the icon font: its subset
// carries no sun or moon, and cutting a new subset for one control is more
// than the control is worth.

import type { ShellTheme } from "../standalone-theme.js";

function Moon() {
  return (
    <svg className="openspec-theme-switch-glyph" data-glyph="moon" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="currentColor" />
    </svg>
  );
}

function Sun() {
  return (
    <svg className="openspec-theme-switch-glyph" data-glyph="sun" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ThemeToggle({ theme, onToggle }: { theme: ShellTheme; onToggle: () => void }) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      className="openspec-theme-toggle openspec-theme-switch"
      data-testid="theme-toggle"
      onClick={onToggle}
    >
      <span className="openspec-theme-switch-track" aria-hidden="true">
        <span className="openspec-theme-switch-knob">{dark ? <Moon /> : <Sun />}</span>
      </span>
      <span className="openspec-theme-switch-label">Dark theme</span>
    </button>
  );
}
