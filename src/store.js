import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const DATA_FILE = join(DATA_DIR, "giveaways.json");

let cache = [];
let writeChain = Promise.resolve();

export async function load() {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    cache = JSON.parse(raw);
  } catch (err) {
    if (err.code !== "ENOENT") console.error("Failed to read giveaways:", err);
    cache = [];
  }
  return cache;
}

export function all() {
  return cache;
}

export function get(messageId) {
  return cache.find((g) => g.messageId === messageId) || null;
}

export function upsert(giveaway) {
  const idx = cache.findIndex((g) => g.messageId === giveaway.messageId);
  if (idx === -1) cache.push(giveaway);
  else cache[idx] = giveaway;
  return persist();
}

export function remove(messageId) {
  cache = cache.filter((g) => g.messageId !== messageId);
  return persist();
}

function persist() {
  writeChain = writeChain.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(cache, null, 2), "utf8");
  });
  return writeChain;
}
