// Reward picture: stored only in this browser (IndexedDB), never uploaded.

const DB_NAME = "haushalt";
const STORE = "images";
const KEY = "reward";
const MAX_SIDE = 1600;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}

// Phone photos are often 5+ MB. Shrink them so storage stays small.
async function shrink(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.85));
  } catch {
    return file; // Unknown format: keep the original.
  }
}

export async function saveRewardImage(file) {
  const blob = await shrink(file);
  await withStore("readwrite", (store) => store.put(blob, KEY));
  // Ask the browser not to clear our data when the phone runs low on space.
  await navigator.storage?.persist?.();
}

export function loadRewardImage() {
  return withStore("readonly", (store) => store.get(KEY));
}

export function deleteRewardImage() {
  return withStore("readwrite", (store) => store.delete(KEY));
}
