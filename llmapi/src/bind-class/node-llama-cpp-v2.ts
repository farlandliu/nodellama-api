import {
  getLlama,
  type Llama,
  type LlamaEmbeddingContextOptions,
  type LlamaRankingContextOptions,
  type LlamaModel,
} from 'node-llama-cpp';
import BaseBindClass, {type RerankResult} from './base-bind-class.js';
import {ModelNotInstalledError} from './errors.js';
import {existsSync} from 'node:fs';

let cachedLlama: Llama | null = null;

export async function getCachedLlama(): Promise<Llama> {
  return cachedLlama ??= await getLlama();
}

export default class NodeLlamaCppV2 extends BaseBindClass {
  static override shortName = 'node-llama-cpp-v2';
  private _model?: LlamaModel;

  async initialize(): Promise<void> {
    const modelPath = this.modelEntry.downloadedFiles.model;
    if (!existsSync(modelPath)) {
      throw new ModelNotInstalledError(
        `Model file not found: ${modelPath}`,
      );
    }
    const llama = await getCachedLlama();
    this._model = await llama.loadModel({modelPath});
  }

  async createEmbedding(
    input: string[],
    options?: LlamaEmbeddingContextOptions,
  ): Promise<number[][]> {
    if (!this._model) throw new Error('Model not initialized');
    const context = await this._model.createEmbeddingContext(options ?? {});

    try {
      return await Promise.all(
        input.map(async (item) => {
          const embedding = await context.getEmbeddingFor(item);
          return [...embedding.vector];
        }),
      );
    } finally {
      await context.dispose();
    }
  }

  async rerank(
    query: string,
    documents: string[],
    options?: LlamaRankingContextOptions,
  ): Promise<RerankResult[]> {
    if (!this._model) throw new Error('Model not initialized');
    const context = await this._model.createRankingContext(options ?? {});

    try {
      const scores = await context.rankAll(query, documents);
      return scores.map((score, index) => ({index, relevance_score: score}));
    } finally {
      await context.dispose();
    }
  }
}
