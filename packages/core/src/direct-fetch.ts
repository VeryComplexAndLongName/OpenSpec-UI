// Requests that may ignore the system proxy (local-llm-codes-in-process,
// ADR 0038 decision 6).
//
// The global `fetch` is not to be trusted to go direct: the editor's
// extension host applies the editor's proxy to Node's networking, and a
// standalone host may install a global dispatcher. So a request that must
// ignore the proxy goes through `undici`'s own `fetch` with a connection
// pool of its own, which nothing else in the process can replace.
//
// And the environment's proxy variables, which an agent CLI reads for
// itself, are removed from what a spawned agent is given.

import { Agent, fetch as undiciFetch } from "undici";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

let directAgent: Agent | undefined;

/** The `fetch` to reach the local LLM with: one that connects directly,
 * whatever proxy the process has, when `ignoreSystemProxy` is set, and the
 * process's own `fetch` otherwise. */
export function localFetch(ignoreSystemProxy: boolean | undefined): FetchLike {
  if (!ignoreSystemProxy) return (input, init) => fetch(input, init);
  directAgent ??= new Agent();
  const dispatcher = directAgent;
  return (input, init) =>
    undiciFetch(input, { ...(init as Record<string, unknown>), dispatcher } as Parameters<typeof undiciFetch>[1]) as unknown as Promise<Response>;
}

const PROXY_VARIABLES = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"];

/** `env` with every proxy variable removed, in either case, and
 * `NO_PROXY=*`: what an agent that reads the variables needs to go direct.
 * An agent that reads none of them is unaffected, which is why each
 * agent's capability row says whether it honours this. */
export function withoutSystemProxy(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    const upper = key.toUpperCase();
    if (PROXY_VARIABLES.includes(upper) || upper === "NO_PROXY") continue;
    result[key] = value;
  }
  result.NO_PROXY = "*";
  result.no_proxy = "*";
  return result;
}
