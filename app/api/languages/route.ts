import { type NextRequest } from "next/server";
import { auth } from "../../../auth";
import { readCardToken } from "../../lib/cardToken";
import {
  getLanguageStats,
  parseBooleanParam,
  resolveUsername,
} from "../../lib/githubLanguages";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const cardToken = request.nextUrl.searchParams.get("card_token");
    const privatePayload = cardToken ? readCardToken(cardToken) : null;
    const username =
      privatePayload?.username ??
      resolveUsername(
        request.nextUrl.searchParams.get("username") ??
          session?.user?.login
      );
    if (!username) {
      return Response.json(
        {
          error:
            "A valid GitHub username is required via query parameter 'username' or GITHUB_USERNAME env.",
        },
        { status: 400 }
      );
    }

    const includePrivate = parseBooleanParam(
      request.nextUrl.searchParams.get("include_private")
    );
    const token = privatePayload?.accessToken ?? session?.accessToken;
    const stats = await getLanguageStats(username, includePrivate, token);
    return Response.json(stats);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch GitHub language data.";
    return Response.json({ error: message }, { status: 502 });
  }
}
