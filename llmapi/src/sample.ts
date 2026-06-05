import {load, getActiveModelPath} from './storage.js';
import {createEmbedding, rerank} from './llama-service.js';

async function findRerankerModel(): Promise<string | null> {
  const db = await load();
  for (const [name, entry] of Object.entries(db.models)) {
    if (name === db.activeModel) continue;
    if (name.toLowerCase().includes('reranker')) {
      return entry.downloadedFiles.model;
    }
  }
  return null;
}

async function main() {
  await load();

  const embedModelPath = getActiveModelPath();
  if (!embedModelPath) {
    console.error('No active model found. Run `pnpm cli install --default` first.');
    process.exit(1);
  }
  console.log(`Embedding model: ${embedModelPath}`);

  const sampleTexts = [
    'The quick brown fox jumps over the lazy dog',
    'Machine learning is transforming how we process natural language',
    'The weather today is sunny and warm with a gentle breeze',
  ];

  console.log('\n--- Embedding Test ---');
  console.log(`Input (${sampleTexts.length} texts):`);
  for (const t of sampleTexts) console.log(`  "${t.substring(0, 60)}${t.length > 60 ? '...' : ''}"`);

  const embeddings = await createEmbedding(sampleTexts, embedModelPath);
  for (let i = 0; i < embeddings.length; i++) {
    const vec = embeddings[i];
    console.log(`\nEmbedding[${i}] dim=${vec.length} first 4 values: [${vec.slice(0, 4).map(v => v.toFixed(6)).join(', ')}]`);
  }

  const rerankerPath = await findRerankerModel();
  if (!rerankerPath) {
    console.log('\nNo reranker model found. Skipping reranker test.');
    return;
  }
  console.log(`\nReranker model: ${rerankerPath}`);

  const query = 'machine learning and artificial intelligence';
  const documents = [
    'The weather today is sunny and warm with a gentle breeze',
    'Deep neural networks excel at pattern recognition across many domains',
    'I need to buy groceries and prepare dinner for tonight',
    'Transformer architectures revolutionized natural language processing tasks',
    'My cat enjoys sleeping on the windowsill during afternoon sun',
  ];

  console.log(`\n--- Reranker Test ---`);
  console.log(`Query: "${query}"`);
  console.log(`Documents (${documents.length}):`);
  for (const d of documents) console.log(`  "${d}"`);

  const results = await rerank(query, documents, rerankerPath);

  console.log(`\nRanked results (descending by relevance):`);
  const sorted = [...results].sort((a, b) => b.relevance_score - a.relevance_score);
  for (const r of sorted) {
    console.log(`  [${r.relevance_score.toFixed(4)}] "${documents[r.index]}"`);
  }
}

main().catch((err) => {
  console.error('Sample failed:', err);
  process.exit(1);
});
