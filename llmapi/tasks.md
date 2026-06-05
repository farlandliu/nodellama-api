
## tk-03 add cli command 'pnpm sample'

the command will do the following tasks:

- feed sample text to test embedding api, and print the result to console
- feed sample test list to test reranker api, and output the result to console


## tk-01 refactor embedding api

refer the app in './server', only implement the embedding api, keep node-llama-cpp works fine.

## tk-02 refine cli to download models

refer node-llama-cpp documents: https://node-llama-cpp.withcat.ai/cli/pull

use format: 'hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf'

```
pull command
Download models from URLs

A wrapper around ipull to download model files as fast as possible with parallel connections and other optimizations.

Automatically handles split and binary-split models files, so only pass the URI to the first file of a model.

If a file already exists and its size matches the expected size, it will not be downloaded again unless the --override flag is used.

The supported URI schemes are:

HTTP: https://, http://
Hugging Face: hf:<user>/<model>:<quant> (:<quant> is optional, but recommended)
Hugging Face: hf:<user>/<model>/<file-path>#<branch> (#<branch> is optional)
Learn more about using model URIs in the Downloading Models guide.

To programmatically download a model file in your code, use createModelDownloader()
```

```ts
const DEFAULT_EMBED_MODEL = "hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf";
const DEFAULT_RERANK_MODEL = "hf:ggml-org/Qwen3-Reranker-0.6B-Q8_0-GGUF/qwen3-reranker-0.6b-q8_0.gguf";
// const DEFAULT_GENERATE_MODEL = "hf:ggml-org/Qwen3-0.6B-GGUF/Qwen3-0.6B-Q8_0.gguf";
const DEFAULT_GENERATE_MODEL = "hf:tobil/qmd-query-expansion-1.7B-gguf/qmd-query-expansion-1.7B-q4_k_m.gguf";
```