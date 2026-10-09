// Writes docs/messages.md from the register (ADR 0046). message-register.test.ts
// fails while the checked-in page differs from what this writes.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderMessagesPage } from "../src/message-register.js";

const page = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "messages.md");
writeFileSync(page, renderMessagesPage(), "utf8");
console.log(`wrote ${page}`);
