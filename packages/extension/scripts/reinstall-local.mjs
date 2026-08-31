// Rebuilds, repackages, and force-installs the extension into the local
// VS Code so a locally installed .vsix can never silently lag behind the
// current working tree. `code --install-extension` is a silent no-op when
// the target version is already installed, which is the common case for
// local iteration (the version only changes on a real changeset applied
// at merge time, not on every local rebuild) — `--force` is required.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function run(command, args) {
  console.log(`> ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd: extensionDir, stdio: "inherit", shell: true });
}

run("npm", ["run", "package"]);

const packageJson = JSON.parse(readFileSync(path.join(extensionDir, "package.json"), "utf8"));
const vsixPath = path.join(extensionDir, `openspec-ui-vscode-${packageJson.version}.vsix`);
if (!existsSync(vsixPath)) {
  console.error(`Expected packaged file not found: ${vsixPath}`);
  process.exit(1);
}

run("code", ["--install-extension", vsixPath, "--force"]);

console.log(
  "\nInstalled. This does NOT reload any already-open VS Code window — " +
    "run \"Developer: Reload Window\" there manually before testing.",
);
