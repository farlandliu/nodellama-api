# llmapi

Standalone embedding API using node-llama-cpp

## Features

- Embedding generation using Llama models
- Reranking functionality
- Model management (install, list)
- JWT token authentication

## Authentication

All API endpoints (except `/health` and `/token`) require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Getting a token

You can obtain a token using the CLI:

```bash
pnpm run cli token
```

Or make a GET request to the `/token` endpoint:

```bash
curl http://localhost:3000/token
```

### Production Security

In production, the `/token` endpoint requires initial authentication for security. You must provide an initial password:

```bash
curl -H "x-initial-password: your-initial-password" http://localhost:3000/token
```

Set the `INITIAL_PASSWORD` environment variable to configure the initial authentication password:

```bash
export INITIAL_PASSWORD="your-secure-initial-password"
```

### Token generation

Tokens are valid for 90 days and are generated using a secret key. For development, a default key is used, but in production, set the `JWT_SECRET` environment variable to a secure value:

```bash
export JWT_SECRET="your-very-secure-random-secret-here-32-characters-minimum"
```

To generate a secure secret:
```bash
# Using openssl
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Using Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

## API Endpoints

### Health Check
- `GET /health` - Check if the service is running

### Token
- `GET /token` - Generate a new JWT token

### Embeddings
- `POST /v1/embeddings` - Generate embeddings for text input

### Models
- `GET /v1/models` - List installed models
- `POST /v1/models/install` - Install a new model

### Reranking
- `POST /v1/rerank` - Re-rank documents based on a query

## Environment Variables

- `LLMAPI_PORT` - Port to listen on (default: 3000)
- `LLMAPI_DIR` - Directory for storing data (default: ~/.llmapi)
- `MODEL_PATH` - Directory for storing models (default: ./models)
- `JWT_SECRET` - Secret key for JWT tokens (default: llmapi-default-secret-key)

## Development

### Install dependencies
```bash
pnpm install
```

### Build
```bash
pnpm run build
```

### Run in development mode
```bash
pnpm run dev
```

### Start server
```bash
pnpm run start
```

### Run tests
```bash
pnpm run api-test
```

### CLI commands
```bash
pnpm run cli --help
```

## License

ISC