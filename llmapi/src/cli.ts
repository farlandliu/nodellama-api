import {Command} from 'commander';
import {load, registerModel} from './storage.js';
import {getOrInitLlama} from './llama-service.js';
import {config} from './config.js';
import {createModelDownloader} from 'node-llama-cpp';
import path from 'node:path';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';

const DEFAULT_EMBED_MODEL = 'hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf';

const program = new Command();

program
  .name('llmapi')
  .description('Standalone embedding API using node-llama-cpp')
  .version('1.0.0');

program
  .command('install')
  .description('Download and register a GGUF model')
  .argument('[uri]', 'Model URI (URL or hf:user/repo/file)')
  .option('-n, --name <name>', 'Name for the model')
  .option('--default', 'Install default embedding model')
  .action(async (uri: string | undefined, options: { name?: string; default?: boolean }) => {
    const useDefault = options.default || uri === '--default';
    const modelUri = (uri && !uri.startsWith('--')) ? uri : (useDefault ? DEFAULT_EMBED_MODEL : null);
    if (!modelUri) {
      console.error('Provide a model URI or use --default');
      process.exit(1);
    }

    const modelsDir = path.resolve(config.modelPath);
    await fs.mkdir(modelsDir, { recursive: true });

    await load();

    const name = options.name ?? modelUri.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '') ?? 'model';
    const targetPath = path.join(modelsDir, name);

    if (existsSync(targetPath)) {
      console.log(`Model file exists at ${targetPath}, skipping download.`);
      await registerModel(name, targetPath);
      console.log(`Model '${name}' is ready.`);
      return;
    }

    const downloader = await createModelDownloader({
      modelUri,
      dirPath: modelsDir,
      showCliProgress: true,
    });

    const modelPath = await downloader.download();
    const resolvedName = options.name ?? path.basename(modelPath).replace(/[^a-zA-Z0-9._-]/g, '');

    await registerModel(resolvedName, modelPath);
    console.log(`\nModel '${resolvedName}' installed at ${modelPath}`);
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
