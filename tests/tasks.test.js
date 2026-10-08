import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  daysBetween,
  weekday,
  latestOccurrence,
  nextOccurrence,
  isDue,
  nextDueDate,
  markDone,
  undoDone,
  splitForToday,
  allDoneToday,
  mergeProgress,
  extractProgress,
} from "../tasks.js";

// Calendar used below: 2026-10-08 is a Thursday.
// Saturdays: 03.10., 10.10., 17.10., ... First Saturdays: 05.09., 03.10., 07.11., 05.12.
const DAILY = { every: "day" };
const SATURDAYS = { every: "week", weekday: 6 };
const FIRST_SATURDAY = { every: "month", weekday: 6 };

const task = (overrides = {}) => ({
  id: "t1",
  name: "Test",
  schedule: SATURDAYS,
  startDate: "2026-10-08",
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

test("weekday: 0 is Sunday, 6 is Saturday", () => {
  assert.equal(weekday("2026-10-08"), 4);
  assert.equal(weekday("2026-10-10"), 6);
  assert.equal(weekday("2026-10-11"), 0);
});

test("latestOccurrence finds the last scheduled day on or before today", () => {
  assert.equal(latestOccurrence(DAILY, "2026-10-08"), "2026-10-08");
  assert.equal(latestOccurrence(SATURDAYS, "2026-10-08"), "2026-10-03");
  assert.equal(latestOccurrence(SATURDAYS, "2026-10-10"), "2026-10-10");
  assert.equal(latestOccurrence(SATURDAYS, "2026-10-11"), "2026-10-10");
  assert.equal(latestOccurrence(FIRST_SATURDAY, "2026-10-08"), "2026-10-03");
  assert.equal(latestOccurrence(FIRST_SATURDAY, "2026-10-02"), "2026-09-05");
  assert.equal(latestOccurrence(FIRST_SATURDAY, "2026-11-07"), "2026-11-07");
});

test("nextOccurrence finds the first scheduled day after a date", () => {
  assert.equal(nextOccurrence(DAILY, "2026-10-08"), "2026-10-09");
  assert.equal(nextOccurrence(SATURDAYS, "2026-10-08"), "2026-10-10");
  assert.equal(nextOccurrence(SATURDAYS, "2026-10-10"), "2026-10-17");
  assert.equal(nextOccurrence(FIRST_SATURDAY, "2026-10-08"), "2026-11-07");
  assert.equal(nextOccurrence(FIRST_SATURDAY, "2026-11-07"), "2026-12-05");
  assert.equal(nextOccurrence(FIRST_SATURDAY, "2026-12-31"), "2027-01-02");
});

test("a daily task is due every day until it is ticked", () => {
  const t = task({ schedule: DAILY });
  assert.equal(isDue(t, "2026-10-08"), true);
  const done = markDone(t, "2026-10-08");
  assert.equal(isDue(done, "2026-10-08"), false);
  assert.equal(isDue(done, "2026-10-09"), true);
});

test("a Saturday task starts on the next Saturday, not before", () => {
  const t = task();
  assert.equal(isDue(t, "2026-10-08"), false);
  assert.equal(isDue(t, "2026-10-09"), false);
  assert.equal(isDue(t, "2026-10-10"), true);
});

test("a missed Saturday task stays due until it is done", () => {
  const t = task();
  assert.equal(isDue(t, "2026-10-12"), true);
  const done = markDone(t, "2026-10-12");
  assert.equal(isDue(done, "2026-10-16"), false);
  assert.equal(isDue(done, "2026-10-17"), true);
});

test("a first-Saturday task waits for the first Saturday of next month", () => {
  const t = task({ schedule: FIRST_SATURDAY });
  assert.equal(isDue(t, "2026-10-10"), false);
  assert.equal(isDue(t, "2026-10-31"), false);
  assert.equal(isDue(t, "2026-11-07"), true);
  assert.equal(isDue(markDone(t, "2026-11-07"), "2026-11-14"), false);
});

test("nextDueDate is today when due, otherwise the next scheduled day", () => {
  assert.equal(nextDueDate(task(), "2026-10-08"), "2026-10-10");
  assert.equal(nextDueDate(task(), "2026-10-11"), "2026-10-11");
  assert.equal(nextDueDate(task({ schedule: FIRST_SATURDAY }), "2026-10-08"), "2026-11-07");
});

test("markDone and undoDone restore the previous date", () => {
  const before = task({ schedule: DAILY, lastDone: "2026-10-07" });
  const done = markDone(before, "2026-10-08");
  assert.equal(done.lastDone, "2026-10-08");
  const undone = undoDone(done);
  assert.equal(undone.lastDone, "2026-10-07");
  assert.equal(isDue(undone, "2026-10-08"), true);
});

test("splitForToday lists due and done-today tasks, the rest as upcoming", () => {
  const tasks = [
    task({ id: "a", schedule: DAILY }), // due
    task({ id: "b", schedule: DAILY, lastDone: "2026-10-08" }), // done today
    task({ id: "c", schedule: FIRST_SATURDAY }), // 07.11.
    task({ id: "d", schedule: SATURDAYS }), // 10.10.
  ];
  const { today, upcoming } = splitForToday(tasks, "2026-10-08");
  assert.deepEqual(today.map((t) => t.id), ["a", "b"]);
  assert.deepEqual(upcoming.map((t) => t.id), ["d", "c"]);
});

test("allDoneToday is true only when every task of today is ticked", () => {
  const due = task({ id: "a", schedule: DAILY });
  const done = task({ id: "b", schedule: DAILY, lastDone: "2026-10-08" });
  assert.equal(allDoneToday([due, done], "2026-10-08"), false);
  assert.equal(allDoneToday([done], "2026-10-08"), true);
});

test("allDoneToday is false when nothing is due today", () => {
  assert.equal(allDoneToday([], "2026-10-08"), false);
});

test("mergeProgress takes names from the code and progress from storage", () => {
  const definitions = [
    { id: "a", name: "Neuer Name", schedule: DAILY },
    { id: "b", name: "Neue Aufgabe", schedule: SATURDAYS },
  ];
  const saved = {
    a: { lastDone: "2026-10-07", previousDone: null, startDate: "2026-10-01" },
    gone: { lastDone: "2026-10-07", previousDone: null, startDate: "2026-10-01" },
  };
  const tasks = mergeProgress(definitions, saved, "2026-10-08");
  assert.deepEqual(tasks, [
    { id: "a", name: "Neuer Name", schedule: DAILY, lastDone: "2026-10-07", previousDone: null, startDate: "2026-10-01" },
    { id: "b", name: "Neue Aufgabe", schedule: SATURDAYS, lastDone: null, previousDone: null, startDate: "2026-10-08" },
  ]);
  assert.deepEqual(Object.keys(extractProgress(tasks)), ["a", "b"]);
  assert.deepEqual(extractProgress(tasks).b, { lastDone: null, previousDone: null, startDate: "2026-10-08" });
});
