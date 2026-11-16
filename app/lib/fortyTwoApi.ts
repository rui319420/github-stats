import { ApiError } from "./apiError";
import { normalizeFortyTwoUser, type FortyTwoStats } from "./fortyTwoStats";

const API_ORIGIN = "https://api.intra.42.fr";
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30 * 60_000;
const TOKEN_MARGIN_MS = 60_000;

type Fetch = typeof fetch;

interface TokenEntry {
  value: string;
  expiresAt: number;
}

interface CacheEntry {
  promise: Promise<FortyTwoStats>;
  expiresAt: number;
}

let token: TokenEntry | null = null;
const cache = new Map<string, CacheEntry>();

// The application credentials can read any student's profile. Only logins the
// operator listed in FORTYTWO_LOGIN are served, so this deployment cannot be
// used as an open proxy to other people's 42 data.
export function getAllowedLogins(env: Record<string, string | undefined> = process.env): string[] {
  return (env.FORTYTWO_LOGIN ?? "")
    .split(",")
    .map((login) => login.trim().toLowerCase())
    .filter((login) => /^[a-z0-9-]{1,32}$/.test(login));
}

export function resolveLogin(requested: string | null, allowed: string[]): string {
  if (!allowed.length) {
    throw new ApiError("42 カードが未設定です。FORTYTWO_LOGIN を設定してください。", 503);
  }
  const login = requested?.trim().toLowerCase();
  if (!login) return allowed[0];
  if (!allowed.includes(login)) {
    throw new ApiError("この 42 ログインは表示対象に設定されていません。", 403);
  }
  return login;
}

function upstreamError(status: number, retryAfter: string | null): ApiError {
  if (status === 429) {
    const wait = Number(retryAfter);
    return new ApiError("42 API の利用上限に達しました。時間をおいて再試行してください。", 429,
      Number.isFinite(wait) && wait > 0 ? Math.ceil(Math.min(wait, 3600)) : 60);
  }
  if (status === 401 || status === 403) {
    return new ApiError("42 API の認証に失敗しました。アプリの UID と SECRET を確認してください。", 502);
  }
  if (status === 404) return new ApiError("42 のユーザーが見つかりません。", 404);
  return new ApiError("42 のデータを取得できませんでした。時間をおいて再試行してください。", 502);
}

async function request(fetchImpl: Fetch, url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    // Never surface upstream exception text: it can contain request details.
    throw new ApiError("42 API からの応答がありませんでした。再試行してください。", 504);
  }
  if (!response.ok) {
    // Status and path only: enough to tell bad credentials (token 401) from a
    // blocked or missing resource, without logging secrets or response bodies.
    console.error(`[42] ${init.method ?? "GET"} ${new URL(url).pathname} -> ${response.status}`);
    throw upstreamError(response.status, response.headers.get("retry-after"));
  }
  try {
    return await response.json();
  } catch {
    throw new ApiError("42 のデータを取得できませんでした。時間をおいて再試行してください。", 502);
  }
}

// Values pasted into a host's settings often carry a trailing newline or the
// quotes from an .env line; 42 rejects those as invalid credentials.
export function credential(value: string | undefined): string {
  return (value ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
}

async function getToken(fetchImpl: Fetch): Promise<string> {
  if (token && token.expiresAt > Date.now()) return token.value;
  const clientId = credential(process.env.FORTYTWO_CLIENT_ID);
  const clientSecret = credential(process.env.FORTYTWO_CLIENT_SECRET);
  if (!clientId || !clientSecret) {
    throw new ApiError("42 カードが未設定です。FORTYTWO_CLIENT_ID と FORTYTWO_CLIENT_SECRET を設定してください。", 503);
  }
  const payload = await request(fetchImpl, `${API_ORIGIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  }).catch((error: unknown) => {
    // Shape only, never the values: shows a swapped, truncated or mispasted
    // credential in the host's logs.
    console.error(`[42] credentials: id length=${clientId.length} prefix=${clientId.startsWith("u-")}, `
      + `secret length=${clientSecret.length} prefix=${clientSecret.startsWith("s-")}`);
    throw error;
  }) as { access_token?: unknown; expires_in?: unknown } | null;
  if (typeof payload?.access_token !== "string" || !payload.access_token) {
    throw new ApiError("42 API の認証に失敗しました。アプリの UID と SECRET を確認してください。", 502);
  }
  const lifetime = typeof payload.expires_in === "number" && payload.expires_in > 0 ? payload.expires_in * 1000 : 0;
  token = { value: payload.access_token, expiresAt: Date.now() + Math.max(0, lifetime - TOKEN_MARGIN_MS) };
  return token.value;
}

async function fetchStats(login: string, fetchImpl: Fetch): Promise<FortyTwoStats> {
  const headers = { Authorization: `Bearer ${await getToken(fetchImpl)}` };
  const path = `${API_ORIGIN}/v2/users/${encodeURIComponent(login)}`;
  // Sequential on purpose: 42 allows only 2 requests per second per application.
  const user = await request(fetchImpl, path, { headers });
  // The coalition only supplies the accent color, so its failure is not fatal.
  const coalitions = await request(fetchImpl, `${path}/coalitions`, { headers }).catch(() => null);
  const stats = normalizeFortyTwoUser(user, coalitions);
  if (!stats) throw new ApiError("42 のデータを取得できませんでした。時間をおいて再試行してください。", 502);
  return stats;
}

// `login` must come from resolveLogin, which bounds the cache to the allowlist.
export function getFortyTwoStats(login: string, fetchImpl: Fetch = fetch): Promise<FortyTwoStats> {
  const cached = cache.get(login);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const entry: CacheEntry = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    promise: fetchStats(login, fetchImpl),
  };
  cache.set(login, entry);
  entry.promise = entry.promise.catch((error: unknown) => {
    if (cache.get(login) === entry) cache.delete(login);
    // A rejected token must not be reused for the next attempt.
    if (error instanceof ApiError && error.status === 502) token = null;
    throw error;
  });
  return entry.promise;
}

export function resetFortyTwoCacheForTests() {
  token = null;
  cache.clear();
}
