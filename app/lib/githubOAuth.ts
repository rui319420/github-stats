export function isGitHubConfigured() {
  return Boolean((process.env.AUTH_SECRET?.length ?? 0) >= 32 && process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
}

export function getGitHubAppAuthorization(): string | undefined {
  const id = process.env.AUTH_GITHUB_ID;
  const secret = process.env.AUTH_GITHUB_SECRET;
  if (!id || !secret) return undefined;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}
