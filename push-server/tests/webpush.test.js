import { test } from "node:test";
import assert from "node:assert/strict";
import { vapidAuthHeader, base64UrlEncode, base64UrlDecode } from "../src/webpush.js";

async function makeVapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const { d } = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKey: base64UrlEncode(publicRaw), privateKey: d };
}

function decodeJson(part) {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
}

test("base64url round trip", () => {
  const bytes = new Uint8Array([0, 251, 255, 62, 63, 1]);
  assert.deepEqual(base64UrlDecode(base64UrlEncode(bytes)), bytes);
  assert.doesNotMatch(base64UrlEncode(bytes), /[+/=]/);
});

test("vapidAuthHeader builds a valid ES256 token for the push service", async () => {
  const keys = await makeVapidKeys();
  const header = await vapidAuthHeader(
    "https://fcm.googleapis.com/fcm/send/abc123",
    keys,
    "https://example.github.io/app/",
    1_800_000_000,
  );

  const match = header.match(/^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/);
  assert.ok(match, header);
  const [, head, claims, signature, k] = match;

  assert.deepEqual(decodeJson(head), { typ: "JWT", alg: "ES256" });
  assert.deepEqual(decodeJson(claims), {
    aud: "https://fcm.googleapis.com",
    exp: 1_800_000_000 + 12 * 3600,
    sub: "https://example.github.io/app/",
  });
  assert.equal(k, keys.publicKey);

  const publicKey = await crypto.subtle.importKey(
    "raw",
    base64UrlDecode(keys.publicKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    base64UrlDecode(signature),
    new TextEncoder().encode(`${head}.${claims}`),
  );
  assert.equal(valid, true);
});
