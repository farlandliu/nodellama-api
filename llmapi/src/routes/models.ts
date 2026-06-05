import {Router, type Request, type Response} from 'express';
import {load, registerModel, removeModel} from '../storage.js';
import {config} from '../config.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';

type InstallRequest = {
  url?: string;
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

  if (!body.url) {
    res.status(400).json({
      error: { message: 'url is required', type: 'invalid_request_error', code: null, param: 'url' },
    });
    return;
  }

  const name = body.name ?? body.url.split('/').pop()?.split(/[?#]/).shift() ?? 'model';
  const modelsDir = path.join(config.dir, 'models');

  try {
    await fs.mkdir(modelsDir, { recursive: true });

    const response = await fetch(body.url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to fetch ${body.url}: ${response.status}`);
    }

    const savePath = path.join(modelsDir, name);
    const writer = createWriteStream(savePath);
    const reader = response.body.getReader();

    const pump = async () => {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        writer.write(value);
      }
    };

    await pump();
    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
      writer.end();
    });

    await registerModel(name, savePath);

    res.json({ object: 'model', id: name, status: 'installed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: { message, type: 'server_error', code: null, param: null },
    });
  }
});

modelRouter.delete('/models/:name', async (req: Request, res: Response) => {
  const name = req.params.name as string;
  const removed = await removeModel(name);

  if (!removed) {
    res.status(404).json({
      error: { message: `Model '${name}' not found`, type: 'not_found', code: null, param: 'name' },
    });
    return;
  }

  res.json({ object: 'model', id: name, status: 'removed' });
});
