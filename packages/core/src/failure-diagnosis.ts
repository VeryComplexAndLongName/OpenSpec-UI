// What is known about why a run failed - the-supervisor-advises, ADR 0039.
//
// A run that fails says `claude exited with code 1`, and the reason is in
// what it printed before: not signed in, not installed, blocked by
// security software. Every one of those fails the same way when it is
// tried again, and nothing used to say so. This reads the reason and the
// end of the output for causes that have been seen, and says whether
// repeating can help and what to do instead.
//
// A leaf module, like `hints.ts`: no Node imports, so the browser renders
// the same words the terminal prints.
//
// What it deliberately does not do:
//
// - Guess. A failure matching nothing here is `unknown`, and so is
//   whether repeating helps.
// - Act. It is a diagnosis; what to do with it is a person's, or, where a
//   change allows it, the supervisor's (`the-supervisor-changes-agents`).

import { isMessageCode, say, type MessageCode } from "./message-register.js";

export type FailureCause =
  | "agent-not-installed"
  | "not-signed-in"
  | "blocked-by-the-machine"
  | "network-unreachable"
  | "rate-limited"
  | "server-error"
  | "unknown";

/** Whether starting the same run again can help. `no` is for a cause that
 * a repeat meets again unchanged; `likely` for one that passes by itself. */
export type RepeatHelps = "no" | "likely" | "unknown";

export interface FailureDiagnosis {
  cause: FailureCause;
  repeatHelps: RepeatHelps;
  /** The register's identifier for the cause's words. */
  code?: MessageCode;
  /** The register's identifier for the remedy's words. */
  remedyCode?: MessageCode;
  /** The line the cause was found in, as printed, cut to
   * `QUOTED_LINE_LIMIT` characters. Absent for `unknown`. A diagnosis a
   * reader can check against its evidence is one they can disagree with. */
  evidence?: string;
  /** What to do instead, where repeating cannot help or is not the whole
   * answer. */
  remedy?: string;
  /** Lines a person can paste to act on the remedy. */
  commands?: string[];
}

export interface FailureFacts {
  /** The registry id of the agent that ran. */
  agentId: string;
  /** The failure's own reason, as the run gave it. */
  reason: string;
  /** The end of what the run printed, stdout and stderr together. */
  output?: string;
}

export const QUOTED_LINE_LIMIT = 200;

interface CauseRule {
  cause: Exclude<FailureCause, "unknown">;
  repeatHelps: Exclude<RepeatHelps, "unknown">;
  patterns: readonly RegExp[];
}

/** A status code counts only where it reads as one: after `HTTP`,
 * `status`, `code` or `error`, or before its own phrase. A bare number is
 * too common in output - a duration, a test count - to be read as a
 * status by itself. */
function statusCode(code: string, phrase: string): RegExp[] {
  return [
    new RegExp(String.raw`\b(?:HTTP(?:/\d(?:\.\d)?)?|status(?:\s+code)?|code|error)\s*:?\s*${code}\b`, "i"),
    new RegExp(String.raw`\b${code}\s+${phrase}`, "i"),
  ];
}

/** In order: the first cause found wins. A run that could not start, or
 * could not sign in, explains whatever it printed after. */
const RULES: readonly CauseRule[] = [
  {
    cause: "agent-not-installed",
    repeatHelps: "no",
    patterns: [
      /\bENOENT\b/,
      /is not recognized as an internal or external command/i,
      /\bcommand not found\b/i,
    ],
  },
  {
    cause: "not-signed-in",
    repeatHelps: "no",
    patterns: [
      /\bauthentication required\b/i,
      /\bnot (?:logged|signed) in\b/i,
      /\bplease (?:log|sign) in\b/i,
      /(?:^|\s)\/login\b/i,
      /\bunauthori[sz]ed\b/i,
      /\binvalid api key\b/i,
      ...statusCode("401", "Unauthorized"),
    ],
  },
  {
    cause: "blocked-by-the-machine",
    repeatHelps: "no",
    patterns: [
      /\bEPERM\b/,
      /\bEACCES\b/,
      /\baccess is denied\b/i,
      /\boperation not permitted\b/i,
    ],
  },
  {
    cause: "network-unreachable",
    repeatHelps: "no",
    patterns: [
      /\bECONNREFUSED\b/,
      /\bECONNRESET\b/,
      /\bENOTFOUND\b/,
      /\bETIMEDOUT\b/,
      /\bEAI_AGAIN\b/,
      /\bfetch failed\b/i,
      /\bproxy\b/i,
    ],
  },
  {
    cause: "rate-limited",
    repeatHelps: "likely",
    patterns: [
      /\brate[- ]limit/i,
      /\btoo many requests\b/i,
      /\bquota\b/i,
      ...statusCode("429", "Too Many Requests"),
    ],
  },
  {
    cause: "server-error",
    repeatHelps: "likely",
    patterns: [
      /\binternal server error\b/i,
      /\bservice unavailable\b/i,
      /\bbad gateway\b/i,
      /\bgateway time-?out\b/i,
      /\boverloaded\b/i,
      ...["500", "502", "503", "504"].flatMap((code) => statusCode(code, "(?:Internal|Bad|Service|Gateway)")),
    ],
  },
];

/** The executable a person runs to sign an agent in, by registry id. The
 * same names `default-runners.ts` starts. */
const EXECUTABLE_BY_AGENT: Readonly<Record<string, string>> = {
  "claude-cli": "claude",
  "claude-cli-acp": "claude",
  "copilot-cli": "copilot",
  "copilot-cli-acp": "copilot",
  "codex-cli": "codex",
  "codex-cli-acp": "codex",
  "gemini-cli": "gemini",
  "gemini-cli-acp": "gemini",
  "deepseek-cli-acp": "dsh",
};

