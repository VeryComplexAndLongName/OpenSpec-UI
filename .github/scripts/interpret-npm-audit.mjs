// Decides what an `npm audit --json` report actually says.
//
// `npm audit` exits non-zero both when it finds a high-severity advisory
// and when it cannot reach the advisory service, and those are not the
// same claim. An audit that did not run says nothing about these
// dependencies — not that they are clean, and not that they are not.
// Reporting the second as the first is what took the whole CI pipeline
// down twice on #210, seven minutes of retries against a 503 from
// registry.npmjs.org, with every other check already green.
//
// Exit 1 means: the audit ran and found a high-severity advisory.
// Exit 0 means: the audit ran and found none, OR it could not run — the
// latter always announced as a workflow warning, never in silence.

import { readFileSync } from "node:fs";

const reportPath = process.argv[2];

/** Could not run. Not a finding, and deliberately not a failure — but
 * never silent either: a check that passes without having checked
 * anything has to say so where someone reading the run will see it. */
function couldNotRun(reason) {
  console.log(`::warning::npm audit was not carried out: ${reason}`);
  process.exit(0);
}

if (!reportPath) couldNotRun("no report path was given to the interpreter");

let raw;
try {
  raw = readFileSync(reportPath, "utf8");
} catch (error) {
  couldNotRun(`the report file could not be read (${error.code ?? error.message})`);
}

if (raw.trim().length === 0) couldNotRun("the report was empty");

let report;
try {
  report = JSON.parse(raw);
} catch {
  // npm writes plain-text diagnostics here when it fails early enough,
  // so unparseable output is a failed run, not a corrupt clean result.
  couldNotRun("the report was not valid JSON");
}

if (report?.error) {
  const { code, summary } = report.error;
  couldNotRun(`the advisory service returned an error (${code ?? "no code"}: ${summary ?? "no summary"})`);
}

const counts = report?.metadata?.vulnerabilities;
if (!counts || typeof counts !== "object") {
  // Absent counts are unknown counts. Reading them as zero would turn
  // "we do not know" into "there is nothing", which is the exact
  // confusion this script exists to remove.
  couldNotRun("the report carried no vulnerability counts");
}

const high = Number(counts.high ?? 0);
const critical = Number(counts.critical ?? 0);

if (high + critical > 0) {
  console.log(`::error::npm audit found ${critical} critical and ${high} high severity advisories.`);
  process.exit(1);
}

console.log(`npm audit: no high or critical advisories (${JSON.stringify(counts)}).`);
process.exit(0);
