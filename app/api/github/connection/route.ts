import { auth } from "../../../../auth";
import { getGitHubConnectionStatus } from "../../../lib/githubConnection";
import { getApiError } from "../../../lib/apiError";

export const runtime = "nodejs";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    return Response.json(await getGitHubConnectionStatus(await auth()), { headers });
  } catch (error) {
    const safe = getApiError(error);
    return Response.json({ error: safe.message }, { status: safe.status, headers: { ...headers, ...(safe.retryAfter ? { "Retry-After": String(safe.retryAfter) } : {}) } });
  }
}
