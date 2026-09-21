import { type NextRequest } from "next/server";
import { auth } from "../../../auth";
import { getCustomizedLanguageStatsForRequest } from "../../lib/languageStatsRequest";
import { parseBooleanParam } from "../../lib/githubLanguages";
import { ApiError, getApiError } from "../../lib/apiError";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const includePrivate = parseBooleanParam(request.nextUrl.searchParams.get("include_private"));
    const session = includePrivate && !request.nextUrl.searchParams.has("card_token")
      ? await auth() : null;
    const stats = await getCustomizedLanguageStatsForRequest(request, session);
    if (!stats) throw new ApiError("有効な GitHub ユーザー名を入力してください。", 400);
    return Response.json(stats, {
      headers: {
        "Cache-Control": includePrivate ? "private, no-store" : "public, max-age=300, s-maxage=300",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    const { message, status, retryAfter } = getApiError(error);
    return Response.json({ error: message }, {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
      },
    });
  }
}
