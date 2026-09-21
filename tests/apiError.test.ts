import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, getApiError } from "../app/lib/apiError";

test("unexpected upstream errors do not disclose their message", () => {
  const result = getApiError(new Error("private-repository / token=secret"));
  assert.equal(result.status, 502);
  assert.doesNotMatch(result.message, /private-repository|secret/);
});

test("expected input and permission errors preserve their safe status", () => {
  assert.deepEqual(getApiError(new ApiError("ログインが必要です。", 401)), {
    message: "ログインが必要です。", status: 401, retryAfter: undefined,
  });
});

test("rate limits return a bounded retry delay", () => {
  const result = getApiError({ status: 403, response: { headers: { "x-ratelimit-remaining": "0", "retry-after": "120" } } });
  assert.equal(result.status, 429);
  assert.equal(result.retryAfter, 120);
});

test("timeouts and missing users are actionable without leaking upstream details", () => {
  assert.equal(getApiError({ name: "TimeoutError" }).status, 504);
  assert.equal(getApiError({ status: 404 }).status, 404);
  assert.equal(getApiError(null).status, 502);
});
