import assert from "node:assert/strict";
import { test } from "node:test";
import { getPublicLanguageStats } from "../app/lib/publicLanguageCache";

function emptyRepositories() {
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
}

test("simultaneous public requests share one GitHub aggregation", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return emptyRepositories();
  });
  const [first, second] = await Promise.all([
    getPublicLanguageStats("cache-concurrent"),
    getPublicLanguageStats("CACHE-CONCURRENT"),
  ]);
  assert.equal(requests, 1);
  assert.deepEqual(first, second);
  assert.equal(first.includePrivate, false);
});

test("a failed aggregation is not cached", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return requests === 1
      ? new Response('{"message":"Unavailable"}', { status: 503, headers: { "content-type": "application/json" } })
      : emptyRepositories();
  });
  await assert.rejects(getPublicLanguageStats("cache-failure"));
  assert.equal((await getPublicLanguageStats("cache-failure")).repositoryCount, 0);
  assert.equal(requests, 2);
});

test("public cache expires after five minutes", async (t) => {
  let requests = 0;
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return emptyRepositories();
  });
  await getPublicLanguageStats("cache-expiry");
  now += 299_999;
  await getPublicLanguageStats("cache-expiry");
  assert.equal(requests, 1);
  now += 2;
  await getPublicLanguageStats("cache-expiry");
  assert.equal(requests, 2);
});
