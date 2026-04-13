import { Octokit } from "@octokit/rest";
import { type NextRequest } from "next/server";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const EXCLUDED_LANGUAGES = new Set(["ShaderLab", "HLSL", "GLSL", "Jupyter Notebook"]);
const GITHUB_USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

function resolveUsername(request: NextRequest): string | null {
  const raw = request.nextUrl.searchParams.get("username")?.trim();
  const username = raw || process.env.GITHUB_USERNAME?.trim() || "";
  if (!username || !GITHUB_USERNAME_RE.test(username)) return null;
  return username;
}

export async function GET(request: NextRequest) {
  const username = resolveUsername(request);
  if (!username) {
    return Response.json(
      {
        error: "A valid GitHub username is required via query parameter 'username' or GITHUB_USERNAME env.",
      },
      { status: 400 }
    );
  }

  try {
    const repos = await octokit.paginate(octokit.repos.listForUser, {
      username,
      per_page: 100,
      sort: "updated",
    });

    const langMap: Record<string, number> = {};
    const targets = repos.filter((repo) => !repo.fork && !repo.archived);

    await Promise.all(
      targets.map(async (repo) => {
        const { data } = await octokit.repos.listLanguages({
          owner: username,
          repo: repo.name,
        });
        for (const [lang, bytes] of Object.entries(data)) {
          if (EXCLUDED_LANGUAGES.has(lang)) continue;
          langMap[lang] = (langMap[lang] ?? 0) + bytes;
        }
      })
    );

    const total = Object.values(langMap).reduce((a, b) => a + b, 0);
    const result =
      total === 0
        ? []
        : Object.entries(langMap)
            .map(([name, bytes]) => ({ name, bytes, percentage: bytes / total }))
            .sort((a, b) => b.bytes - a.bytes);

    return Response.json({ username, languages: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch GitHub language data.";
    return Response.json({ error: message }, { status: 502 });
  }
}
