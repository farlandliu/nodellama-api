# llmapi — Standalone Embedding API

## Overview

A minimal Express-based API server that provides OpenAI-compatible embedding endpoints using `node-llama-cpp`. Extracted/refactored from the `server/` (catai) project, keeping only the embedding functionality with simplified architecture.

## Architecture

```
llmapi/
├── src/
│   ├── index.ts           # Entry point — starts Express server
│   ├── config.ts          # Env-based configuration
│   ├── storage.ts         # JSON file DB for models.json
│   ├── llama-service.ts   # Core wrapper around node-llama-cpp
│   ├── routes/
│   │   ├── embeddings.ts  # POST /v1/embeddings
│   │   └── models.ts      # GET /v1/models, POST /v1/models/install
│   └── cli.ts            # Commander-based CLI
├── models.json            # Model registry (app root)
├── package.json
└── tsconfig.json
```

## Components

### config.ts
Reads from environment variables with defaults:
- `LLMAPI_DIR` — data directory (`~/.llmapi`)
- `LLMAPI_PORT` — server port (`3000`)
- `LLMAPI_MODEL_INDEX` — model index URL (optional, for remote model listing)

### storage.ts
Loads/saves `llmapi/models.json` (relative to app root). Schema:
```ts
type ModelEntry = {
  downloadedFiles: { model: string }
  settings: { bind: string }
  createDate: number
}
type Storage = {
  activeModel: string
  models: Record<string, ModelEntry>
}
```

### llama-service.ts
Singleton caching `Llama` and `LlamaModel` instances by model path.

- `initLlama()` → calls `getLlama()`, caches
- `loadModel(modelPath)` → `llama.loadModel()`, caches by path
- `createEmbedding(input: string[], options?)` → `number[][]`
  - Creates `LlamaEmbeddingContext` via `model.createEmbeddingContext()`
  - Calls `context.getEmbeddingFor(item)` per input
  - Disposes context after use (same pattern as server's `node-llama-cpp-v2.ts`)
- `getActiveModelPath()` — resolves model from storage

### routes/embeddings.ts
`POST /v1/embeddings`

Request: `{ model?: string, input: string | string[] }`
Response (OpenAI-compatible):
```json
{
  "object": "list",
  "model": "model-name",
  "data": [
    { "object": "embedding", "index": 0, "embedding": [0.1, -0.2, ...] }
  ],
  "usage": { "prompt_tokens": 10, "total_tokens": 10 }
}
```

### routes/models.ts
- `GET /v1/models` — list installed models (OpenAI format `{ object: "list", data: [...] }`)
- `POST /v1/models/install` — `{ url: string, name?: string }` downloads GGUF file via native fetch + streaming write, saves to `LLMAPI_DIR/models/`, registers in `models.json`

### cli.ts
Commander CLI:
- `llmapi install <url>` — download and register a model
- `llmapi list` — list installed models
- `llmapi serve` — start the HTTP server

## Data Flow

```
Client → POST /v1/embeddings
  → router validates input
  → llama-service.createEmbedding()
    → llama-service.getActiveModelPath() / loadModel()
    → model.createEmbeddingContext()
    → Promise.all(inputs.map(item => context.getEmbeddingFor(item)))
    → context.dispose()
  → OpenAI-formatted JSON response
```

## Error Handling
- Invalid input → 400 `{ error: { message, type, code, param } }`
- Model not loaded → 503
- Internal errors → 500 with sanitized message

## Key Differences from server/
- No bind-class abstraction layer (single backend: node-llama-cpp)
- No chat, completion, or rerank endpoints
- Express 5 instead of tinyhttp
- Simpler config (env-based, no CatAIJsonDB)
- `models.json` in app root directory
