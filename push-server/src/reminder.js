// When to remind. Pure functions, tested with Node.

const REMINDER_TIMES = ["20:30", "22:30"];

const berlinFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Berlin date ("YYYY-MM-DD") and time ("HH:MM") for a UTC timestamp in ms.
export function berlinTime(ms) {
  const parts = Object.fromEntries(berlinFormat.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function isReminderTime(time) {
  return REMINDER_TIMES.includes(time);
}

// status: what the app reported last ({ date, open }), or null.
// Silent only if the app said "0 open" for this very day.
export function shouldRemind(status, date) {
  return !(status && status.date === date && status.open === 0);
}
