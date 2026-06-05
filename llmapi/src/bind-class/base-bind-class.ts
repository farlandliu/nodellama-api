import type { LlamaEmbeddingContextOptions, LlamaRankingContextOptions } from 'node-llama-cpp';
import type { ModelEntry } from '../storage.js';

export type RerankResult = {
  index: number;
  relevance_score: number;
};

export default abstract class BaseBindClass {
  static shortName?: string;

  constructor(public modelEntry: ModelEntry) {}

  abstract initialize(): Promise<void>;

  abstract createEmbedding(
    input: string[],
    options?: LlamaEmbeddingContextOptions,
  ): Promise<number[][]>;

  abstract rerank(
    query: string,
    documents: string[],
    options?: LlamaRankingContextOptions,
  ): Promise<RerankResult[]>;
}
