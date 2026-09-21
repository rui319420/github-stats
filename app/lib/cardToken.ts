import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ApiError } from "./apiError";

interface CardTokenPayload {
  accessToken: string;
  username: string;
}

const TOKEN_VERSION = "v1";
const USERNAME_PATTERN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const ENCODED_PATTERN = /^[A-Za-z0-9_-]+$/;
const INVALID_TOKEN = "非公開カードの URL が無効です。ログインして作成し直してください。";

function getEncryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new ApiError("非公開カードには32文字以上のランダムな AUTH_SECRET が必要です。", 503);
  return createHash("sha256").update(secret).digest();
}

function isPayload(value: unknown): value is CardTokenPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<CardTokenPayload>;
  return typeof payload.accessToken === "string"
    && payload.accessToken.length > 0
    && payload.accessToken.length <= 4096
    && !/\s/.test(payload.accessToken)
    && typeof payload.username === "string"
    && USERNAME_PATTERN.test(payload.username);
}

export function createCardToken(payload: CardTokenPayload) {
  if (!isPayload(payload)) throw new ApiError(INVALID_TOKEN, 401);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return [TOKEN_VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function readCardToken(token: string): CardTokenPayload {
  if (typeof token !== "string" || token.length > 8192) throw new ApiError(INVALID_TOKEN, 401);
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION || !parts.slice(1).every((part) => ENCODED_PATTERN.test(part))) {
    throw new ApiError(INVALID_TOKEN, 401);
  }
  const [, rawIv, rawTag, rawEncrypted] = parts;
  const iv = Buffer.from(rawIv, "base64url");
  const tag = Buffer.from(rawTag, "base64url");
  const encrypted = Buffer.from(rawEncrypted, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0
    || [iv, tag, encrypted].some((value, i) => value.toString("base64url") !== parts[i + 1])) {
    throw new ApiError(INVALID_TOKEN, 401);
  }
  const key = getEncryptionKey();
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const payload: unknown = JSON.parse(decrypted.toString("utf8"));
    if (!isPayload(payload)) throw new Error("Invalid payload");
    return { accessToken: payload.accessToken, username: payload.username };
  } catch {
    // All decoding failures share one response; crypto internals never reach the caller.
    throw new ApiError(INVALID_TOKEN, 401);
  }
}
