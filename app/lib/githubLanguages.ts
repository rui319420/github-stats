import { Octokit } from "@octokit/rest";

export interface LanguageData {
  name: string;
  bytes: number;
  percentage: number;
}

export interface LanguageStats {
  username: string;
  includePrivate: boolean;
  repositoryCount: number;
  languages: LanguageData[];
}

const EXCLUDED_LANGUAGES = new Set([
  "ShaderLab",
  "HLSL",
  "GLSL",
  "Jupyter Notebook",
]);

const GITHUB_USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export function parseBooleanParam(value: string | null): boolean {
  return value ? TRUE_VALUES.has(value.toLowerCase()) : false;
}

export function resolveUsername(raw: string | null | undefined): string | null {
  const username = raw?.trim() || process.env.GITHUB_USERNAME?.trim() || "";
  if (!username || !GITHUB_USERNAME_RE.test(username)) return null;
  return username;
}

function createOctokit(token?: string) {
  return new Octokit({
    auth: token || process.env.GITHUB_TOKEN || undefined,
  });
}

async function listRepositories(
  username: string,
  includePrivate: boolean,
  token?: string
) {
  const octokit = createOctokit(token);

  if (!includePrivate) {
    return octokit.paginate(octokit.repos.listForUser, {
      username,
      per_page: 100,
      sort: "updated",
      type: "owner",
    });
  }

  if (!token && !process.env.GITHUB_TOKEN) {
    throw new Error(
      "Sign in with GitHub or set GITHUB_TOKEN when include_private is true."
    );
  }

  const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
    per_page: 100,
    sort: "updated",
    visibility: "all",
    affiliation: "owner",
  });

  const normalizedUsername = username.toLowerCase();
  return repos.filter((repo) => repo.owner.login.toLowerCase() === normalizedUsername);
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

export async function getLanguageStats(
  username: string,
  includePrivate: boolean,
  token?: string
): Promise<LanguageStats> {
  const octokit = createOctokit(token);
  const repos = await listRepositories(username, includePrivate, token);
  const targets = repos.filter((repo) => !repo.fork && !repo.archived);
  const langMap: Record<string, number> = {};

  await mapLimit(targets, 8, async (repo) => {
    const { data } = await octokit.repos.listLanguages({
      owner: repo.owner.login,
      repo: repo.name,
    });

    for (const [lang, bytes] of Object.entries(data)) {
      if (EXCLUDED_LANGUAGES.has(lang)) continue;
      langMap[lang] = (langMap[lang] ?? 0) + bytes;
    }
  });

  const total = Object.values(langMap).reduce((sum, bytes) => sum + bytes, 0);
  const languages =
    total === 0
      ? []
      : Object.entries(langMap)
          .map(([name, bytes]) => ({
            name,
            bytes,
            percentage: bytes / total,
          }))
          .sort((a, b) => b.bytes - a.bytes);

  return {
    username,
    includePrivate,
    repositoryCount: targets.length,
    languages,
  };
}
