import {
  getLlama,
  Llama,
  LlamaModel,
  type LlamaEmbeddingContextOptions,
  type LlamaRankingContextOptions,
} from 'node-llama-cpp';

let cachedLlama: Llama | null = null;
const modelCache = new Map<string, LlamaModel>();

export async function getOrInitLlama(): Promise<Llama> {
  if (!cachedLlama) {
    cachedLlama = await getLlama();
  }
  return cachedLlama;
}

async function loadModel(modelPath: string): Promise<LlamaModel> {
  const cached = modelCache.get(modelPath);
  if (cached) return cached;
  const llama = await getOrInitLlama();
  const model = await llama.loadModel({ modelPath });
  modelCache.set(modelPath, model);
  return model;
}

export async function createEmbedding(
  input: string[],
  modelPath: string,
  options?: LlamaEmbeddingContextOptions,
): Promise<number[][]> {
  const model = await loadModel(modelPath);
  const context = await model.createEmbeddingContext(options ?? {});

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

export type RerankResult = {
  index: number;
  relevance_score: number;
};

export async function rerank(
  query: string,
  documents: string[],
  modelPath: string,
  options?: LlamaRankingContextOptions,
): Promise<RerankResult[]> {
  const model = await loadModel(modelPath);
  const context = await model.createRankingContext(options ?? {});

  try {
    const scores = await context.rankAll(query, documents);
    return scores.map((score, index) => ({ index, relevance_score: score }));
  } finally {
    await context.dispose();
  }
}
