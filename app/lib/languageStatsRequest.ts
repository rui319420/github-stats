import { type NextRequest } from "next/server";
import type { Session } from "next-auth";
import { readCardToken } from "./cardToken";
import { ApiError } from "./apiError";
import { getPublicLanguageStats } from "./publicLanguageCache";
import {
  customizeLanguageStats, getLanguageStats, parseBooleanParam,
  parseHiddenLanguages, parseLanguageCount, resolveUsername, type LanguageStats,
} from "./githubLanguages";

interface LanguageStatsRequestContext {
  includePrivate: boolean;
  token?: string;
  username: string | null;
}

export function getLanguageStatsRequestContext(
  request: NextRequest, session: Session | null
): LanguageStatsRequestContext {
  const params = request.nextUrl.searchParams;
  const includePrivate = parseBooleanParam(params.get("include_private"));
  const rawUsername = params.get("username");
  if (!includePrivate) {
    // Public output must never depend on viewer cookies or a private card credential.
    return { includePrivate: false, username: resolveUsername(rawUsername) };
  }

  const hasCardToken = params.has("card_token");
  const cardToken = hasCardToken ? params.get("card_token") : session?.privateCardToken;
  if (!cardToken) throw new ApiError("非公開リポジトリの集計には GitHub との連携が必要です。", 401);
  const payload = readCardToken(cardToken);
  if (!hasCardToken && session?.user?.login?.toLowerCase() !== payload.username.toLowerCase()) {
    throw new ApiError("ログイン中のユーザーとカードの所有者が一致しません。", 403);
  }
  if (rawUsername !== null) {
    const username = resolveUsername(rawUsername);
    if (!username) throw new ApiError("有効な GitHub ユーザー名を入力してください。", 400);
    if (username.toLowerCase() !== payload.username.toLowerCase()) {
      throw new ApiError("非公開カードは連携した本人のユーザー名で作成してください。", 403);
    }
  }
  return { includePrivate: true, username: payload.username, token: payload.accessToken };
}

export async function getCustomizedLanguageStatsForRequest(
  request: NextRequest, session: Session | null
): Promise<LanguageStats | null> {
  const context = getLanguageStatsRequestContext(request, session);
  if (!context.username) return null;
  const stats = context.includePrivate
    ? await getLanguageStats(context.username, true, context.token)
    : await getPublicLanguageStats(context.username);
  return customizeLanguageStats(stats, {
    count: parseLanguageCount(request.nextUrl.searchParams.get("count")),
    hideLanguages: parseHiddenLanguages(request.nextUrl.searchParams.get("hide")),
  });
}
