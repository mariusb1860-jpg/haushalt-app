// Request handling and reminder logic. The Worker entry is index.js.
//
// KV keys:
//   keyHash       SHA-256 of the app's secret key (set on first /subscribe)
//   subscription  the phone's push subscription
//   status        last report from the app: { date, open }

import { berlinTime, isReminderTime, shouldRemind } from "./reminder.js";
import { sendPush } from "./webpush.js";

const SUBJECT = "https://mariusb1860-jpg.github.io/haushalt-app/";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function vapidKeys(env) {
  return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
}

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The first app that subscribes owns the server; later calls need the same key.
async function isAuthorized(env, key, allowFirst) {
  if (!key || key.length < 20) return false;
  const stored = await env.STATE.get("keyHash");
  const hash = await sha256(key);
  if (!stored && allowFirst) {
    await env.STATE.put("keyHash", hash);
    return true;
  }
  return stored === hash;
}

async function pushToPhone(env) {
  const subscription = await env.STATE.get("subscription", "json");
  if (!subscription) return "no-subscription";
  const status = await sendPush(subscription, vapidKeys(env), SUBJECT);
  if (status === 404 || status === 410) {
    await env.STATE.delete("subscription"); // Phone unsubscribed or app removed.
  }
  return status;
}

// Called by the cron triggers. Returns what happened, for logs and tests.
export async function remind(env, scheduledTime) {
  const { date, time } = berlinTime(scheduledTime);
  if (!isReminderTime(time)) return "not-reminder-time";
  const status = await env.STATE.get("status", "json");
  if (!shouldRemind(status, date)) return "all-done";
  return pushToPhone(env);
}

function corsHeaders(env, request) {
  const allowed = env.ALLOWED_ORIGINS.split(",");
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Haushalt-Key",
    Vary: "Origin",
  };
}

async function route(env, path, key, body) {
  if (path === "/subscribe") {
    if (!(await isAuthorized(env, key, true))) return [403, { error: "forbidden" }];
    if (typeof body?.subscription?.endpoint !== "string") return [400, { error: "subscription missing" }];
    await env.STATE.put("subscription", JSON.stringify(body.subscription));
    return [200, { ok: true }];
  }
  if (path === "/status") {
    if (!(await isAuthorized(env, key, false))) return [403, { error: "forbidden" }];
    if (!DATE.test(body?.date ?? "") || !Number.isInteger(body?.open)) return [400, { error: "bad status" }];
    await env.STATE.put("status", JSON.stringify({ date: body.date, open: body.open }));
    return [200, { ok: true }];
  }
  if (path === "/test") {
    if (!(await isAuthorized(env, key, false))) return [403, { error: "forbidden" }];
    const result = await pushToPhone(env);
    return [result === 201 ? 200 : 502, { result }];
  }
  return [404, { error: "not found" }];
}

export async function handleRequest(request, env) {
  const cors = corsHeaders(env, request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response("Haushalt push server", { headers: cors });

  let body = null;
  try {
    body = await request.json();
  } catch {
    // Empty or broken body: routes check what they need.
  }
  const key = request.headers.get("X-Haushalt-Key");
  const [status, json] = await route(env, new URL(request.url).pathname, key, body);
  return Response.json(json, { status, headers: cors });
}
