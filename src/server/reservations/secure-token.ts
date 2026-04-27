import "server-only";

// 予約の secure_token を生成・検証するユーティリティ。トークンは必ず
// サーバー側で生成し、メール本文の URL と DB にのみ保存する。
// 生成には Web Crypto (globalThis.crypto.getRandomValues) を使い、
// Node / Edge いずれのランタイムでも動くようにする。

const TOKEN_BYTES = 32;

/**
 * DB 側の CHECK 制約 `length(secure_token) >= 32` と一致させる。
 * 32 バイトを base64url エンコードすると 43 文字になるため、この下限は安全。
 */
export const SECURE_TOKEN_MIN_LENGTH = 32;

const BASE64URL_REGEX = /^[A-Za-z0-9_-]+$/;

export function generateSecureToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function isSecureTokenFormat(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= SECURE_TOKEN_MIN_LENGTH &&
    BASE64URL_REGEX.test(value)
  );
}

function toBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
