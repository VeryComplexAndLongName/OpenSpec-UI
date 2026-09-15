// The standalone header's theme toggle (the-web-ui-wears-metro 4.1). Its
// name stays "Dark theme" and `aria-pressed` carries the state, so the
// visible text and the accessible name never disagree (WCAG 2.5.3).

import type { ShellTheme } from "../standalone-theme.js";

export function ThemeToggle({ theme, onToggle }: { theme: ShellTheme; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="button openspec-theme-toggle"
      data-testid="theme-toggle"
      aria-pressed={theme === "dark"}
      onClick={onToggle}
    >
      Dark theme
    </button>
  );
}
