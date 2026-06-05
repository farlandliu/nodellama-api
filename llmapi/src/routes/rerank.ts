import {Router, type Request, type Response} from 'express';
import {load} from '../storage.js';
import {rerankDocuments} from '../bind-class/bind-class.js';

type RerankRequest = {
  model?: string;
  query?: string;
  documents?: string[];
  top_n?: number;
};

function usage(text: string) {
  const tokens = text.trim() ? text.trim().split(/\s+/).length : 0;
  return {promptTokens: tokens, totalTokens: tokens};
}

async function findRerankerModel(): Promise<string | null> {
  const db = await load();
  // for (const name of Object.keys(db.models)) {
  //   if (name.toLowerCase().includes('reranker')) return name;
  // }
  return 'hf_gpustack_bge-reranker-v2-m3-Q8_0.gguf';
}

export const rerankRouter: Router = Router();

rerankRouter.post('/rerank', async (req: Request, res: Response) => {
  const body = req.body as RerankRequest;

  if (!body.query || typeof body.query !== 'string') {
    res.status(400).json({
      error: {message: 'query is required and must be a string', type: 'invalid_request_error', code: null, param: 'query'},
    });
    return;
  }

  if (!Array.isArray(body.documents) || body.documents.length === 0 || body.documents.some((d: unknown) => typeof d !== 'string')) {
    res.status(400).json({
      error: {message: 'documents must be a non-empty array of strings', type: 'invalid_request_error', code: null, param: 'documents'},
    });
    return;
  }

  const modelName = body.model ?? await findRerankerModel();
  if (!modelName) {
    res.status(503).json({
      error: {message: 'No reranker model available. Install a reranker model or specify one.', type: 'server_error', code: null, param: null},
    });
    return;
  }

  try {
    const results = await rerankDocuments(body.query, body.documents, {model: modelName});

    const topN = body.top_n ?? results.length;
    const topResults = results
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, topN);

    const totalTokens = body.query.split(/\s+/).length +
      body.documents.reduce((sum, d) => sum + d.split(/\s+/).length, 0);

    res.json({
      id: `rerank-${Date.now()}`,
      object: 'rerank',
      model: modelName,
      results: topResults.map((r) => ({
        index: r.index,
        relevance_score: r.relevance_score,
      })),
      usage: {
        total_tokens: totalTokens,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: {message, type: 'server_error', code: null, param: null},
    });
  }
});
