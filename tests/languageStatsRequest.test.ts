import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { test } from "node:test";
import type { Session } from "next-auth";
import { createCardToken } from "../app/lib/cardToken";
import { getLanguageStatsRequestContext } from "../app/lib/languageStatsRequest";

const TEST_SECRET = "unit-test-request-secret-32-bytes";
const previousSecret = process.env.AUTH_SECRET;
process.env.AUTH_SECRET = TEST_SECRET;

test("public requests do not inherit a signed-in session credential", () => {
  const request = new NextRequest(
    "https://example.test/api/languages?username=alice"
  );
  const context = getLanguageStatsRequestContext(request, sessionFor("alice", "session-token"));

  assert.equal(context.username, "alice");
  assert.equal(context.includePrivate, false);
  assert.equal(context.token, undefined);
});

test("private requests require an authenticated session or scoped card token", () => {
  const request = new NextRequest(
    "https://example.test/api/languages?username=alice&include_private=true"
  );
  assert.throws(() => getLanguageStatsRequestContext(request, null));
});

test("private requests use the signed-in session credential", () => {
  const request = new NextRequest(
    "https://example.test/api/languages?username=alice&include_private=true"
  );
  const context = getLanguageStatsRequestContext(
    request,
    sessionFor("alice", "session-token")
  );

  assert.equal(context.username, "alice");
  assert.equal(context.includePrivate, true);
  assert.equal(context.token, "session-token");
});

test("a card token cannot be replayed for another username", () => {
  const token = createCardToken({
    accessToken: "alice-token",
    username: "alice",
  });
  const params = new URLSearchParams({
    username: "bob",
    include_private: "true",
    card_token: token,
  });
  const request = new NextRequest(
    `https://example.test/api/languages?${params.toString()}`
  );

  assert.throws(() =>
    getLanguageStatsRequestContext(request, sessionFor("bob", "bob-session-token"))
  );
});

test("a valid card token scopes the private request to its embedded username", () => {
  const token = createCardToken({
    accessToken: "alice-token",
    username: "alice",
  });
  const params = new URLSearchParams({
    include_private: "true",
    card_token: token,
  });
  const request = new NextRequest(
    `https://example.test/api/languages?${params.toString()}`
  );
  const context = getLanguageStatsRequestContext(request, null);

  assert.equal(context.username, "alice");
  assert.equal(context.token, "alice-token");
  assert.equal(context.includePrivate, true);
});

function sessionFor(login: string, accessToken?: string): Session {
  return {
    expires: "2099-01-01T00:00:00.000Z",
    user: { login },
    ...(accessToken
      ? { privateCardToken: createCardToken({ accessToken, username: login }) }
      : {}),
  } as unknown as Session;
}

process.on("exit", () => {
  if (previousSecret === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = previousSecret;
  }
});
