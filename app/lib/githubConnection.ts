import type { Session } from "next-auth";
import { ApiError } from "./apiError";
import { readCardToken } from "./cardToken";
import { getGitHubAppAuthorization } from "./githubOAuth";

function credentialForSession(session: Session | null) {
  if (!session?.privateCardToken || !session.user?.login) throw new ApiError("GitHub と連携してください。", 401);
  const credential = readCardToken(session.privateCardToken);
  if (credential.username.toLowerCase() !== session.user.login.toLowerCase()) throw new ApiError("連携ユーザーを確認できませんでした。再連携してください。", 403);
  return credential;
}

function upstreamError(response: Response) {
  // Preserve status/limit headers, never upstream bodies or request credentials.
  return { status: response.status, response: { headers: Object.fromEntries(response.headers) } };
}

export async function getGitHubConnectionStatus(session: Session | null) {
  const { accessToken, username } = credentialForSession(session);
  const response = await fetch("https://api.github.com/rate_limit", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    cache: "no-store", signal: AbortSignal.timeout(10_000), redirect: "error",
  });
  if (!response.ok) throw upstreamError(response);
  const data = await response.json();
  const rate = data?.resources?.core;
  if (!rate || !Number.isSafeInteger(rate.limit) || rate.limit <= 0 || !Number.isSafeInteger(rate.remaining) || rate.remaining < 0 || rate.remaining > rate.limit || !Number.isSafeInteger(rate.reset) || rate.reset <= 0 || rate.reset > 8_640_000_000_000) {
    throw new ApiError("GitHub の利用枠を確認できませんでした。", 502);
  }
  return { username, limit: rate.limit as number, remaining: rate.remaining as number, resetAt: rate.reset as number };
}

export async function revokeGitHubConnection(session: Session | null) {
  const { accessToken } = credentialForSession(session);
  const authorization = getGitHubAppAuthorization();
  const clientId = process.env.AUTH_GITHUB_ID;
  if (!authorization || !clientId) throw new ApiError("GitHub 連携の設定を確認してください。", 503);
  const response = await fetch(`https://api.github.com/applications/${encodeURIComponent(clientId)}/grant`, {
    method: "DELETE", headers: { Authorization: authorization, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }), cache: "no-store", signal: AbortSignal.timeout(10_000), redirect: "error",
  });
  if (!response.ok) throw upstreamError(response);
}
