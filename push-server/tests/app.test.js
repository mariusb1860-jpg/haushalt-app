import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { handleRequest, remind } from "../src/app.js";
import { base64UrlEncode } from "../src/webpush.js";

const KEY = "test-key-0123456789abcdef";
const ORIGIN = "https://mariusb1860-jpg.github.io";
const SUBSCRIPTION = { endpoint: "https://push.example.com/send/abc", keys: { p256dh: "x", auth: "y" } };
const AT_2030 = Date.UTC(2026, 9, 8, 18, 30); // 08.10. 20:30 Berlin
const AT_2130 = Date.UTC(2026, 9, 8, 19, 30); // 08.10. 21:30 Berlin

class MemoryKV {
  store = new Map();
  async get(key, type) {
    const value = this.store.get(key) ?? null;
    return type === "json" && value !== null ? JSON.parse(value) : value;
  }
  async put(key, value) {
    this.store.set(key, value);
  }
  async delete(key) {
    this.store.delete(key);
  }
}

let env;
let pushCalls;
let pushStatus;
const realFetch = globalThis.fetch;

beforeEach(async () => {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  env = {
    STATE: new MemoryKV(),
    ALLOWED_ORIGINS: `${ORIGIN},http://127.0.0.1:8000`,
    VAPID_PUBLIC_KEY: base64UrlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))),
    VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey("jwk", pair.privateKey)).d,
  };
  pushCalls = [];
  pushStatus = 201;
  globalThis.fetch = async (url, init) => {
    pushCalls.push({ url, init });
    return new Response(null, { status: pushStatus });
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function post(path, body, key = KEY) {
  const headers = { "Content-Type": "application/json", Origin: ORIGIN };
  if (key) headers["X-Haushalt-Key"] = key;
  return handleRequest(
    new Request(`https://push.example.workers.dev${path}`, { method: "POST", headers, body: JSON.stringify(body) }),
    env,
  );
}

test("first subscribe stores the key; another key is rejected afterwards", async () => {
  assert.equal((await post("/subscribe", { subscription: SUBSCRIPTION })).status, 200);
  assert.equal((await post("/subscribe", { subscription: SUBSCRIPTION }, "other-key-0123456789abcdef")).status, 403);
  assert.equal((await post("/status", { date: "2026-10-08", open: 0 }, "other-key-0123456789abcdef")).status, 403);
});

test("status needs a valid date and a whole number", async () => {
  await post("/subscribe", { subscription: SUBSCRIPTION });
  assert.equal((await post("/status", { date: "heute", open: 1 })).status, 400);
  assert.equal((await post("/status", { date: "2026-10-08", open: "1" })).status, 400);
  assert.equal((await post("/status", { date: "2026-10-08", open: 1 })).status, 200);
});

test("CORS answers the app's origin", async () => {
  const response = await post("/subscribe", { subscription: SUBSCRIPTION });
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
});

test("reminder at 20:30 is sent when tasks are open", async () => {
  await post("/subscribe", { subscription: SUBSCRIPTION });
  await post("/status", { date: "2026-10-08", open: 2 });
  assert.equal(await remind(env, AT_2030), 201);
  assert.equal(pushCalls.length, 1);
  assert.equal(pushCalls[0].url, SUBSCRIPTION.endpoint);
  assert.match(pushCalls[0].init.headers.Authorization, /^vapid t=.+, k=.+$/);
});

test("reminder is sent when the app did not report today", async () => {
  await post("/subscribe", { subscription: SUBSCRIPTION });
  await post("/status", { date: "2026-10-07", open: 0 });
  assert.equal(await remind(env, AT_2030), 201);
});

test("no reminder when everything is done today", async () => {
  await post("/subscribe", { subscription: SUBSCRIPTION });
  await post("/status", { date: "2026-10-08", open: 0 });
  assert.equal(await remind(env, AT_2030), "all-done");
  assert.equal(pushCalls.length, 0);
});

test("no reminder at the extra cron hours", async () => {
  await post("/subscribe", { subscription: SUBSCRIPTION });
  assert.equal(await remind(env, AT_2130), "not-reminder-time");
  assert.equal(pushCalls.length, 0);
});

test("an expired subscription (410) is removed", async () => {
  await post("/subscribe", { subscription: SUBSCRIPTION });
  pushStatus = 410;
  assert.equal(await remind(env, AT_2030), 410);
  assert.equal(await env.STATE.get("subscription"), null);
});

test("/test sends a push right away", async () => {
  await post("/subscribe", { subscription: SUBSCRIPTION });
  const response = await post("/test", {});
  assert.equal(response.status, 200);
  assert.equal(pushCalls.length, 1);
});
