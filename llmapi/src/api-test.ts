type Result = {status: number; data: Record<string, any>; ms: number};

const BASE = `http://localhost:${process.env.LLMAPI_PORT || 3000}`;
let token: string | null = null;

async function request(method: string, path: string, body?: unknown): Promise<Result> {
  const start = performance.now();
  try {
    const headers: Record<string, string> = {'Content-Type': 'application/json'};

    // Add authorization header if we have a token
    if (token && !path.includes('/token')) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as Record<string, any>;
    return {status: res.status, data, ms: Math.round(performance.now() - start)};
  } catch {
    return {status: 0, data: {error: 'connection refused'}, ms: Math.round(performance.now() - start)};
  }
}

async function getToken() {
  if (token) return token;

  const res = await fetch(`${BASE}/token`, {
    method: 'GET',
    headers: {'Content-Type': 'application/json'},
  });

  if (res.ok) {
    const data = await res.json();
    token = (data as any).token;
    return token;
  }

  throw new Error('Failed to get token');
}

async function main() {
  let passed = 0, failed = 0;

  function check(name: string, ok: boolean, detail: string) {
    const mark = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`  ${mark} ${name} ${detail}`);
    ok ? passed++ : failed++;
  }

  console.log(`\nllmapi API test — ${BASE}\n`);

  // Get token first
  try {
    await getToken();
  } catch (err) {
    console.error('Failed to get token:', err);
    process.exit(1);
  }

  const health = await request('GET', '/health');
  check('GET /health', health.status === 200 && (health.data as any).status === 'ok',
    `(${health.ms}ms)`);

  const models = await request('GET', '/v1/models');
  const modelsData = models.data as any;
  check('GET /v1/models', models.status === 200 && modelsData.object === 'list',
    `(${models.ms}ms, ${(modelsData.data ?? []).length} models)`);

  const embed = await request('POST', '/v1/embeddings', {
    input: 'The quick brown fox jumps over the lazy dog',
  });
  const embedData = embed.data as any;
  const embedOk = embed.status === 200 && embedData.object === 'list' && Array.isArray(embedData.data);
  const dim = embedOk ? embedData.data[0]?.embedding?.length ?? 0 : 0;
  check('POST /v1/embeddings (single string)', embedOk,
    `(${embed.ms}ms, dim=${dim})`);

  const embedBatch = await request('POST', '/v1/embeddings', {
    input: ['hello world', 'machine learning'],
    model: 'hf_ggml-org_embeddinggemma-300M-Q8_0.gguf'
  });
  const batchData = embedBatch.data as any;
  const batchOk = embedBatch.status === 200 && batchData.data?.length === 2;
  check('POST /v1/embeddings (batch)', batchOk,
    `(${embedBatch.ms}ms, ${batchData.data?.length ?? 0} results)`);

  const embedNoInput = await request('POST', '/v1/embeddings', {});
  check('POST /v1/embeddings (missing input → 400)',
    embedNoInput.status === 400,
    `(${embedNoInput.ms}ms)`);

  const modelsInstallNoUri = await request('POST', '/v1/models/install', {});
  check('POST /v1/models/install (missing uri → 400)',
    modelsInstallNoUri.status === 400,
    `(${modelsInstallNoUri.ms}ms)`);

  const rerankerName = (modelsData.data ?? []).find((m: any) => m.id.includes('reranker'))?.id;
  if (rerankerName) {
    const rerank = await request('POST', '/v1/rerank', {
      model: rerankerName,
      query: 'geography',
      documents: ['Paris is capital of France', 'I like pizza', 'Mount Everest is tall'],
    });
    const rerankData = rerank.data as any;
    const rerankOk = rerank.status === 200 && rerankData.object === 'rerank' && Array.isArray(rerankData.results) && rerankData.results.length === 3;
    check('POST /v1/rerank', rerankOk,
      `(${rerank.ms}ms, ${rerankOk ? `${rerankData.results.length} results, top score: ${rerankData.results[0].relevance_score.toFixed(4)}` : ''})`);
  } else {
    console.log('  \x1b[33m~\x1b[0m POST /v1/rerank (skipped — no reranker model installed)');
  }

  const rerankNoQuery = await request('POST', '/v1/rerank', {documents: ['a', 'b']});
  check('POST /v1/rerank (missing query → 400)',
    rerankNoQuery.status === 400,
    `(${rerankNoQuery.ms}ms)`);

  const rerankNoDocs = await request('POST', '/v1/rerank', {query: 'test'});
  check('POST /v1/rerank (missing documents → 400)',
    rerankNoDocs.status === 400,
    `(${rerankNoDocs.ms}ms)`);

  console.log(`\n\x1b[1m${passed + failed} tests: ${passed} passed, ${failed} failed\x1b[0m\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('api-test crashed:', err);
  process.exit(1);
});
