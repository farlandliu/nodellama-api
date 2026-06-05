import express from 'express';
import cors from 'cors';
import {config} from './config.js';
import {load} from './storage.js';
import {embeddingRouter} from './routes/embeddings.js';
import {modelRouter} from './routes/models.js';
import {rerankRouter} from './routes/rerank.js';
import {getOrInitLlama} from './llama-service.js';
import {authenticateToken, createTokenRoute} from './auth.js';
import {validateInitialAuth} from './initial-auth.js';

const app = express();

app.use(cors());
app.use(express.json());

// For production, require initial authentication to generate tokens
// In development, we'll allow it for convenience
if (process.env.NODE_ENV === 'production') {
  app.use(validateInitialAuth);
}

// Token endpoint requires initial authentication in production
app.get('/token', createTokenRoute);

// All other API routes require authentication
app.use('/v1', authenticateToken);
app.use('/v1', embeddingRouter);
app.use('/v1', modelRouter);
app.use('/v1', rerankRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function main() {
  await load();
  await getOrInitLlama();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`llmapi listening on http://0.0.0.0:${config.port}`);
  });
}

main().catch(console.error);
