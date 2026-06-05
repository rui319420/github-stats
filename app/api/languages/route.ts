import { type NextRequest } from "next/server";
import {
  getLanguageStats,
  parseBooleanParam,
  resolveUsername,
} from "../../lib/githubLanguages";

export async function GET(request: NextRequest) {
  const username = resolveUsername(request.nextUrl.searchParams.get("username"));
  if (!username) {
    return Response.json(
      {
        error:
          "A valid GitHub username is required via query parameter 'username' or GITHUB_USERNAME env.",
      },
      { status: 400 }
    );
  }

  try {
    const includePrivate = parseBooleanParam(
      request.nextUrl.searchParams.get("include_private")
    );
    const stats = await getLanguageStats(username, includePrivate);
    return Response.json(stats);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch GitHub language data.";
    return Response.json({ error: message }, { status: 502 });
  }
}
