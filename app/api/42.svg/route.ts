import { type NextRequest } from "next/server";
import { getApiError } from "../../lib/apiError";
import { PRIVATE_CACHE_CONTROL, publicImageCacheControl } from "../../lib/cacheControl";
import { getAllowedLogins, getFortyTwoStats, resolveLogin } from "../../lib/fortyTwoApi";
import { parseFortyTwoCardOptions, renderFortyTwoSvg } from "../../lib/renderFortyTwoCard";
import { renderErrorSvg } from "../../lib/renderLanguageCard";

export const runtime = "nodejs";

function svgResponse(svg: string, status = 200, retryAfter?: number) {
  return new Response(svg, {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // 42 data changes slowly and the API allows few requests, so cache longer
      // than the language card.
      "Cache-Control": status === 200 ? publicImageCacheControl(1800) : PRIVATE_CACHE_CONTROL,
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
    },
  });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const options = parseFortyTwoCardOptions(params);
  try {
    const login = resolveLogin(params.get("login"), getAllowedLogins());
    return svgResponse(renderFortyTwoSvg(await getFortyTwoStats(login), options));
  } catch (error) {
    const { status, message, retryAfter } = getApiError(error);
    return svgResponse(renderErrorSvg(message, options), status, retryAfter);
  }
}
