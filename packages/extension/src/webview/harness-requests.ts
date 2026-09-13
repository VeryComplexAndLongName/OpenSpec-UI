// What a harness settings webview may ask its host, and the answers.
//
// Moved out of the AI panel together with the settings view: each harness
// file now has a panel of its own, and the AI panel no longer renders a
// settings form. See a-change-is-configured-from-the-change and, for the
// operations themselves, harness-settings-in-the-panel.

import os from "node:os";
import {
  customAgentDirectories,
  findCustomAgents,
  readChangeHarnessConfig,
  resolveHarnessConfig,
  writeChangeHarnessConfig,
  writeGlobalHarnessConfig,
} from "@openspec-ui/core";

export const REQUEST_MESSAGE_TYPE = "openspec-ui/request";
export const RESPONSE_MESSAGE_TYPE = "openspec-ui/response";

/** What the webview may ask this host for.
 *
 * Named operations rather than a path, a file or a function name: a
 * message must not be able to say what gets read or written. The `cwd`
 * is this host's own workspace root, never a field in the message. */
export type HarnessRequestOperation =
  | "harness/resolve-global"
  | "harness/write-global"
  | "harness/read-change-override"
  | "harness/write-change-override"
  | "custom-agents/list";

export interface HarnessRequestMessage {
  type: typeof REQUEST_MESSAGE_TYPE;
  id: string;
  op: HarnessRequestOperation;
  args?: unknown;
}

export interface HarnessResponseBody {
  ok: boolean;
  value?: unknown;
  error?: string;
}

export function asHarnessRequest(data: unknown): HarnessRequestMessage | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const message = data as Record<string, unknown>;
  if (message.type !== REQUEST_MESSAGE_TYPE || typeof message.id !== "string") return undefined;
  // An unknown operation still reaches the handler, which refuses it by
  // name — a request that vanishes is a promise that never settles.
  return { type: REQUEST_MESSAGE_TYPE, id: message.id, op: message.op as HarnessRequestOperation, args: message.args };
}

/** Answers one request from a settings webview.
 *
 * Every operation is a `core` call this host already makes, against its
 * own workspace root. An operation it does not offer is refused by name
 * rather than ignored: a request that vanishes leaves a promise that
 * never settles, which is worse for the form than an error.
 *
 * A refusal from `core` — a configuration the validator rejects, a file
 * that is not valid JSON, a change name that would reach outside the
 * workspace — is carried back as the error rather than swallowed. A
 * settings form that cannot say a save was refused is indistinguishable
 * from one that saved. */
export async function answerHarnessRequest(
  cwd: string | undefined,
  request: HarnessRequestMessage,
  reply: (body: HarnessResponseBody) => void,
): Promise<void> {
  if (!cwd) {
    reply({ ok: false, error: "no workspace root is open" });
    return;
  }
  const args = (request.args ?? {}) as { changeName?: string; config?: Record<string, unknown> };

  try {
    switch (request.op) {
      case "harness/resolve-global":
        reply({ ok: true, value: await resolveHarnessConfig(cwd) });
        return;
      case "harness/write-global":
        await writeGlobalHarnessConfig(cwd, (args.config ?? {}) as never);
        reply({ ok: true });
        return;
      case "harness/read-change-override":
        if (!args.changeName) { reply({ ok: false, error: "no change was named" }); return; }
        reply({ ok: true, value: (await readChangeHarnessConfig(cwd, args.changeName)) ?? null });
        return;
      case "harness/write-change-override":
        if (!args.changeName) { reply({ ok: false, error: "no change was named" }); return; }
        await writeChangeHarnessConfig(cwd, args.changeName, (args.config ?? {}) as never);
        reply({ ok: true });
        return;
      case "custom-agents/list": {
        const homeDir = os.homedir();
        reply({
          ok: true,
          value: {
            agents: await findCustomAgents(cwd, homeDir),
            directories: customAgentDirectories(cwd, homeDir),
          },
        });
        return;
      }
      default:
        reply({ ok: false, error: `unknown operation "${String(request.op)}"` });
    }
  } catch (error) {
    reply({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
