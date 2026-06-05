import {Command} from 'commander';
import {load, registerModel} from './storage.js';
import {getOrInitLlama} from './llama-service.js';
import {config} from './config.js';
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
    const rawName = options.name ?? url.split('/').pop()?.split(/[?#]/).shift() ?? 'model';
    const name = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '');
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
