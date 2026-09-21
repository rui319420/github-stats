import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import type { Session } from "next-auth";
import { createCardToken } from "../app/lib/cardToken";
import { getGitHubConnectionStatus, revokeGitHubConnection } from "../app/lib/githubConnection";
import { getLanguageStats } from "../app/lib/githubLanguages";
import { isGitHubConfigured } from "../app/lib/githubOAuth";

const keys = ["AUTH_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET", "GITHUB_TOKEN"] as const;
let saved: (string | undefined)[];
beforeEach(() => {
  saved = keys.map((key) => process.env[key]);
  process.env.AUTH_SECRET = "test-only-secret-at-least-32-characters";
  process.env.AUTH_GITHUB_ID = "test-client";
  process.env.AUTH_GITHUB_SECRET = "test-client-secret";
  delete process.env.GITHUB_TOKEN;
});
afterEach(() => keys.forEach((key, index) => {
  if (saved[index] === undefined) delete process.env[key];
  else process.env[key] = saved[index];
}));
const session = (): Session => ({ user: { login: "alice" }, expires: "2099-01-01", privateCardToken: createCardToken({ username: "alice", accessToken: "fake-user-token" }) });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

test("OAuth is enabled only with all required configuration", () => {
  assert.equal(isGitHubConfigured(), true);
  delete process.env.AUTH_GITHUB_ID;
  assert.equal(isGitHubConfigured(), false);
  process.env.AUTH_GITHUB_ID = "test-client";
  process.env.AUTH_SECRET = "short";
  assert.equal(isGitHubConfigured(), false);
});

test("public aggregation uses OAuth app credentials without a personal token", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async (_input: string, options: RequestInit) => {
    assert.equal(new Headers(options.headers).get("authorization"), `Basic ${Buffer.from("test-client:test-client-secret").toString("base64")}`);
    return json([]);
  });
  assert.equal((await getLanguageStats("alice", false, "ignored-session-token")).repositoryCount, 0);
  assert.equal(mock.mock.callCount(), 1);
});

test("expired public PAT falls back to app authentication", async (t) => {
  process.env.GITHUB_TOKEN = "expired-token";
  const schemes: string[] = [];
  t.mock.method(globalThis, "fetch", async (_input: string, options: RequestInit) => {
    const header = new Headers(options.headers).get("authorization") ?? "";
    schemes.push(header.split(" ")[0]);
    return header.startsWith("Basic ") ? json([]) : json({ message: "Bad credentials" }, 401);
  });
  await getLanguageStats("alice", false);
  assert.deepEqual(schemes, ["token", "Basic"]);
});

test("app credentials never grant anonymous private access", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => json([]));
  await assert.rejects(getLanguageStats("alice", true), { status: 401 });
  assert.equal(mock.mock.callCount(), 0);
});

test("connection status requires a session and returns only safe rate metadata", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async (input: string, options: RequestInit) => {
    assert.equal(input, "https://api.github.com/rate_limit");
    assert.equal(new Headers(options.headers).get("authorization"), "Bearer fake-user-token");
    assert.equal(options.cache, "no-store");
    return json({ resources: { core: { limit: 5000, remaining: 4900, reset: 1900000000 } }, secret: "do-not-return" });
  });
  await assert.rejects(getGitHubConnectionStatus(null), { status: 401 });
  assert.equal(mock.mock.callCount(), 0);
  assert.deepEqual(await getGitHubConnectionStatus(session()), { username: "alice", limit: 5000, remaining: 4900, resetAt: 1900000000 });
});

test("connection status rejects a mismatched session owner before fetching", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => json({}));
  await assert.rejects(getGitHubConnectionStatus({ ...session(), user: { login: "bob" } }), { status: 403 });
  assert.equal(mock.mock.callCount(), 0);
});

test("connection status rejects malformed metadata and expired credentials", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => json({ resources: { core: { limit: 5000, remaining: -1, reset: 0 } } }));
  await assert.rejects(getGitHubConnectionStatus(session()), { status: 502 });
  mock.mock.mockImplementation(async () => json({ secret: "do-not-expose" }, 401));
  await assert.rejects(getGitHubConnectionStatus(session()), { status: 401 });
});

test("disconnect revokes only the authenticated user's grant", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async (input: string, options: RequestInit) => {
    assert.equal(input, "https://api.github.com/applications/test-client/grant");
    assert.equal(options.method, "DELETE");
    assert.deepEqual(JSON.parse(options.body as string), { access_token: "fake-user-token" });
    assert.ok(new Headers(options.headers).get("authorization")?.startsWith("Basic "));
    return new Response(null, { status: 204 });
  });
  await assert.rejects(revokeGitHubConnection(null), { status: 401 });
  assert.equal(mock.mock.callCount(), 0);
  await revokeGitHubConnection(session());
  assert.equal(mock.mock.callCount(), 1);
});

test("failed revocation is not reported as a success", async (t) => {
  t.mock.method(globalThis, "fetch", async () => json({}, 403));
  await assert.rejects(revokeGitHubConnection(session()), { status: 403 });
});
