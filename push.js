// Reminders: connects the phone to the push server (Cloudflare Worker).
// Only the number of open tasks per day is sent there. No task names, no picture.

const VAPID_PUBLIC_KEY = "BLqEx41iv2hg1I2GxLLZQLYuEf1n1tM8HRJJfUtSgaSO0YS4ysGSh0U-S3ZuDwl-w_u84A-vI8a8iHFH1jjlL1Q";
const PUSH_SERVER =
  location.hostname === "127.0.0.1" ? "http://127.0.0.1:8787" : "https://haushalt-push.haushalt-push.workers.dev";

const KEY_STORAGE = "haushalt.pushKey";
const ON_STORAGE = "haushalt.pushOn";
const REMINDER_TAG = "haushalt-reminder";

function base64UrlToBytes(text) {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

// Secret that proves to the server that requests come from this phone.
function deviceKey() {
  let key = localStorage.getItem(KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(KEY_STORAGE, key);
  }
  return key;
}

async function post(path, body) {
  const response = await fetch(PUSH_SERVER + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Haushalt-Key": deviceKey() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Server antwortet ${response.status}`);
}

export function pushState() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  return localStorage.getItem(ON_STORAGE) === "1" && Notification.permission === "granted" ? "on" : "off";
}

export async function enablePush() {
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Keine Erlaubnis");
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
    }));
  await post("/subscribe", { subscription: subscription.toJSON() });
  localStorage.setItem(ON_STORAGE, "1");
}

export async function sendTestPush() {
  await post("/test", {});
}

// Tells the server how many tasks are still open today. Failures are ignored:
// without a report the server simply reminds, which is the safe side.
export async function reportStatus(date, open) {
  if (localStorage.getItem(ON_STORAGE) !== "1") return;
  try {
    await post("/status", { date, open });
  } catch {
    // Offline: the next tick or app start reports again.
  }
}

// Removes a reminder that is still shown once everything is ticked.
export async function closeReminders() {
  const registration = await navigator.serviceWorker?.getRegistration();
  const shown = (await registration?.getNotifications({ tag: REMINDER_TAG })) ?? [];
  shown.forEach((notification) => notification.close());
}
