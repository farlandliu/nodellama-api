import fs from 'node:fs/promises';
import path from 'node:path';

export type ModelEntry = {
  downloadedFiles: { model: string };
  settings: Record<string, unknown>;
  createDate: number;
};

export type Storage = {
  activeModel: string;
  models: Record<string, ModelEntry>;
};

const DB_PATH = path.join(process.cwd(), 'models.json');

let cache: Storage | null = null;

export async function load(): Promise<Storage> {
  if (cache) return cache;
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    cache = JSON.parse(data) as Storage;
  } catch {
    cache = { activeModel: '', models: {} };
  }
  return cache;
}

export async function save(): Promise<void> {
  if (!cache) return;
  await fs.writeFile(DB_PATH, JSON.stringify(cache, null, 2));
}

export function getActiveModelPath(): string | null {
  if (!cache || !cache.activeModel) return null;
  return cache.models[cache.activeModel]?.downloadedFiles?.model ?? null;
}

export async function registerModel(name: string, modelPath: string): Promise<void> {
  const db = cache ?? (await load());
  db.models[name] = {
    downloadedFiles: { model: modelPath },
    settings: {},
    createDate: Date.now(),
  };
  if (!db.activeModel) db.activeModel = name;
  await save();
}

export async function removeModel(name: string): Promise<boolean> {
  const db = cache ?? (await load());
  if (!db.models[name]) return false;
  delete db.models[name];
  if (db.activeModel === name) db.activeModel = Object.keys(db.models)[0] ?? '';
  await save();
  return true;
}
