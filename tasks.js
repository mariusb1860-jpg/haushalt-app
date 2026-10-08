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

export function nextDueDate(task, today) {
  return task.lastDone ? addDays(task.lastDone, task.everyDays) : today;
}

export function isDue(task, today) {
  return daysBetween(nextDueDate(task, today), today) >= 0;
}

export function markDone(task, today) {
  return { ...task, previousDone: task.lastDone, lastDone: today };
}

export function undoDone(task) {
  return { ...task, lastDone: task.previousDone ?? null, previousDone: null };
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
