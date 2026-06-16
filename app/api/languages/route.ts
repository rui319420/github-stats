import { type NextRequest } from "next/server";
import { auth } from "../../../auth";
import { getCustomizedLanguageStatsForRequest } from "../../lib/languageStatsRequest";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const customizedStats = await getCustomizedLanguageStatsForRequest(
      request,
      session
    );
    if (!customizedStats) {
      return Response.json(
        {
          error:
            "A valid GitHub username is required via query parameter 'username' or GITHUB_USERNAME env.",
        },
        { status: 400 }
      );
    }

    return Response.json(customizedStats);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch GitHub language data.";
    return Response.json({ error: message }, { status: 502 });
  }
}
