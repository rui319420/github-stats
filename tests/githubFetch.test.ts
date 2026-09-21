import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { getLanguageStats } from "../app/lib/githubLanguages";

let previousToken: string | undefined;
beforeEach(() => { previousToken = process.env.GITHUB_TOKEN; delete process.env.GITHUB_TOKEN; });
afterEach(() => {
  if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = previousToken;
});
const repo = (name: string, fields = {}) => ({ name, owner: { login: "alice" }, fork: false, archived: false, private: false, ...fields });
const json = (data: unknown, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });

test("public aggregation follows pagination, includes all languages, and excludes forks/archives/private repositories", async (t) => {
  const visited: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string, options: RequestInit) => {
    const url = new URL(input);
    visited.push(url.pathname);
    assert.equal(new Headers(options.headers).get("authorization"), null);
    if (url.pathname === "/users/alice/repos") {
      if (url.searchParams.get("page") === "2") return json([repo("second"), repo("fork", { fork: true }), repo("archived", { archived: true }), repo("private", { private: true })]);
      return json([repo("first")], 200, { link: '<https://api.github.com/users/alice/repos?page=2>; rel="next"' });
    }
    if (url.pathname === "/repos/alice/first/languages") return json({ TypeScript: 80, ShaderLab: 20 });
    if (url.pathname === "/repos/alice/second/languages") return json({ TypeScript: 20, "Jupyter Notebook": 80 });
    throw new Error("Unexpected endpoint");
  });
  const result = await getLanguageStats("alice", false, "must-not-use-this-session-token");
  assert.equal(result.repositoryCount, 2);
  assert.equal(result.languages.find((language) => language.name === "TypeScript")?.percentage, .5);
  assert.ok(result.languages.some((language) => language.name === "ShaderLab"));
  assert.ok(result.languages.some((language) => language.name === "Jupyter Notebook"));
  assert.equal(visited.length, 4);
});

test("private aggregation verifies the owner and includes only their own repositories", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: string) => {
    const path = new URL(input).pathname;
    if (path === "/user") return json({ login: "alice" });
    if (path === "/user/repos") return json([repo("public"), repo("private", { private: true }), repo("organization", { owner: { login: "other" }, private: true })]);
    if (path === "/repos/alice/public/languages") return json({ TypeScript: 25 });
    if (path === "/repos/alice/private/languages") return json({ Python: 75 });
    throw new Error("Unexpected endpoint");
  });
  const result = await getLanguageStats("alice", true, "fake-private-token");
  assert.equal(result.repositoryCount, 2);
  assert.equal(result.includePrivate, true);
  assert.equal(result.languages[0].name, "Python");
  assert.equal(result.languages[0].percentage, .75);
});

test("a deployment token never authorizes anonymous private aggregation", async (t) => {
  process.env.GITHUB_TOKEN = "fake-deployment-token";
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Must not fetch"); });
  await assert.rejects(getLanguageStats("alice", true), { status: 401 });
  assert.equal(fetch.mock.callCount(), 0);
});

test("private credentials belonging to another owner are rejected", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => json({ login: "bob" }));
  await assert.rejects(getLanguageStats("alice", true, "fake-bob-token"), { status: 403 });
  assert.equal(fetch.mock.callCount(), 1);
});

test("expired optional deployment token falls back once for public data only", async (t) => {
  process.env.GITHUB_TOKEN = "fake-expired-token";
  const fetch = t.mock.method(globalThis, "fetch", async (_input: string, options: RequestInit) =>
    new Headers(options.headers).has("authorization") ? json({ message: "Bad credentials" }, 401) : json([])
  );
  assert.equal((await getLanguageStats("alice", false)).repositoryCount, 0);
  assert.equal(fetch.mock.callCount(), 2);
});

test("failed private credentials never fall back to anonymous data", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => json({ message: "Bad credentials" }, 401));
  await assert.rejects(getLanguageStats("alice", true, "fake-expired-token"), { status: 401 });
  assert.equal(fetch.mock.callCount(), 1);
});

test("one failed repository rejects the whole aggregation", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: string) => {
    const path = new URL(input).pathname;
    if (path === "/users/alice/repos") return json([repo("ok"), repo("broken")]);
    if (path === "/repos/alice/ok/languages") return json({ TypeScript: 100 });
    return json({ message: "Unavailable" }, 503);
  });
  await assert.rejects(getLanguageStats("alice", false), { status: 503 });
});
