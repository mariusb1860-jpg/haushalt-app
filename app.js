import {
  todayString,
  daysBetween,
  nextDueDate,
  markDone,
  undoDone,
  splitForToday,
  allDoneToday,
} from "./tasks.js";
import { saveRewardImage, loadRewardImage, deleteRewardImage } from "./reward.js";

const STORAGE_KEY = "haushalt.tasks.v1";

// Starter list. Changeable later in the app (stage 3).
const DEFAULT_TASKS = [
  { id: "trash", name: "Müll checken", everyDays: 1 },
  { id: "dishwasher", name: "Spülmaschine checken", everyDays: 1 },
  { id: "dishes", name: "Geschirr weggeräumt checken", everyDays: 1 },
  { id: "deposit-bottles", name: "Pfandflaschen wegbringen", everyDays: 7 },
  { id: "glass", name: "Glasmüll wegbringen", everyDays: 7 },
  { id: "bedding", name: "Bettwäsche wechseln", everyDays: 30 },
].map((task) => ({ ...task, lastDone: null, previousDone: null }));

// For testing: "?today=2026-10-15" pretends it is that day.
function getToday() {
  const fake = new URLSearchParams(location.search).get("today");
  return /^\d{4}-\d{2}-\d{2}$/.test(fake ?? "") ? fake : todayString();
}

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {
    // Broken data: fall back to the starter list.
  }
  return DEFAULT_TASKS;
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function rhythmLabel(everyDays) {
  if (everyDays === 1) return "täglich";
  if (everyDays === 7) return "wöchentlich";
  if (everyDays === 14) return "alle 2 Wochen";
  if (everyDays === 30) return "monatlich";
  return `alle ${everyDays} Tage`;
}

function dueLabel(task, today) {
  const days = daysBetween(today, nextDueDate(task, today));
  return days === 1 ? "morgen" : `in ${days} Tagen`;
}

function formatDate(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

let tasks = loadTasks();
const today = getToday();
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

function toggleTask(id) {
  tasks = tasks.map((task) => {
    if (task.id !== id) return task;
    return task.lastDone === today ? undoDone(task) : markDone(task, today);
  });
  saveTasks(tasks);
  render();
}

function render() {
  const { today: todayTasks, upcoming } = splitForToday(tasks, today);
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
          <span class="rhythm">${rhythmLabel(task.everyDays)}</span>
        </label>`;
      li.querySelector(".name").textContent = task.name;
      li.querySelector("input").addEventListener("change", () => toggleTask(task.id));
      return li;
    }),
  );

  document.getElementById("upcoming-section").hidden = upcoming.length === 0;
  const upcomingList = document.getElementById("upcoming-list");
  upcomingList.replaceChildren(
    ...upcoming.map((task) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = task.name;
      const when = document.createElement("span");
      when.textContent = dueLabel(task, today);
      li.append(name, when);
      return li;
    }),
  );
}

setupRewardSettings();
render();
refreshRewardImage();
