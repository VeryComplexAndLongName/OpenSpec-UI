import { useEditorDarkTheme, metroRootClassName } from "../vscode-theme.js";
import { shellThemeCss, vscodeThemeCss } from "../shell-ui.js";
import { metroCss } from "../metro-css.generated.js";
import { metroIconsCss } from "../metro-icons.generated.js";
import { ComplianceView, type ComplianceApi } from "./ComplianceView.js";

export function ComplianceApp({ api }: { api: ComplianceApi }) {
  const editorDark = useEditorDarkTheme();

  return (
    <div className={metroRootClassName("openspec-extension-app", editorDark)} data-testid="compliance-webview-root">
      <style>{[metroCss, metroIconsCss, shellThemeCss, vscodeThemeCss].join(" ")}</style>
      <ComplianceView api={api} />
    </div>
  );
}