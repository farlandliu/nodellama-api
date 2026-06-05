type Result = {status: number; data: Record<string, unknown>; ms: number};

const BASE = `http://localhost:${process.env.LLMAPI_PORT || 3000}`;

async function request(method: string, path: string, body?: unknown): Promise<Result> {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {'Content-Type': 'application/json'},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as Record<string, unknown>;
    return {status: res.status, data, ms: Math.round(performance.now() - start)};
  } catch {
    return {status: 0, data: {error: 'connection refused'}, ms: Math.round(performance.now() - start)};
  }
}

async function main() {
  let passed = 0, failed = 0;

  function check(name: string, ok: boolean, detail: string) {
    const mark = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`  ${mark} ${name} ${detail}`);
    ok ? passed++ : failed++;
  }

  console.log(`\nllmapi API test — ${BASE}\n`);

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

  console.log(`\n\x1b[1m${passed + failed} tests: ${passed} passed, ${failed} failed\x1b[0m\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('api-test crashed:', err);
  process.exit(1);
});
