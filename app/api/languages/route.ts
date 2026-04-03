import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function GET() {
  const repos = await octokit.repos.listForUser({
    username: process.env.GITHUB_USERNAME!,
    per_page: 100,
  });

  const langMap: Record<string, number> = {};
  await Promise.all(
    repos.data.map(async (repo) => {
      const { data } = await octokit.repos.listLanguages({
        owner: process.env.GITHUB_USERNAME!,
        repo: repo.name,
      });
      for (const [lang, bytes] of Object.entries(data)) {
        langMap[lang] = (langMap[lang] ?? 0) + bytes;
      }
    })
  );

  const total = Object.values(langMap).reduce((a, b) => a + b, 0);
  const result = Object.entries(langMap)
    .map(([name, bytes]) => ({ name, bytes, percentage: bytes / total }))
    .sort((a, b) => b.bytes - a.bytes);

  return Response.json(result);
}
