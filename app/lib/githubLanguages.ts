import { Octokit } from "@octokit/rest";
import { getGitHubAppAuthorization } from "./githubOAuth";
import { DEFAULT_LANGUAGE_COUNT, isLanguageCountOption } from "./chartOptions";
import { ApiError } from "./apiError";
import { withAggregationSlot } from "./aggregationLimit";

import type { LanguageCount, LanguageStats } from "./languageStats";
export type { LanguageCount, LanguageData, LanguageStats, LanguageStatsDisplayOptions } from "./languageStats";
export { customizeLanguageStats } from "./languageStats";

const GITHUB_USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export function parseBooleanParam(value: string | null): boolean {
  return value ? TRUE_VALUES.has(value.toLowerCase()) : false;
}

export function parseLanguageCount(value: string | null): LanguageCount {
  if (!isLanguageCountOption(value)) return Number(DEFAULT_LANGUAGE_COUNT) as 5 | 8 | 10;
  return value === "all" ? "all" : Number(value) as 5 | 8 | 10;
}

export function parseHiddenLanguages(value: string | null): string[] {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

export function resolveUsername(raw: string | null | undefined): string | null {
  const username = (raw ?? process.env.GITHUB_USERNAME ?? "").trim();
  return GITHUB_USERNAME_RE.test(username) ? username : null;
}

async function listRepositories(octokit: Octokit, username: string, includePrivate: boolean) {
  if (!includePrivate) {
    return octokit.paginate(octokit.repos.listForUser, {
      username, per_page: 100, sort: "updated", type: "owner",
    });
  }

  const { data: viewer } = await octokit.users.getAuthenticated();
  if (viewer.login.toLowerCase() !== username.toLowerCase()) {
    throw new ApiError("非公開リポジトリは連携した本人のみ集計できます。", 403);
  }
  return octokit.paginate(octokit.repos.listForAuthenticatedUser, {
    per_page: 100, sort: "updated", visibility: "all", affiliation: "owner",
  });
}

async function mapLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let nextIndex = 0;
  let failed = false;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!failed && nextIndex < items.length) {
      const item = items[nextIndex++];
      try {
        await worker(item);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  });
  const results = await Promise.allSettled(workers);
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
}

export async function getLanguageStats(
  username: string, includePrivate: boolean, token?: string
): Promise<LanguageStats> {
  if (!GITHUB_USERNAME_RE.test(username)) throw new ApiError("有効な GitHub ユーザー名を入力してください。", 400);
  if (includePrivate && !token) {
    // A deployment credential is never authorization to publish its owner's private data.
    throw new ApiError("非公開リポジトリの集計には GitHub との連携が必要です。", 401);
  }
  const credential = includePrivate ? token : process.env.GITHUB_TOKEN || undefined;
  return withAggregationSlot(async () => {
    try {
      return await fetchLanguageStats(username, includePrivate, credential);
    } catch (error) {
      // Public cards should still work when an optional deployment token has expired.
      if (!includePrivate && credential && (error as { status?: number })?.status === 401) {
        return fetchLanguageStats(username, false);
      }
      throw error;
    }
  });
}

async function fetchLanguageStats(username: string, includePrivate: boolean, token?: string): Promise<LanguageStats> {
  const signal = AbortSignal.timeout(45_000);
  const octokit = new Octokit({
    auth: token,
    request: { signal },
  });
  const appAuthorization = !includePrivate && !token ? getGitHubAppAuthorization() : undefined;
  if (appAuthorization) {
    octokit.hook.before("request", (options) => { options.headers.authorization = appAuthorization; });
  }
  try {
    const repos = await listRepositories(octokit, username, includePrivate);
    const normalizedUsername = username.toLowerCase();
    const targets = repos.filter((repo) =>
      !repo.fork && !repo.archived
      && repo.owner.login.toLowerCase() === normalizedUsername
      && (includePrivate || !repo.private)
    );
    const langMap = new Map<string, number>();
    await mapLimit(targets, 8, async (repo) => {
      const { data } = await octokit.repos.listLanguages({ owner: repo.owner.login, repo: repo.name });
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiError("GitHub の言語データ形式を確認できませんでした。", 502);
      for (const [language, bytes] of Object.entries(data)) {
        if (!Number.isSafeInteger(bytes) || bytes < 0) throw new ApiError("GitHub の言語データ形式を確認できませんでした。", 502);
        if (bytes > 0) langMap.set(language, (langMap.get(language) ?? 0) + bytes);
      }
    });
    const total = [...langMap.values()].reduce((sum, bytes) => sum + bytes, 0);
    const languages = [...langMap.entries()]
      .map(([name, bytes]) => ({ name, bytes, percentage: total === 0 ? 0 : bytes / total }))
      .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
    return { username, includePrivate, repositoryCount: targets.length, languages };
  } catch (error) {
    if (signal.aborted) throw new ApiError("GitHub からの応答がタイムアウトしました。再試行してください。", 504);
    throw error;
  }
}
