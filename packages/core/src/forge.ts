// Which forge a workspace's repository lives on, from its `origin`
// (the-forge-is-gitlab-or-gitea-too).
//
// - github.com is GitHub, asked through `gh`, as before.
// - gitlab.com is GitLab.
// - Any other host is asked what it is: Gitea answers `GET /api/v1/version`
//   and GitLab `GET /api/v4/version`. `GITEA_URL` or `GITLAB_URL` names
//   one outright, which an ssh remote needs, since its URL does not say
//   where the web root is.
// - A host that answers neither is taken for GitHub, which is what every
//   workspace was before, and `gh` then says what it can.
//
// The token is the person's, in their environment: `GITLAB_TOKEN`,
// `GITEA_TOKEN`. It is read when a forge is made and passed nowhere else.

import { createGitHubForge, type Forge } from "./gh-pr-gateway.js";
import { createGitWrapper } from "./git.js";
import { parseForgeRemote } from "./forge-remote.js";
import { createGitLabForge, createGiteaForge, type FetchLike } from "./http-forges.js";

export type ForgeKind = "github" | "gitlab" | "gitea";

export interface ForgeForOptions {
  env?: Record<string, string | undefined>;
  fetch?: FetchLike;
  /** Test seam: the `origin` URL. */
  remoteUrl?: (root: string) => Promise<string | undefined>;
}

function sameHost(url: string | undefined, host: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase() === host ? `${parsed.protocol}//${parsed.host}` : undefined;
  } catch {
    return undefined;
  }
}

async function answers(fetchImpl: FetchLike, url: string, alsoUnauthorized: boolean): Promise<boolean> {
  try {
    const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (response.ok) {
      const body = JSON.parse(await response.text()) as { version?: unknown };
      return typeof body.version === "string";
    }
    return alsoUnauthorized && response.status === 401;
  } catch {
    return false;
  }
}

/** What kind of forge the remote is on, and where its web root is. */
export async function detectForge(remoteUrl: string | undefined, options: ForgeForOptions = {}): Promise<{ kind: ForgeKind; base?: string; path?: string }> {
  const remote = remoteUrl === undefined ? undefined : parseForgeRemote(remoteUrl);
  if (remote === undefined || remote.host === "github.com") return { kind: "github" };
  const env = options.env ?? process.env;
  if (remote.host === "gitlab.com") return { kind: "gitlab", base: "https://gitlab.com", path: remote.path };
  const giteaBase = sameHost(env.GITEA_URL, remote.host);
  if (giteaBase) return { kind: "gitea", base: giteaBase, path: remote.path };
  const gitlabBase = sameHost(env.GITLAB_URL, remote.host);
  if (gitlabBase) return { kind: "gitlab", base: gitlabBase, path: remote.path };
  const fetchImpl = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const base = remote.webBase ?? `https://${remote.host}`;
  if (await answers(fetchImpl, `${base}/api/v1/version`, false)) return { kind: "gitea", base, path: remote.path };
  if (await answers(fetchImpl, `${base}/api/v4/version`, true)) return { kind: "gitlab", base, path: remote.path };
  return { kind: "github" };
}

const known = new Map<string, Promise<Forge>>();

/** The forge a workspace's `origin` is on, made once per workspace and
 * remote. */
export function forgeFor(root: string, options: ForgeForOptions = {}): Promise<Forge> {
  const read = async (): Promise<Forge> => {
    const remoteUrl = await (options.remoteUrl ?? ((cwd: string) => createGitWrapper({ cwd }).remoteUrl("origin")))(root);
    const env = options.env ?? process.env;
    const found = await detectForge(remoteUrl, options);
    if (found.kind === "gitea" && found.base && found.path) {
      return createGiteaForge({ base: found.base, path: found.path, token: env.GITEA_TOKEN, tokenName: "GITEA_TOKEN", ...(options.fetch ? { fetch: options.fetch } : {}) });
    }
    if (found.kind === "gitlab" && found.base && found.path) {
      return createGitLabForge({ base: found.base, path: found.path, token: env.GITLAB_TOKEN, tokenName: "GITLAB_TOKEN", ...(options.fetch ? { fetch: options.fetch } : {}) });
    }
    return createGitHubForge({ cwd: root });
  };
  // Seams are a test's own: never shared with the cache.
  if (options.remoteUrl !== undefined || options.fetch !== undefined || options.env !== undefined) return read();
  const cached = known.get(root);
  if (cached) return cached;
  const made = read();
  known.set(root, made);
  // A failed reading is not kept.
  made.catch(() => known.delete(root));
  return made;
}
