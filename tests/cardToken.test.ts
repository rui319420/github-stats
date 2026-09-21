import assert from "node:assert/strict";
import { createCipheriv, createHash } from "node:crypto";
import { after, before, test } from "node:test";
import { createCardToken, readCardToken } from "../app/lib/cardToken";

const TEST_SECRET = "unit-test-card-token-secret-32-bytes";
const previousSecret = process.env.AUTH_SECRET;

before(() => {
  process.env.AUTH_SECRET = TEST_SECRET;
});

after(() => {
  if (previousSecret === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = previousSecret;
  }
});

function encryptPayload(payload: unknown, ivLength = 12, authTagLength = 16) {
  const key = createHash("sha256").update(TEST_SECRET).digest();
  const iv = Buffer.alloc(ivLength, 7);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength });
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

test("card tokens round-trip the scoped GitHub credential and username", () => {
  const token = createCardToken({
    accessToken: "github-access-token",
    username: "alice",
  });

  assert.deepEqual(readCardToken(token), {
    accessToken: "github-access-token",
    username: "alice",
  });
  assert.match(token, /^v1[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+$/);
});

test("card tokens reject malformed structure and tampering", () => {
  for (const malformed of ["", "v2.a.b.c", "v1.a.b", "v1.@@@.@@@.@@@", "v1..."]) {
    assert.throws(() => readCardToken(malformed));
  }

  const parts = createCardToken({
    accessToken: "github-access-token",
    username: "alice",
  }).split(".");
  const ciphertext = Buffer.from(parts[3], "base64url");
  ciphertext[0] ^= 0xff;
  parts[3] = ciphertext.toString("base64url");
  assert.throws(() => readCardToken(parts.join(".")));
});

test("card tokens reject unexpected IV and authentication-tag lengths", () => {
  assert.throws(() =>
    readCardToken(encryptPayload({ accessToken: "token", username: "alice" }, 8, 16))
  );
  assert.throws(() =>
    readCardToken(encryptPayload({ accessToken: "token", username: "alice" }, 12, 8))
  );
});

test("card tokens require string credential and username payload fields", () => {
  assert.throws(() =>
    readCardToken(encryptPayload({ accessToken: 123, username: "alice" }))
  );
  assert.throws(() =>
    readCardToken(encryptPayload({ accessToken: "token", username: 123 }))
  );
  assert.throws(() =>
    readCardToken(encryptPayload({ accessToken: "token", username: "" }))
  );
});

test("card tokens fail closed when the encryption secret is missing or too short", () => {
  const payload = { accessToken: "github-access-token", username: "alice" };
  const token = createCardToken(payload);
  try {
    for (const secret of [undefined, "", "short", "x".repeat(31)]) {
      if (secret === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = secret;
      for (const operation of [() => createCardToken(payload), () => readCardToken(token)]) {
        assert.throws(operation, (error: unknown) =>
          error instanceof Error && "status" in error && error.status === 503);
      }
    }
  } finally {
    process.env.AUTH_SECRET = TEST_SECRET;
  }
});
