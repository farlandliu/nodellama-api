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
