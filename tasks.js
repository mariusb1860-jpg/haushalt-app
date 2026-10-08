// Pure task logic. No browser APIs here, so it can be tested with Node.
// Dates are plain "YYYY-MM-DD" strings in local time.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Parse as UTC noon so daylight saving switches never shift the day.
function toUtcNoon(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

export function todayString(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateString, days) {
  return new Date(toUtcNoon(dateString) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((toUtcNoon(to) - toUtcNoon(from)) / MS_PER_DAY);
}

// 0 = Sunday ... 6 = Saturday
export function weekday(dateString) {
  return new Date(toUtcNoon(dateString)).getUTCDay();
}

function firstWeekdayOfMonth(year, month, wd) {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  return addDays(first, (wd - weekday(first) + 7) % 7);
}

function shiftMonth(dateString, months) {
  const [y, m] = dateString.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  return [Math.floor(index / 12), (index % 12) + 1];
}

// Schedules: { every: "day" }, { every: "week", weekday }, { every: "month", weekday }.
// "month" means the first such weekday of each month.

// Last scheduled day on or before the given date.
export function latestOccurrence(schedule, date) {
  if (schedule.every === "week") {
    return addDays(date, -((weekday(date) - schedule.weekday + 7) % 7));
  }
  if (schedule.every === "month") {
    const thisMonth = firstWeekdayOfMonth(...shiftMonth(date, 0), schedule.weekday);
    return thisMonth <= date ? thisMonth : firstWeekdayOfMonth(...shiftMonth(date, -1), schedule.weekday);
  }
  return date;
}

// First scheduled day after the given date.
export function nextOccurrence(schedule, date) {
  if (schedule.every === "week") {
    return addDays(date, (schedule.weekday - weekday(date) + 7) % 7 || 7);
  }
  if (schedule.every === "month") {
    const thisMonth = firstWeekdayOfMonth(...shiftMonth(date, 0), schedule.weekday);
    return thisMonth > date ? thisMonth : firstWeekdayOfMonth(...shiftMonth(date, 1), schedule.weekday);
  }
  return addDays(date, 1);
}

// Due when the last scheduled day is reached and the task was not done since then.
export function isDue(task, today) {
  const occurrence = latestOccurrence(task.schedule, today);
  return occurrence >= task.startDate && (!task.lastDone || task.lastDone < occurrence);
}

export function nextDueDate(task, today) {
  return isDue(task, today) ? today : nextOccurrence(task.schedule, today);
}

export function markDone(task, today) {
  return { ...task, previousDone: task.lastDone, lastDone: today };
}

export function undoDone(task) {
  return { ...task, lastDone: task.previousDone ?? null, previousDone: null };
}

// Names and schedules come from the code; only progress is stored on the device.
// So code changes (new or renamed tasks) reach the phone without losing ticks.
export function mergeProgress(definitions, savedProgress, today) {
  return definitions.map((definition) => ({
    ...definition,
    lastDone: null,
    previousDone: null,
    startDate: today,
    ...savedProgress[definition.id],
  }));
}

export function extractProgress(tasks) {
  return Object.fromEntries(
    tasks.map(({ id, lastDone, previousDone, startDate }) => [id, { lastDone, previousDone, startDate }]),
  );
}

// Expects the "today" list from splitForToday.
export function allDoneToday(todayTasks, today) {
  return todayTasks.length > 0 && todayTasks.every((task) => task.lastDone === today);
}

// "today": due now or already done today. "upcoming": the rest, soonest first.
export function splitForToday(tasks, today) {
  const todayList = [];
  const upcoming = [];
  for (const task of tasks) {
    if (task.lastDone === today || isDue(task, today)) {
      todayList.push(task);
    } else {
      upcoming.push(task);
    }
  }
  upcoming.sort((a, b) => nextDueDate(a, today).localeCompare(nextDueDate(b, today)));
  return { today: todayList, upcoming };
}
