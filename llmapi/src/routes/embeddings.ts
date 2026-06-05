import {Router, type Request, type Response} from 'express';
import {createEmbedding} from '../llama-service.js';
import {getActiveModelPath} from '../storage.js';

type EmbeddingRequest = {
  model?: string;
  input?: string | string[];
};

function usage(text: string) {
  const tokens = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { promptTokens: tokens, totalTokens: tokens };
}

export const embeddingRouter: Router = Router();

embeddingRouter.post('/embeddings', async (req: Request, res: Response) => {
  const body = req.body as EmbeddingRequest;

  if (body.input == null) {
    res.status(400).json({
      error: { message: 'input is required', type: 'invalid_request_error', code: null, param: 'input' },
    });
    return;
  }

  if (typeof body.input !== 'string' && (!Array.isArray(body.input) || body.input.some((i: unknown) => typeof i !== 'string'))) {
    res.status(400).json({
      error: { message: 'input must be a string or array of strings', type: 'invalid_request_error', code: null, param: 'input' },
    });
    return;
  }

  const inputs: string[] = typeof body.input === 'string' ? [body.input] : body.input;
  const modelPath = getActiveModelPath();

  if (!modelPath) {
    res.status(503).json({
      error: { message: 'No active model. Install a model first.', type: 'server_error', code: null, param: null },
    });
    return;
  }

  try {
    const embeddings = await createEmbedding(inputs, modelPath);
    const modelName = body.model ?? 'default';

    res.json({
      object: 'list',
      model: modelName,
      data: embeddings.map((embedding, index) => ({
        object: 'embedding',
        index,
        embedding,
      })),
      usage: {
        prompt_tokens: inputs.reduce((sum, item) => sum + usage(item).promptTokens, 0),
        total_tokens: inputs.reduce((sum, item) => sum + usage(item).promptTokens, 0),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: { message, type: 'server_error', code: null, param: null },
    });
  }
});
