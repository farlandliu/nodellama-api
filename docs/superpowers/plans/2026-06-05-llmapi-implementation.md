# llmapi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Express-based embedding API server using `node-llama-cpp`.

**Architecture:** Simplified service layer — a `LlamaService` wraps `getLlama()` + `LlamaModel` + `createEmbeddingContext()`, Express routes serve OpenAI-compatible `/v1/embeddings` and model management endpoints, and a JSON file (`models.json`) tracks installed models.

**Tech Stack:** Express 5, node-llama-cpp ^3.18.1, Commander, TypeScript (NodeNext ESM)

**Base path:** `/data/code/nodellama-api/llmapi/`

---

### Task 1: Project scaffolding (tsconfig, package scripts)

**Files:**
- Modify: `llmapi/package.json` (add scripts)
- Create: `llmapi/tsconfig.json`

- [ ] **Step 1: Add TypeScript scripts and dev dependency to package.json**

Read the current package.json, then update it:

```json
{
  "name": "llmapi",
  "version": "1.0.0",
  "description": "Standalone embedding API using node-llama-cpp",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc --watch",
    "cli": "node dist/cli.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "devEngines": {
    "packageManager": {
      "name": "pnpm",
      "version": "^11.1.3",
      "onFail": "download"
    }
  },
  "type": "module",
  "dependencies": {
    "chalk": "^5.6.2",
    "commander": "^15.0.0",
    "express": "^5.2.1",
    "node-llama-cpp": "^3.18.1",
    "prompts": "^2.4.2",
    "uuid": "^14.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

Run: `pnpm add -D typescript` (from `llmapi/`)

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "lib": ["es2023"],
    "module": "NodeNext",
    "target": "es2023",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Verify compilation works (will compile an empty src dir)**

Run: `mkdir -p src && npx tsc --noEmit` (should succeed with no files yet)

- [ ] **Step 4: Commit**

```bash
git add llmapi/package.json llmapi/pnpm-lock.yaml llmapi/tsconfig.json
git commit -m "chore: scaffold llmapi project with TypeScript"
```

---

### Task 2: Config module

**Files:**
- Create: `llmapi/src/config.ts`

- [ ] **Step 1: Create src/config.ts**

```ts
import path from 'node:path';
import os from 'node:os';

export const config = {
  port: Number(process.env.LLMAPI_PORT) || 3000,
  dir: process.env.LLMAPI_DIR || path.join(os.homedir(), '.llmapi'),
  modelIndex: process.env.LLMAPI_MODEL_INDEX ?? '',
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit` (from `llmapi/`)

- [ ] **Step 3: Commit**

```bash
git add llmapi/src/config.ts
git commit -m "feat: add config module with env-based settings"
```

---

### Task 3: Storage module (models.json)

**Files:**
- Create: `llmapi/src/storage.ts`

- [ ] **Step 1: Create src/storage.ts**

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add llmapi/src/storage.ts
git commit -m "feat: add JSON file storage for model registry"
```

---

### Task 4: Llama service

**Files:**
- Create: `llmapi/src/llama-service.ts`

- [ ] **Step 1: Create src/llama-service.ts**

```ts
import {
  getLlama,
  Llama,
  LlamaModel,
  type LlamaEmbeddingContextOptions,
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add llmapi/src/llama-service.ts
git commit -m "feat: add llama service with embedding support"
```

---

### Task 5: Embeddings route

**Files:**
- Create: `llmapi/src/routes/embeddings.ts`

- [ ] **Step 1: Create src/routes/embeddings.ts**

```ts
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

export const embeddingRouter = Router();

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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add llmapi/src/routes/embeddings.ts
git commit -m "feat: add POST /v1/embeddings endpoint"
```

---

### Task 6: Models route

**Files:**
- Create: `llmapi/src/routes/models.ts`

- [ ] **Step 1: Create src/routes/models.ts**

```ts
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

export const modelRouter = Router();

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
  const {name} = req.params;
  const removed = await removeModel(name);

  if (!removed) {
    res.status(404).json({
      error: { message: `Model '${name}' not found`, type: 'not_found', code: null, param: 'name' },
    });
    return;
  }

  res.json({ object: 'model', id: name, status: 'removed' });
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add llmapi/src/routes/models.ts
git commit -m "feat: add model management endpoints (list, install, delete)"
```

---

### Task 7: Express server entry point

**Files:**
- Create: `llmapi/src/index.ts`

- [ ] **Step 1: Create src/index.ts**

```ts
import express from 'express';
import {config} from './config.js';
import {load} from './storage.js';
import {embeddingRouter} from './routes/embeddings.js';
import {modelRouter} from './routes/models.js';
import {getOrInitLlama} from './llama-service.js';

const app = express();

app.use(express.json());

app.use('/v1', embeddingRouter);
app.use('/v1', modelRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function main() {
  await load();
  await getOrInitLlama();
  app.listen(config.port, () => {
    console.log(`llmapi listening on http://localhost:${config.port}`);
  });
}

