import { todayString, daysBetween, nextDueDate, markDone, undoDone, splitForToday } from "./tasks.js";

const STORAGE_KEY = "haushalt.tasks.v1";

// Starter list. Changeable later in the app (stage 3).
const DEFAULT_TASKS = [
  { id: "dishwasher", name: "Spülmaschine", everyDays: 1 },
  { id: "kitchen", name: "Küche wischen", everyDays: 1 },
  { id: "trash", name: "Müll rausbringen", everyDays: 3 },
  { id: "vacuum", name: "Staubsaugen", everyDays: 7 },
  { id: "bathroom", name: "Bad putzen", everyDays: 7 },
  { id: "bedding", name: "Bettwäsche wechseln", everyDays: 14 },
  { id: "fridge", name: "Kühlschrank auswischen", everyDays: 30 },
  { id: "ac-filter", name: "Klimagerät-Filter reinigen", everyDays: 30 },
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

  document.getElementById("date").textContent = formatDate(today);
  document.getElementById("progress").textContent = `${doneCount} von ${todayTasks.length} erledigt`;
  document.getElementById("all-done").hidden = doneCount < todayTasks.length;

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

render();
