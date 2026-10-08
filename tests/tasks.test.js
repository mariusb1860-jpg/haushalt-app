import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  daysBetween,
  isDue,
  nextDueDate,
  markDone,
  undoDone,
  splitForToday,
  allDoneToday,
} from "../tasks.js";

const task = (overrides = {}) => ({
  id: "t1",
  name: "Bad putzen",
  everyDays: 7,
  lastDone: null,
  previousDone: null,
  ...overrides,
});

test("addDays and daysBetween work across month ends", () => {
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
  assert.equal(daysBetween("2026-10-30", "2026-11-02"), 3);
});

test("daysBetween ignores the daylight saving switch on 25.10.", () => {
  assert.equal(daysBetween("2026-10-24", "2026-10-26"), 2);
});

test("a task that was never done is due", () => {
  assert.equal(isDue(task(), "2026-10-08"), true);
});

test("a weekly task is due again after 7 days, not before", () => {
  const t = task({ lastDone: "2026-10-01" });
  assert.equal(isDue(t, "2026-10-07"), false);
  assert.equal(isDue(t, "2026-10-08"), true);
});

test("a missed task stays due", () => {
  const t = task({ lastDone: "2026-09-01" });
  assert.equal(isDue(t, "2026-10-08"), true);
});

test("nextDueDate is lastDone plus the interval, or today if never done", () => {
  assert.equal(nextDueDate(task({ lastDone: "2026-10-01" }), "2026-10-03"), "2026-10-08");
  assert.equal(nextDueDate(task(), "2026-10-03"), "2026-10-03");
});

test("markDone and undoDone restore the previous date", () => {
  const before = task({ lastDone: "2026-10-01" });
  const done = markDone(before, "2026-10-08");
  assert.equal(done.lastDone, "2026-10-08");
  assert.equal(isDue(done, "2026-10-08"), false);
  const undone = undoDone(done);
  assert.equal(undone.lastDone, "2026-10-01");
  assert.equal(isDue(undone, "2026-10-08"), true);
});

test("splitForToday lists due and done-today tasks, the rest as upcoming", () => {
  const tasks = [
    task({ id: "a", everyDays: 1, lastDone: "2026-10-07" }), // due
    task({ id: "b", everyDays: 1, lastDone: "2026-10-08" }), // done today
    task({ id: "c", everyDays: 7, lastDone: "2026-10-06" }), // in 5 days
    task({ id: "d", everyDays: 30, lastDone: "2026-10-01" }), // in 23 days
  ];
  const { today, upcoming } = splitForToday(tasks, "2026-10-08");
  assert.deepEqual(today.map((t) => t.id), ["a", "b"]);
  assert.deepEqual(upcoming.map((t) => t.id), ["c", "d"]);
});

test("allDoneToday is true only when every task of today is ticked", () => {
  const due = task({ id: "a", everyDays: 1, lastDone: "2026-10-07" });
  const done = task({ id: "b", everyDays: 1, lastDone: "2026-10-08" });
  assert.equal(allDoneToday([due, done], "2026-10-08"), false);
  assert.equal(allDoneToday([done], "2026-10-08"), true);
});

test("allDoneToday is false when nothing is due today", () => {
  assert.equal(allDoneToday([], "2026-10-08"), false);
});
