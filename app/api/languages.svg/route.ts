import { type NextRequest } from "next/server";
import { auth } from "../../../auth";
import { getCustomizedLanguageStatsForRequest } from "../../lib/languageStatsRequest";
import { parseBooleanParam } from "../../lib/githubLanguages";
import { getApiError } from "../../lib/apiError";
import { parseCardOptions, renderErrorSvg, renderStatsSvg } from "../../lib/renderLanguageCard";

export const runtime = "nodejs";

function svgResponse(svg: string, status = 200, isPrivate = false, retryAfter?: number) {
  return new Response(svg, {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": status !== 200 || isPrivate
        ? "private, no-store"
        : "public, max-age=300, s-maxage=300",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const includePrivate = parseBooleanParam(request.nextUrl.searchParams.get("include_private"));
    const session = includePrivate && !request.nextUrl.searchParams.has("card_token")
      ? await auth()
      : null;
    const stats = await getCustomizedLanguageStatsForRequest(request, session);
    if (!stats) {
      return svgResponse(renderErrorSvg("有効な GitHub ユーザー名を入力してください。"), 400);
    }
    return svgResponse(renderStatsSvg(stats, parseCardOptions(request.nextUrl.searchParams)), 200, includePrivate);
  } catch (error) {
    const { status, message, retryAfter } = getApiError(error);
    return svgResponse(renderErrorSvg(message), status, true, retryAfter);
  }
}
