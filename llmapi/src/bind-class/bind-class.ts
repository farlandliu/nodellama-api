import {load, type ModelEntry} from '../storage.js';
import BaseBindClass, {type RerankResult} from './base-bind-class.js';
import NodeLlamaCppV2 from './node-llama-cpp-v2.js';
import {ModelNotInstalledError, NoActiveModelError, NoModelBindError, BindNotFoundError} from './errors.js';
import type {LlamaEmbeddingContextOptions, LlamaRankingContextOptions} from 'node-llama-cpp';

const ALL_BINDS = [NodeLlamaCppV2];
const cachedBinds = new Map<string, BaseBindClass>();

function bindCacheKey(modelEntry: ModelEntry): string {
  const bind = (modelEntry.settings?.bind as string) ?? NodeLlamaCppV2.shortName!;
  return `${bind}:${modelEntry.downloadedFiles.model}`;
}

function findLocalModel(modelName?: string): ModelEntry {
  if (!cache) throw new Error('Storage not loaded. Call load() first.');

  const entry = modelName
    ? cache.models[modelName]
    : cache.activeModel
      ? cache.models[cache.activeModel]
      : undefined;

  if (!entry) {
    if (modelName) throw new ModelNotInstalledError(`Model "${modelName}" not installed`);
    throw new NoActiveModelError('No active model set');
  }
  return entry;
}

function getCachedBind(modelEntry: ModelEntry): BaseBindClass | null {
  return cachedBinds.get(bindCacheKey(modelEntry)) ?? null;
}

let lockPromise: Promise<void> | null = null;

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  while (lockPromise) await lockPromise;
  let resolve!: () => void;
  lockPromise = new Promise((r) => { resolve = r; });
  try {
    return await fn();
  } finally {
    lockPromise = null;
    resolve();
  }
}

let cache: Awaited<ReturnType<typeof load>> | null = null;

export async function getOrCreateBind(options?: {model?: string}): Promise<BaseBindClass> {
  return await withLock(async () => {
    cache = await load();
    const modelEntry = findLocalModel(options?.model);
    const existing = getCachedBind(modelEntry);
    if (existing) return existing;

    const bind = (modelEntry.settings?.bind as string) ?? NodeLlamaCppV2.shortName!;
    const BindClass = ALL_BINDS.find((b) => b.shortName === bind);
    if (!BindClass) throw new BindNotFoundError(`Bind "${bind}" not found`);

    const key = bindCacheKey(modelEntry);
    let instance = cachedBinds.get(key);
    if (!instance) {
      instance = new BindClass(modelEntry);
      cachedBinds.set(key, instance);
    }
    await instance.initialize();
    return instance;
  });
}

export async function createEmbedding(
  input: string[],
  options?: LlamaEmbeddingContextOptions & {model?: string},
): Promise<number[][]> {
  const bind = await getOrCreateBind(options);
  return bind.createEmbedding(input, options);
}

export async function rerankDocuments(
  query: string,
  documents: string[],
  options?: LlamaRankingContextOptions & {model?: string},
): Promise<RerankResult[]> {
  const bind = await getOrCreateBind(options);
  return bind.rerank(query, documents, options);
}

export function getModelPath(name?: string): string | null {
  if (!cache) return null;
  try {
    return findLocalModel(name).downloadedFiles.model;
  } catch {
    return null;
  }
}
