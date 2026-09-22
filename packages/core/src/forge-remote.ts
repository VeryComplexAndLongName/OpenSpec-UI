// Where a repository's remote lives, read from its URL, for the forges
// that are asked over HTTP (the-forge-is-gitlab-or-gitea-too).
//
// Pure: no network, so what a URL means is tested on its own.

export interface ForgeRemote {
  /** The host, lower-cased, without a port. */
  host: string;
  /** Where the forge's web and API root is, where the URL says: the
   * scheme, host and port of an http(s) remote. An ssh remote says
   * nothing about it. */
  webBase?: string;
  /** The repository's path on the forge: `owner/repo`, or
   * `group/subgroup/project` on GitLab. */
  path: string;
}

function trimRepoPath(path: string): string {
  return path.replace(/^[/]+/u, "").replace(/[/]+$/u, "").replace(/[.]git$/u, "");
}

/** What a remote URL names, or `undefined` for one this cannot read. */
export function parseForgeRemote(url: string): ForgeRemote | undefined {
  const text = url.trim();
  // scp-like: git@host:owner/repo.git
  const scp = /^[^@/]+@([^:/]+):(.+)$/u.exec(text);
  if (scp && !text.includes("://")) {
    const path = trimRepoPath(scp[2] ?? "");
    return path.includes("/") ? { host: (scp[1] ?? "").toLowerCase(), path } : undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return undefined;
  }
  const path = trimRepoPath(decodeURIComponent(parsed.pathname));
  if (!path.includes("/")) return undefined;
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    return { host, webBase: `${parsed.protocol}//${parsed.host}`, path };
  }
  return { host, path };
}
