// The bar across the top of the standalone shell
// (the-shell-wears-the-site-frame, ADR 0033): the owl and the product's name,
// the workspace this shell reads, and the theme switch. The name is text, not
// a heading: the page head below names the page.

import type { ShellTheme } from "../standalone-theme.js";
import { OwlLogo } from "./OwlLogo.js";
import { ThemeToggle } from "./ThemeToggle.js";

export function AppBar({ workspacePath, theme, onToggleTheme }: { workspacePath: string; theme: ShellTheme; onToggleTheme: () => void }) {
  return (
    <header className="openspec-app-bar" data-testid="app-bar">
      <div className="openspec-app-bar-inner">
        <span className="openspec-app-bar-brand">
          <OwlLogo />
          <span>OpenSpec Workbench</span>
        </span>
        {workspacePath.length > 0
          ? <span className="openspec-app-bar-path" data-testid="app-bar-workspace" title={workspacePath}>{workspacePath}</span>
          : null}
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
