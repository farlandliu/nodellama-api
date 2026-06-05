import {Router, type Request, type Response} from 'express';
import {load, registerModel} from '../storage.js';
import {config} from '../config.js';
import {createModelDownloader} from 'node-llama-cpp';
import path from 'node:path';
import fs from 'node:fs/promises';

type InstallRequest = {
  uri?: string;
  name?: string;
};

export const modelRouter: Router = Router();

modelRouter.get('/models', async (_req: Request, res: Response) => {
  const db = await load();
  const created = Math.floor(Date.now() / 1000);

  res.json({
    object: 'list',
    data: Object.keys(db.models).map((id) => ({
      id,
      object: 'model',
      created,
      owned_by: 'llmapi',
    })),
  });
});

modelRouter.post('/models/install', async (req: Request, res: Response) => {
  const body = req.body as InstallRequest;

  if (!body.uri) {
    res.status(400).json({
      error: { message: 'uri is required', type: 'invalid_request_error', code: null, param: 'uri' },
    });
    return;
  }

  const modelsDir = path.join(config.dir, 'models');

  try {
    await fs.mkdir(modelsDir, { recursive: true });

    const downloader = await createModelDownloader({ modelUri: body.uri, dirPath: modelsDir });
    const modelPath = await downloader.download();

    const name = body.name ?? path.basename(modelPath).replace(/[^a-zA-Z0-9._-]/g, '');
    await registerModel(name, modelPath);

    res.json({ object: 'model', id: name, status: 'installed', path: modelPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: { message, type: 'server_error', code: null, param: null },
    });
  }
});

