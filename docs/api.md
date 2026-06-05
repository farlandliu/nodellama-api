# Catai API

Catai provides multiple APIs to interact with the model.

## Local API

The local API is only available in Node.js.

Enable you to chat with the model locally on your computer.

```ts
import {createChat} from 'catai';

const chat = await createChat(); // using the default model installed

const response = await catai.prompt('Write me 100 words story', token => {
    progress.stdout.write(token);
});

console.log(`Total text length: ${response.length}`);
```

You can also specify the model you want to use:

```ts
import {createChat} from 'catai';
const chat = await createChat({model: "llama3"});
```

If you want to install the model on the fly, please read the [install-api guide](./install-api.md)

## Remote API

Allowing you to run the model on a remote server.

### Simple API

Node.js & Browser compatible API:

```js
const response = await fetch('http://127.0.0.1:3000/api/chat/prompt', {
    method: 'POST',
    body: JSON.stringify({
        prompt: 'Write me 100 words story'
    }),
    headers: {
        'Content-Type': 'application/json'
    }
});

const data = await response.text();
```

<details>
  <summary>You can also stream the response</summary>

```js
const response = await fetch('http://127.0.0.1:3000/api/chat/prompt', {
    method: 'POST',
    body: JSON.stringify({
        prompt: 'Write me 100 words story'
    }),
    headers: {
        'Content-Type': 'application/json'
    }
});

const reader = response.body.pipeThrough(new TextDecoderStream())
    .getReader();

while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    console.log('Received', value);
}
```

</details>

### Advanced API

This API is only available only in Node.js.
[demo](../examples/remotecall.js)

```js
import { RemoteCatAI } from "catai";

const catai = new RemoteCatAI("ws://localhost:3000");

const response = await catai.prompt("Write me 100 words story", (token) => {
    process.stdout.write(token);
});

console.log(`Total text length: ${response.length}`);
catai.close();

```

## OpenAI-compatible API

Catai also exposes OpenAI-compatible REST endpoints under both `/v1` and `/api/v1`, so OpenAI SDKs can point their `baseURL` at your Catai server.

### List models

```bash
curl http://127.0.0.1:3000/v1/models
```

### Chat completions

```bash
curl http://127.0.0.1:3000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "llama3",
    "messages": [{"role": "user", "content": "Write a short story"}],
    "stream": false
  }'
```

Set `stream` to `true` to receive Server-Sent Events compatible with OpenAI streaming chat completions.

### Text completions

```bash
curl http://127.0.0.1:3000/v1/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "llama3",
    "prompt": "Once upon a time",
    "stream": false
  }'
```

### Embeddings

Use an embedding-capable GGUF model and send either a single string or an array of strings.

```bash
curl http://127.0.0.1:3000/v1/embeddings \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "nomic-embed-text",
    "input": ["first document", "second document"]
  }'
```

### Reranking

Use a reranking-capable GGUF model to score documents against a query. Results are returned from highest to lowest score, and `top_n` can limit the response size.

```bash
curl http://127.0.0.1:3000/v1/rerank \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "bge-reranker",
    "query": "local LLM API",
    "documents": ["OpenAI-compatible APIs", "Unrelated text"],
    "top_n": 2,
    "return_documents": true
  }'
```
