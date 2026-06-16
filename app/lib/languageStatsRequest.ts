import { type NextRequest } from "next/server";
import type { Session } from "next-auth";
import { readCardToken } from "./cardToken";
import {
  customizeLanguageStats,
  getLanguageStats,
  parseBooleanParam,
  parseHiddenLanguages,
  parseLanguageCount,
  resolveUsername,
  type LanguageStats,
} from "./githubLanguages";

interface LanguageStatsRequestContext {
  includePrivate: boolean;
  token?: string;
  username: string | null;
}

export function getLanguageStatsRequestContext(
  request: NextRequest,
  session: Session | null
): LanguageStatsRequestContext {
  const cardToken = request.nextUrl.searchParams.get("card_token");
  const privatePayload = cardToken ? readCardToken(cardToken) : null;
  const username =
    privatePayload?.username ??
    resolveUsername(
      request.nextUrl.searchParams.get("username") ??
        session?.user?.login
    );

  return {
    includePrivate: parseBooleanParam(
      request.nextUrl.searchParams.get("include_private")
    ),
    token: privatePayload?.accessToken ?? session?.accessToken,
    username,
  };
}

export async function getCustomizedLanguageStatsForRequest(
  request: NextRequest,
  session: Session | null
): Promise<LanguageStats | null> {
  const context = getLanguageStatsRequestContext(request, session);
  if (!context.username) return null;

  const stats = await getLanguageStats(
    context.username,
    context.includePrivate,
    context.token
  );

  return customizeLanguageStats(stats, {
    count: parseLanguageCount(request.nextUrl.searchParams.get("count")),
    hideLanguages: parseHiddenLanguages(request.nextUrl.searchParams.get("hide")),
  });
}
