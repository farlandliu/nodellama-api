import {load} from './storage.js';
import {createEmbedding, rerankDocuments, getModelPath} from './bind-class/bind-class.js';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function findRerankerModelName(): Promise<string | null> {
  const db = await load();
  for (const name of Object.keys(db.models)) {
    if (name === db.activeModel) continue;
    if (name.toLowerCase().includes('reranker')) return name;
  }
  return null;
}

const documents = [
  'The sky is clear and blue today',
  'I love eating pizza with extra cheese',
  'Dogs love to play fetch with their owners',
  'The capital of France is Paris',
  'Drinking water is important for staying hydrated',
  'Mount Everest is the tallest mountain in the world',
  'A warm cup of tea is perfect for a cold winter day',
  'Painting is a form of creative expression',
  'Not all the things that shine are made of gold',
  'Cleaning the house is a good way to keep it tidy',
];

async function main() {
  await load();

  console.log('--- Embedding + Similarity Search ---');
  const query = 'What is the tallest mountain on Earth?';
  console.log(`Query: "${query}"`);
  console.log(`Documents (${documents.length}):`);
  for (const d of documents) console.log(`  "${d}"`);

  const docVectors = await createEmbedding(documents);
  const [queryVector] = await createEmbedding([query]);

  const scored = docVectors.map((vec, i) => ({
    index: i,
    score: cosineSimilarity(queryVector, vec),
  }));
  scored.sort((a, b) => b.score - a.score);

  console.log(`\nTop match: "${documents[scored[0].index]}" (cosine sim: ${scored[0].score.toFixed(4)})`);
  console.log(`Second: "${documents[scored[1].index]}" (${scored[1].score.toFixed(4)})`);
  console.log(`Worst:  "${documents[scored[scored.length - 1].index]}" (${scored[scored.length - 1].score.toFixed(4)})`);

  const rerankerName = await findRerankerModelName();
  if (!rerankerName) {
    console.log('\nNo reranker model found. Skipping reranker test.');
    return;
  }

  console.log(`\n--- Reranker (${rerankerName}) ---`);
  const rerankQuery = 'Tell me a geographical fact';
  console.log(`Query: "${rerankQuery}"`);

  const results = await rerankDocuments(rerankQuery, documents, {model: rerankerName});
  const sorted = [...results].sort((a, b) => b.relevance_score - a.relevance_score);

  console.log(`Top document: "${documents[sorted[0].index]}" (score: ${sorted[0].relevance_score.toFixed(4)})`);
  console.log(`Second document: "${documents[sorted[1].index]}" (${sorted[1].relevance_score.toFixed(4)})`);
  console.log('\nFull ranking:');
  for (const r of sorted) {
    console.log(`  [${r.relevance_score.toFixed(4)}] "${documents[r.index]}"`);
  }
}

main().catch((err) => {
  console.error('Sample2 failed:', err);
  process.exit(1);
});