const LOCAL_LLM_AGENTS: ReadonlySet<string> = new Set(["local-llm", "local-llm-acp"]);

const LINE_BREAK = /\r?\n/;

function quoted(line: string): string {
  const trimmed = line.trim();
  return trimmed.length <= QUOTED_LINE_LIMIT ? trimmed : `${trimmed.slice(0, QUOTED_LINE_LIMIT - 1)}…`;
}

function remedyFor(cause: Exclude<FailureCause, "unknown">, agentId: string): Pick<FailureDiagnosis, "remedy" | "remedyCode" | "commands"> {
  const executable = EXECUTABLE_BY_AGENT[agentId];
  const local = LOCAL_LLM_AGENTS.has(agentId);
  switch (cause) {
    case "agent-not-installed":
      return executable !== undefined
        ? {
            remedy: say("OSW-AGT-211", { executable }).text,
            remedyCode: "OSW-AGT-211",
            commands: ["openspec-ui-cli diagnose workspace"],
          }
        : {
            remedy: say("OSW-AGT-212").text,
            remedyCode: "OSW-AGT-212",
            commands: ["openspec-ui-cli diagnose workspace"],
          };
    case "not-signed-in":
      if (local) {
        return { remedy: say("OSW-NET-204").text, remedyCode: "OSW-NET-204" };
      }
      return executable !== undefined
        ? { remedy: say("OSW-AGT-213", { executable }).text, remedyCode: "OSW-AGT-213", commands: [executable] }
        : { remedy: say("OSW-AGT-214").text, remedyCode: "OSW-AGT-214" };
    case "blocked-by-the-machine":
      return { remedy: say("OSW-AGT-215").text, remedyCode: "OSW-AGT-215" };
    case "network-unreachable":
      return { remedy: say("OSW-NET-205").text, remedyCode: "OSW-NET-205" };
    case "rate-limited":
      return { remedy: say("OSW-AGT-216").text, remedyCode: "OSW-AGT-216" };
    case "server-error":
      return { remedy: say("OSW-AGT-217").text, remedyCode: "OSW-AGT-217" };
  }
}

/** What is known about why a run failed.
 *
 * The reason is read before the output, and both line by line: for each
 * cause in `RULES` order, the first line that matches it. */
export function diagnoseFailure(facts: FailureFacts): FailureDiagnosis {
  const lines = [...facts.reason.split(LINE_BREAK), ...(facts.output ?? "").split(LINE_BREAK)]
    .filter((line) => line.trim().length > 0);
  for (const rule of RULES) {
    const line = lines.find((candidate) => rule.patterns.some((pattern) => pattern.test(candidate)));
    if (line === undefined) continue;
    return {
      cause: rule.cause,
      repeatHelps: rule.repeatHelps,
      code: failureCauseCode(rule.cause),
      evidence: quoted(line),
      ...remedyFor(rule.cause, facts.agentId),
    };
  }
  return { cause: "unknown", repeatHelps: "unknown", code: "OSW-AGT-207" };
}

const CAUSE_CODES = {
  "agent-not-installed": "OSW-AGT-201",
  "not-signed-in": "OSW-AGT-202",
  "blocked-by-the-machine": "OSW-AGT-203",
  "network-unreachable": "OSW-AGT-204",
  "rate-limited": "OSW-AGT-205",
  "server-error": "OSW-AGT-206",
  unknown: "OSW-AGT-207",
} as const satisfies Record<FailureCause, MessageCode>;

const REPEAT_CODES = {
  no: "OSW-AGT-208",
  likely: "OSW-AGT-209",
  unknown: "OSW-AGT-210",
} as const satisfies Record<RepeatHelps, MessageCode>;

/** The register's identifier for a cause's words. */
export function failureCauseCode(cause: FailureCause): MessageCode {
  return CAUSE_CODES[cause];
}

/** The cause, in a reader's words. */
export function describeFailureCause(cause: FailureCause): string {
  return say(CAUSE_CODES[cause]).text;
}

/** One line: the cause, and whether repeating helps. The words every
 * surface shows, so no two describe one failure differently. */
export function describeDiagnosis(diagnosis: FailureDiagnosis): string {
  return `${say(CAUSE_CODES[diagnosis.cause]).text}: ${say(REPEAT_CODES[diagnosis.repeatHelps]).text}`;
}

/** A value read back from a log or a payload, as a diagnosis, or
 * `undefined` where it is not one. A field a reader does not recognise is
 * read as absent, so an entry from a later version still says the rest. */
export function readFailureDiagnosis(value: unknown): FailureDiagnosis | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.cause !== "string" || !(record.cause in CAUSE_CODES)) return undefined;
  if (typeof record.repeatHelps !== "string" || !(record.repeatHelps in REPEAT_CODES)) return undefined;
  const commands = Array.isArray(record.commands) && record.commands.every((item) => typeof item === "string")
    ? record.commands as string[]
    : undefined;
  return {
    cause: record.cause as FailureCause,
    repeatHelps: record.repeatHelps as RepeatHelps,
    ...(isMessageCode(record.code) ? { code: record.code } : {}),
    ...(isMessageCode(record.remedyCode) ? { remedyCode: record.remedyCode } : {}),
    ...(typeof record.evidence === "string" ? { evidence: record.evidence } : {}),
    ...(typeof record.remedy === "string" ? { remedy: record.remedy } : {}),
    ...(commands !== undefined ? { commands } : {}),
  };
}
