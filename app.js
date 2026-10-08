import {
  todayString,
  markDone,
  undoDone,
  splitForToday,
  allDoneToday,
  mergeProgress,
  extractProgress,
} from "./tasks.js";
import { saveRewardImage, loadRewardImage, deleteRewardImage } from "./reward.js";
import { pushState, enablePush, sendTestPush, reportStatus, closeReminders } from "./push.js";

const STORAGE_KEY = "haushalt.progress.v1";
const OLD_STORAGE_KEY = "haushalt.tasks.v1";

const DAILY = { every: "day" };
const SATURDAYS = { every: "week", weekday: 6 };
const FIRST_SATURDAY = { every: "month", weekday: 6 };

// The task list lives in the code. Changes here reach the phone automatically.
const TASK_DEFINITIONS = [
  { id: "trash", name: "Müll checken", schedule: DAILY },
  { id: "dishwasher", name: "Spülmaschine checken", schedule: DAILY },
  { id: "dishes", name: "Geschirr weggeräumt checken", schedule: DAILY },
  { id: "deposit-bottles", name: "Pfandflaschen wegbringen", schedule: SATURDAYS },
  { id: "glass", name: "Glasmüll wegbringen", schedule: SATURDAYS },
  { id: "paper-towels", name: "Zewa checken", schedule: SATURDAYS },
  { id: "toilet-paper", name: "Toilettenpapier checken", schedule: SATURDAYS },
  { id: "toothpaste", name: "Zahnpasta checken", schedule: SATURDAYS },
  { id: "gift", name: "Geschenk für Freundin", schedule: SATURDAYS },
  { id: "date", name: "Date planen", schedule: SATURDAYS },
  { id: "bedding", name: "Bettwäsche wechseln", schedule: FIRST_SATURDAY },
];

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

// For testing: "?today=2026-10-15" pretends it is that day.
function getToday() {
  const fake = new URLSearchParams(location.search).get("today");
  return /^\d{4}-\d{2}-\d{2}$/.test(fake ?? "") ? fake : todayString();
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {}; // Broken data: start fresh.
  }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(extractProgress(tasks)));
}

function rhythmLabel(schedule) {
  if (schedule.every === "week") return `${WEEKDAYS[schedule.weekday].toLowerCase()}s`;
  if (schedule.every === "month") return `1. ${WEEKDAYS[schedule.weekday]} im Monat`;
  return "täglich";
}

function formatDate(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const today = getToday();
localStorage.removeItem(OLD_STORAGE_KEY);
let tasks = mergeProgress(TASK_DEFINITIONS, loadProgress(), today);
saveTasks(tasks); // Remembers the start date of new tasks.
let rewardUrl = null; // Local blob: URL of the reward picture, if one is set.

async function refreshRewardImage() {
  if (rewardUrl) URL.revokeObjectURL(rewardUrl);
  const blob = await loadRewardImage();
  rewardUrl = blob ? URL.createObjectURL(blob) : null;
  render();
}

function setupRewardSettings() {
  const input = document.getElementById("reward-input");
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    await saveRewardImage(file);
    input.value = "";
    await refreshRewardImage();
  });
  document.getElementById("reward-delete").addEventListener("click", async () => {
    await deleteRewardImage();
    await refreshRewardImage();
  });
}

const PUSH_TEXTS = {
  unsupported: "Dieser Browser kann keine Erinnerungen. Nimm am Handy die installierte App.",
  blocked: "Benachrichtigungen sind blockiert. Erlaube sie in den Android-Einstellungen für die App „Haushalt“.",
  on: "Erinnerungen sind an.",
  off: "Erinnerungen sind aus.",
};

function renderPushState(message) {
  const state = pushState();
  document.getElementById("push-state").textContent = message ?? PUSH_TEXTS[state];
  document.getElementById("push-enable").hidden = state !== "off";
  document.getElementById("push-test").hidden = state !== "on";
}

function setupPushSettings() {
  const enableButton = document.getElementById("push-enable");
  enableButton.addEventListener("click", async () => {
    enableButton.disabled = true;
    try {
      await enablePush();
      syncReminderStatus();
      renderPushState();
    } catch (error) {
      renderPushState(`Hat nicht geklappt: ${error.message}`);
    }
    enableButton.disabled = false;
  });
  document.getElementById("push-test").addEventListener("click", async () => {
    try {
      await sendTestPush();
      renderPushState("Test-Nachricht ist unterwegs.");
    } catch (error) {
      renderPushState(`Test hat nicht geklappt: ${error.message}`);
    }
  });
  renderPushState();
}

// Tells the push server how many tasks are open, so it stays quiet when all is done.
function syncReminderStatus() {
  const open = splitForToday(tasks, today).today.filter((task) => task.lastDone !== today).length;
  reportStatus(today, open);
  if (open === 0) closeReminders();
}

function toggleTask(id) {
  tasks = tasks.map((task) => {
    if (task.id !== id) return task;
    return task.lastDone === today ? undoDone(task) : markDone(task, today);
  });
  saveTasks(tasks);
  render();
  syncReminderStatus();
}

function render() {
  const todayTasks = splitForToday(tasks, today).today;
  const doneCount = todayTasks.filter((task) => task.lastDone === today).length;
  const allDone = allDoneToday(todayTasks, today);

  document.getElementById("date").textContent = formatDate(today);
  document.getElementById("progress").textContent = `${doneCount} von ${todayTasks.length} erledigt`;
  document.getElementById("all-done").hidden = !allDone;

  const rewardImage = document.getElementById("reward-image");
  const rewardPreview = document.getElementById("reward-preview");
  rewardImage.hidden = !(allDone && rewardUrl);
  rewardPreview.hidden = !rewardUrl;
  document.getElementById("reward-delete").hidden = !rewardUrl;
  if (rewardUrl) {
    rewardImage.src = rewardUrl;
    rewardPreview.src = rewardUrl;
  }

  const todayList = document.getElementById("today-list");
  todayList.replaceChildren(
    ...todayTasks.map((task) => {
      const done = task.lastDone === today;
      const li = document.createElement("li");
      li.className = done ? "done" : "";
      li.innerHTML = `
        <label>
          <input type="checkbox" ${done ? "checked" : ""} />
          <span class="name"></span>
          <span class="rhythm">${rhythmLabel(task.schedule)}</span>
        </label>`;
      li.querySelector(".name").textContent = task.name;
      li.querySelector("input").addEventListener("change", () => toggleTask(task.id));
      return li;
    }),
  );
}

setupRewardSettings();
setupPushSettings();
render();
refreshRewardImage();
syncReminderStatus();

// The app can stay open in the background overnight: start fresh on a new day.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && getToday() !== today) location.reload();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
