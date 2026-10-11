import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const FILE = join(DATA_DIR, "settings.json");

let data = { templates: {}, config: {} };
let writeChain = Promise.resolve();

export async function load() {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    data = { templates: parsed.templates || {}, config: parsed.config || {} };
  } catch (err) {
    if (err.code !== "ENOENT") console.error("Failed to read settings:", err);
    data = { templates: {}, config: {} };
  }
  return data;
}

function persist() {
  writeChain = writeChain.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
  });
  return writeChain;
}

export function getTemplates(guildId) {
  return data.templates[guildId] || {};
}

export function getTemplate(guildId, name) {
  return (data.templates[guildId] || {})[name.toLowerCase()] || null;
}

export function saveTemplate(guildId, name, template) {
  if (!data.templates[guildId]) data.templates[guildId] = {};
  data.templates[guildId][name.toLowerCase()] = { name, ...template };
  return persist();
}

export function deleteTemplate(guildId, name) {
  const bag = data.templates[guildId];
  if (!bag) return false;
  const key = name.toLowerCase();
  if (!bag[key]) return false;
  delete bag[key];
  persist();
  return true;
}

export function getConfig(guildId) {
  return data.config[guildId] || {};
}

export function setConfig(guildId, patch) {
  data.config[guildId] = { ...(data.config[guildId] || {}), ...patch };
  return persist();
}
