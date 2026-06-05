# llmapi

Standalone embedding API server using `node-llama-cpp`. Provides OpenAI-compatible embedding endpoints with minimal model management.

## Quick Start

```bash
# Install default embedding model
pnpm cli -- install --default

# Install from Hugging Face
pnpm cli -- install hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf

# Install from URL
pnpm cli -- install https://example.com/model.gguf

# Start server
pnpm start

# Or via CLI
pnpm cli -- serve --port 3000
```

## CLI

```
Usage: llmapi [options] [command]

Commands:
  install [uri]   Download and register a GGUF model
  list            List installed models
  serve           Start the embedding API server
  help            Display help

Options (install):
  -n, --name <name>  Name for the model
  --default          Install default embedding model
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

Download and register a GGUF model (supports `hf:` URIs and HTTP URLs).

```json
{ "uri": "hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf", "name": "my-model" }
```

### `GET /health`

Health check.

## Configuration

| Env | Default | Description |
|-----|---------|-------------|
| `LLMAPI_PORT` | `3000` | Server port |
| `LLMAPI_DIR` | `~/.llmapi` | Data directory (models stored in `models/` subdir) |

Model registry stored in `models.json` at project root.
