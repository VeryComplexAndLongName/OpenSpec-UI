import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** `packages/core`'s own released version, read from its own `package.json`
 * rather than hardcoded — stays correct without a second edit whenever the
 * package version is bumped. See README.md, "Versioning": `core` is the
 * source of truth and should be shown separately when the UI displays
 * build information. */
export const CORE_VERSION: string = (require("../package.json") as { version: string }).version;
