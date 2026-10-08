import { test } from "node:test";
import assert from "node:assert/strict";
import { berlinTime, isReminderTime, shouldRemind } from "../src/reminder.js";

test("berlinTime converts UTC to Berlin summer time (UTC+2)", () => {
  assert.deepEqual(berlinTime(Date.UTC(2026, 9, 8, 18, 30)), { date: "2026-10-08", time: "20:30" });
});

test("berlinTime converts UTC to Berlin winter time (UTC+1) after 25.10.", () => {
  assert.deepEqual(berlinTime(Date.UTC(2026, 9, 26, 19, 30)), { date: "2026-10-26", time: "20:30" });
  assert.deepEqual(berlinTime(Date.UTC(2026, 9, 26, 21, 30)), { date: "2026-10-26", time: "22:30" });
});

test("only 20:30 and 22:30 Berlin time are reminder times", () => {
  assert.equal(isReminderTime("20:30"), true);
  assert.equal(isReminderTime("22:30"), true);
  assert.equal(isReminderTime("21:30"), false);
  assert.equal(isReminderTime("23:30"), false);
});

test("no reminder when the app reported 0 open tasks today", () => {
  assert.equal(shouldRemind({ date: "2026-10-08", open: 0 }, "2026-10-08"), false);
});

test("reminder when tasks are open today", () => {
  assert.equal(shouldRemind({ date: "2026-10-08", open: 2 }, "2026-10-08"), true);
});

test("reminder when the app did not report anything today", () => {
  assert.equal(shouldRemind({ date: "2026-10-07", open: 0 }, "2026-10-08"), true);
  assert.equal(shouldRemind(null, "2026-10-08"), true);
});
