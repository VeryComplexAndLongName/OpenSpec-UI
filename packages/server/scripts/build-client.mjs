// Собирает браузерный бандл standalone-шелла (packages/webui/src/standalone-entry.tsx)
// в packages/server/dist/app.js — единственный build-шаг, за который отвечает
// server (см. openspec/changes/standalone-app/tasks.md 2.1). Выход
// игнорируется git'ом (см. .gitignore, паттерн `dist/`).

import { build } from "esbuild";
import { clientBuildOptions } from "./client-build-options.mjs";

await build(clientBuildOptions());
