import assert from "node:assert/strict";
import { test } from "node:test";
import { getAllowedLogins, getFortyTwoStats, resetFortyTwoCacheForTests, resolveLogin } from "../app/lib/fortyTwoApi";
import { FORTY_TWO_ACCENT, normalizeFortyTwoUser } from "../app/lib/fortyTwoStats";
import { levelProgress, parseFortyTwoCardOptions, renderFortyTwoSvg } from "../app/lib/renderFortyTwoCard";
import { ApiError } from "../app/lib/apiError";

const user = {
  id: 1,
  login: "alice",
  email: "alice@example.com",
  campus: [{ id: 26, name: "Tokyo" }],
  campus_users: [{ campus_id: 26, is_primary: true }],
  cursus_users: [
    { level: 9.1, grade: null, begin_at: "2025-01-06T00:00:00Z", cursus: { id: 9, slug: "c-piscine", name: "C Piscine" }, skills: [] },
    {
      level: 5.42, grade: "Learner", begin_at: "2025-04-01T00:00:00Z",
      cursus: { id: 21, slug: "42cursus", name: "42cursus" },
      skills: [{ name: "Rigor", level: 4.1 }, { name: "Algorithms & AI", level: 6.25 }, { name: "Unix", level: 3 }],
    },
  ],
  projects_users: [
    { status: "finished", "validated?": true, cursus_ids: [21], project: { name: "Libft", parent_id: null } },
    { status: "finished", "validated?": false, cursus_ids: [21], project: { name: "push_swap", parent_id: null } },
    { status: "finished", "validated?": true, cursus_ids: [9], project: { name: "C Piscine C 00", parent_id: null } },
    { status: "finished", "validated?": true, cursus_ids: [21], project: { name: "part", parent_id: 7 } },
    { status: "in_progress", "validated?": null, cursus_ids: [21], project: { name: "minishell", parent_id: null } },
    { status: "waiting_for_correction", "validated?": null, cursus_ids: [21], project: { name: "<philo>", parent_id: null } },
  ],
};

test("normalizeFortyTwoUser keeps only the main cursus and top-level projects", () => {
  const stats = normalizeFortyTwoUser(user, [{ name: "Old", color: "#111111" }, { name: "Gun", color: "#FF6950" }]);
  assert.ok(stats);
  assert.equal(stats.level, 5.42);
  assert.equal(stats.campus, "Tokyo");
  assert.equal(stats.grade, "Learner");
  assert.equal(stats.completedProjects, 1);
  assert.deepEqual(stats.currentProjects, [
    { name: "minishell", status: "in_progress" },
    { name: "<philo>", status: "waiting_for_correction" },
  ]);
  assert.deepEqual(stats.skills.map((skill) => skill.name), ["Algorithms & AI", "Rigor", "Unix"]);
  assert.deepEqual(stats.coalition, { name: "Gun", color: "#ff6950" });
  assert.equal(JSON.stringify(stats).includes("example.com"), false);
});

test("normalizeFortyTwoUser tolerates missing data and unsafe coalition colors", () => {
  assert.equal(normalizeFortyTwoUser(null), null);
  assert.equal(normalizeFortyTwoUser({}), null);
  const stats = normalizeFortyTwoUser({ login: "bob" }, [{ name: "X", color: "red\" onload=\"x" }]);
  assert.ok(stats);
  assert.equal(stats.level, 0);
  assert.equal(stats.coalition?.color, FORTY_TWO_ACCENT);
});

test("levelProgress splits the level and never shows 100%", () => {
  assert.deepEqual(levelProgress(5.42), { whole: 5, percent: 42 });
  assert.deepEqual(levelProgress(5.999), { whole: 5, percent: 99 });
  assert.deepEqual(levelProgress(0), { whole: 0, percent: 0 });
});

test("renderFortyTwoSvg escapes names and stays self-contained", () => {
  const stats = normalizeFortyTwoUser(user, [{ name: "Gun & Co", color: "#ff6950" }])!;
  const options = parseFortyTwoCardOptions(new URLSearchParams({ skills: "2", theme: "auto" }));
  const svg = renderFortyTwoSvg(stats, options);
  assert.match(svg, /Lv\. <\/tspan>5</);
  assert.match(svg, /42% → Lv\. 6/);
  assert.match(svg, /&lt;philo&gt;/);
  assert.match(svg, /Gun &amp; Co/);
  assert.match(svg, /評価待ち/);
  assert.match(svg, /Algorithms &amp; AI/);
  assert.equal(svg.includes("Unix"), false);
  assert.equal(/<script|href=|url\(/i.test(svg), false);
  assert.match(svg, /--card-language-0/);
});

test("renderFortyTwoSvg handles an empty profile and hidden sections", () => {
  const stats = normalizeFortyTwoUser({ login: "bob" })!;
  const svg = renderFortyTwoSvg(stats, parseFortyTwoCardOptions(new URLSearchParams()));
  assert.match(svg, /現在取り組み中の課題はありません/);
  assert.equal(svg.includes("スキル"), false);
  const compact = renderFortyTwoSvg(stats, parseFortyTwoCardOptions(new URLSearchParams({ projects: "0" })));
  assert.equal(compact.includes("取り組み中の課題"), false);
});

test("only allowlisted logins are served", () => {
  const allowed = getAllowedLogins({ FORTYTWO_LOGIN: " Alice, bob ,../etc" });
  assert.deepEqual(allowed, ["alice", "bob"]);
  assert.equal(resolveLogin(null, allowed), "alice");
  assert.equal(resolveLogin("BOB", allowed), "bob");
  assert.throws(() => resolveLogin("mallory", allowed), (error) => error instanceof ApiError && error.status === 403);
  assert.throws(() => resolveLogin(null, []), (error) => error instanceof ApiError && error.status === 503);
});

test("getFortyTwoStats reuses the token and the cached result", async () => {
  resetFortyTwoCacheForTests();
  process.env.FORTYTWO_CLIENT_ID = "id";
  process.env.FORTYTWO_CLIENT_SECRET = "secret";
  const calls: string[] = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/oauth/token")) return Response.json({ access_token: "t", expires_in: 7200 });
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer t");
    if (url.endsWith("/coalitions")) return new Response("nope", { status: 500 });
    return Response.json(user);
  }) as typeof fetch;
  const first = await getFortyTwoStats("alice", fakeFetch);
  const second = await getFortyTwoStats("alice", fakeFetch);
  assert.equal(first, second);
  assert.equal(first.coalition, null);
  assert.equal(calls.length, 3);
  resetFortyTwoCacheForTests();
});

test("getFortyTwoStats hides upstream details and does not cache failures", async () => {
  resetFortyTwoCacheForTests();
  process.env.FORTYTWO_CLIENT_ID = "id";
  process.env.FORTYTWO_CLIENT_SECRET = "secret";
  const failing = (async () => new Response("secret upstream body", { status: 401 })) as typeof fetch;
  await assert.rejects(getFortyTwoStats("alice", failing), (error) =>
    error instanceof ApiError && error.status === 502 && !error.message.includes("upstream"));
  const working = (async (input: string | URL | Request) =>
    String(input).endsWith("/oauth/token") ? Response.json({ access_token: "t", expires_in: 7200 }) : Response.json(user)) as typeof fetch;
  assert.equal((await getFortyTwoStats("alice", working)).login, "alice");
  resetFortyTwoCacheForTests();
});
