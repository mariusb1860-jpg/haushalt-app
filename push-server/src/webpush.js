// Web Push without payload (RFC 8030) with VAPID authentication (RFC 8292).
// No payload means no encryption is needed: the service worker on the
// phone decides the notification text itself.

const encoder = new TextEncoder();

export function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(text) {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

// keys: { publicKey: base64url raw P-256 point, privateKey: base64url "d" }
async function importPrivateKey({ publicKey, privateKey }) {
  const point = base64UrlDecode(publicKey); // 0x04 | x (32 bytes) | y (32 bytes)
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: privateKey,
    x: base64UrlEncode(point.slice(1, 33)),
    y: base64UrlEncode(point.slice(33, 65)),
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export async function vapidAuthHeader(endpoint, keys, subject, nowSeconds) {
  const json = (value) => base64UrlEncode(encoder.encode(JSON.stringify(value)));
  const head = json({ typ: "JWT", alg: "ES256" });
  const claims = json({ aud: new URL(endpoint).origin, exp: nowSeconds + 12 * 3600, sub: subject });
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    await importPrivateKey(keys),
    encoder.encode(`${head}.${claims}`),
  );
  return `vapid t=${head}.${claims}.${base64UrlEncode(new Uint8Array(signature))}, k=${keys.publicKey}`;
}

// Returns the HTTP status of the push service (201 = accepted).
export async function sendPush(subscription, keys, subject) {
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthHeader(subscription.endpoint, keys, subject, Math.floor(Date.now() / 1000)),
      TTL: "1800",
      Urgency: "high",
    },
  });
  return response.status;
}