main().catch(console.error);
```

- [ ] **Step 2: Build and verify**

Run: `npx tsc` (from `llmapi/`)

Expected: compiles without errors, creates `dist/index.js`, `dist/config.js`, etc.

- [ ] **Step 3: Commit**

```bash
git add llmapi/src/index.ts
git commit -m "feat: add Express server entry point"
```

---

### Task 8: CLI

**Files:**
- Create: `llmapi/src/cli.ts`

- [ ] **Step 1: Create src/cli.ts**

```ts
import {Command} from 'commander';
import {load, registerModel} from './storage.js';
import {config} from './config.js';
import {getOrInitLlama, createEmbedding} from './llama-service.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';

const program = new Command();

program
  .name('llmapi')
  .description('Standalone embedding API using node-llama-cpp')
  .version('1.0.0');

program
  .command('install')
  .description('Download and register a GGUF model')
  .argument('<url>', 'URL or path to GGUF model file')
  .option('-n, --name <name>', 'Name for the model')
  .action(async (url: string, options: { name?: string }) => {
    const name = options.name ?? url.split('/').pop()?.split(/[?#]/).shift() ?? 'model';
    const modelsDir = path.join(config.dir, 'models');

    await fs.mkdir(modelsDir, { recursive: true });

    const savePath = path.join(modelsDir, name);
    console.log(`Downloading ${url}...`);

    const response = await fetch(url);
    if (!response.ok || !response.body) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      process.exit(1);
    }

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

    await load();
    await registerModel(name, savePath);
    console.log(`Model '${name}' installed at ${savePath}`);
  });

program
  .command('list')
  .description('List installed models')
  .action(async () => {
    const db = await load();
    const entries = Object.entries(db.models);
    if (entries.length === 0) {
      console.log('No models installed.');
      return;
    }
    for (const [name, entry] of entries) {
      const active = name === db.activeModel ? ' (active)' : '';
      console.log(`  ${name}${active} -> ${entry.downloadedFiles.model}`);
    }
  });

program
  .command('serve')
  .description('Start the embedding API server')
  .option('-p, --port <port>', 'Port to listen on')
  .action(async (options: { port?: string }) => {
    if (options.port) {
      process.env.LLMAPI_PORT = options.port;
    }
    const {config: cfg} = await import('./config.js');
    const {default: express} = await import('express');
    const {embeddingRouter} = await import('./routes/embeddings.js');
    const {modelRouter} = await import('./routes/models.js');

    await load();
    await getOrInitLlama();

    const app = express();
    app.use(express.json());
    app.use('/v1', embeddingRouter);
    app.use('/v1', modelRouter);

    app.listen(cfg.port, () => {
      console.log(`llmapi listening on http://localhost:${cfg.port}`);
    });
  });

program.parse(process.argv);
```

- [ ] **Step 2: Build and verify**

Run: `npx tsc` (from `llmapi/`)

Expected: compiles without errors, `dist/cli.js` created.

- [ ] **Step 3: Commit**

```bash
git add llmapi/src/cli.ts
git commit -m "feat: add CLI with install, list, serve commands"
```

---

### Task 9: Full build verification

**Files:**
- Verify: all src files compile together

- [ ] **Step 1: Clean build**

Run: `rm -rf dist && npx tsc` (from `llmapi/`)

Expected: compiles without errors.

- [ ] **Step 2: Verify output structure**

Run: `ls -la dist/`

Expected: `index.js`, `config.js`, `storage.js`, `llama-service.js`, `routes/embeddings.js`, `routes/models.js`, `cli.js` (plus `.d.ts` and `.js.map` files).

```bash
git add -A llmapi/
git commit -m "chore: finalize llmapi build setup"
```
