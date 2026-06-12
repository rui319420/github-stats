import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

interface CardTokenPayload {
  accessToken: string;
  username: string;
}

const TOKEN_VERSION = "v1";

function getEncryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required to create private card URLs.");
  }
  return createHash("sha256").update(secret).digest();
}

function encode(value: Buffer) {
  return value.toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

export function createCardToken(payload: CardTokenPayload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [TOKEN_VERSION, encode(iv), encode(tag), encode(encrypted)].join(".");
}

export function readCardToken(token: string): CardTokenPayload {
  const [version, iv, tag, encrypted] = token.split(".");
  if (version !== TOKEN_VERSION || !iv || !tag || !encrypted) {
    throw new Error("Invalid private card token.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), decode(iv));
  decipher.setAuthTag(decode(tag));
  const decrypted = Buffer.concat([
    decipher.update(decode(encrypted)),
    decipher.final(),
  ]);
  const payload = JSON.parse(decrypted.toString("utf8")) as Partial<CardTokenPayload>;

  if (!payload.accessToken || !payload.username) {
    throw new Error("Invalid private card token payload.");
  }

  return {
    accessToken: payload.accessToken,
    username: payload.username,
  };
}
