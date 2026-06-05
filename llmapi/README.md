# llmapi

Standalone embedding API server using `node-llama-cpp`. Provides OpenAI-compatible embedding endpoints with minimal model management.

## Quick Start

```bash
# Install a model
pnpm cli -- install https://huggingface.co/ggml-org/embeddinggemma-300M-GGUF/resolve/main/embeddinggemma-300M-Q8_0.gguf

# Start server
pnpm start

# Or via CLI
pnpm cli -- serve --port 3000
```

## CLI

```
Usage: llmapi [options] [command]

Commands:
  install <url>   Download and register a GGUF model
  list            List installed models
  serve           Start the embedding API server
  help            Display help
```

## API

### `POST /v1/embeddings`

OpenAI-compatible embedding endpoint.

```json
{
  "input": "text to embed",
  "model": "optional-model-name"
}
```

Response:

```json
{
  "object": "list",
  "data": [
    { "object": "embedding", "index": 0, "embedding": [0.1, -0.2, ...] }
  ],
  "usage": { "prompt_tokens": 10, "total_tokens": 10 }
}
```

### `GET /v1/models`

List installed models.

### `POST /v1/models/install`

Download and register a GGUF model.

```json
{ "url": "https://huggingface.co/.../model.gguf", "name": "my-model" }
```

### `DELETE /v1/models/:name`

Remove a model.

### `GET /health`

Health check.

## Configuration

| Env | Default | Description |
|-----|---------|-------------|
| `LLMAPI_PORT` | `3000` | Server port |
| `LLMAPI_DIR` | `~/.llmapi` | Data directory (models stored in `models/` subdir) |

Model registry stored in `models.json` at project root.
