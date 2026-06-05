import {load} from './storage.js';
import {rerank} from './llama-service.js';

const testCases = [
  {
    name: "1. Semantic Matching vs. Keyword Matching",
    query: "How to alleviate eye strain from staring at a computer screen for long periods?",
    candidates: [
      "Follow the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds, and use artificial tears if needed.",
      "Blue light blocking glasses can reduce glare and may help prevent digital eye strain during extended screen time.",
      "Adjusting your monitor's brightness and contrast to match the ambient lighting in your room is a good practice.",
      "The refresh rate and resolution of a computer screen do not directly cause eye strain, but poor posture does.",
      "Computer monitors have evolved significantly since the CRT days, with OLED and IPS panels dominating the market."
    ],
    highIndices: [0, 1, 2],
    lowIndices: [3, 4]
  },
  {
    name: "2. Hard Negative Recognition",
    query: "What is the battery warranty period for a Tesla Model 3?",
    candidates: [
      "Tesla provides an 8-year or 120,000-mile warranty for the Model 3 battery and drive unit, whichever comes first, retaining at least 70% capacity.",
      "The Model 3 Long Range battery is covered under the vehicle's comprehensive new car limited warranty for 4 years or 50,000 miles.",
      "If your Tesla Model 3 battery degrades beyond the warranty threshold, you may be eligible for a free replacement or repair.",
      "The Tesla Model 3 features a lithium-ion battery pack with a capacity of 60 kWh, but out-of-warranty replacements are very expensive.",
      "Electric vehicle batteries generally last between 10 to 20 years, depending on charging habits and climate conditions."
    ],
    highIndices: [0, 1, 2],
    lowIndices: [3, 4]
  },
  {
    name: "3. Multi-constraint Filtering",
    query: "Recommend a Markdown editor for macOS that works completely offline and is open-source.",
    candidates: [
      "Obsidian is a powerful, local-first note-taking app for macOS that stores all data locally and its core features are free and open-source.",
      "Zettlr is a free, open-source Markdown editor designed for academic writing, fully supporting macOS and offline usage.",
      "Typora is a beautiful, minimalist Markdown editor for macOS that works offline, though it requires a one-time purchase and is not open-source.",
      "Notion is an excellent all-in-one workspace with great Markdown support for macOS, but it requires an active internet connection to sync.",
      "Visual Studio Code is a highly customizable code editor that supports Markdown preview through various community extensions."
    ],
    highIndices: [0, 1],
    lowIndices: [2, 3, 4]
  },
  {
    name: "4. Negation Understanding",
    query: "Find a caffeine-free herbal tea suitable for pregnant women to help with relaxation.",
    candidates: [
      "Rooibos tea is naturally caffeine-free, rich in antioxidants, and is widely considered a safe, soothing choice for hydration during pregnancy.",
      "Peppermint tea is generally caffeine-free and can help soothe an upset stomach, though pregnant women should consume it in moderation.",
      "Ginger tea is naturally caffeine-free and is often recommended to alleviate morning sickness during the first trimester of pregnancy.",
      "Green tea contains L-theanine which promotes relaxation, but due to its caffeine content, it is not recommended for pregnant women in large amounts.",
      "Chamomile tea is a popular bedtime beverage, but some studies suggest pregnant women should avoid it due to potential uterine stimulation risks."
    ],
    highIndices: [0, 1, 2],
    lowIndices: [3, 4]
  },
  {
    name: "5. Domain Specific / Entity Disambiguation",
    query: "What is the specific purpose of the `yield` keyword in Python?",
    candidates: [
      "In Python, `yield` is used to define a generator function. It pauses the function's execution, returns a value, and saves the local state to resume later.",
      "The `yield` keyword turns a normal function into a generator, allowing it to produce a sequence of values over time rather than computing them all at once.",
      "Unlike `return` which terminates a function, `yield` allows a Python function to suspend its execution and yield control back to the caller.",
      "The `return` statement in Python is used to exit a function and pass a value back to the caller, destroying local variables in the process.",
      "Python's `async` and `await` keywords are used for asynchronous programming, allowing non-blocking execution of I/O bound tasks."
    ],
    highIndices: [0, 1, 2],
    lowIndices: [3, 4]
  },
  {
    name: "6. Long Query & Complex Logic",
    query: "Which domestic Chinese smartphones released after 2023 support Wi-Fi 7 and are currently priced under 3000 RMB?",
    candidates: [
      "The Redmi K70 Pro, released in late 2023, features Wi-Fi 7 technology and is currently priced around 2999 RMB on major e-commerce platforms.",
      "The Realme GT5 Pro, launched in December 2023, supports Wi-Fi 7 and often sees promotional pricing dipping just below the 3000 RMB mark.",
      "The iQOO Neo9 series, released in early 2024, offers Wi-Fi 7 connectivity and starts at a very competitive price point near 2500 RMB.",
      "The Huawei Mate 60 Pro is a flagship Chinese smartphone released in late 2023, but its starting price is well above 6000 RMB.",
      "Wi-Fi 7 is the latest wireless networking standard, offering significantly higher throughput and lower latency compared to Wi-Fi 6E."
    ],
    highIndices: [0, 1, 2],
    lowIndices: [3, 4]
  },
  {
    name: "7. Coreference Resolution",
    query: "Who directed this movie, and what other famous sci-fi films has he directed? (Context: Oppenheimer)",
    candidates: [
      "Oppenheimer was directed by Christopher Nolan, who is also renowned for directing acclaimed sci-fi films like Inception, Interstellar, and Tenet.",
      "Christopher Nolan, the director of Oppenheimer, has a strong history in the sci-fi genre, notably with The Prestige and Interstellar.",
      "The film Oppenheimer was helmed by Christopher Nolan, a filmmaker known for complex narratives, though his sci-fi works are his most famous.",
      "Cillian Murphy delivered an Oscar-winning performance in Oppenheimer, having previously starred in the drama series Peaky Blinders.",
      "Hans Zimmer composed the haunting score for Oppenheimer, marking his first collaboration with Christopher Nolan since Dunkirk."
    ],
    highIndices: [0, 1, 2],
    lowIndices: [3, 4]
  }
];

async function findRerankerModel(): Promise<string | null> {
  const db = await load();
  for (const [name, entry] of Object.entries(db.models)) {
    if (name === db.activeModel) continue;
    if (name.toLowerCase().includes('jina')) {
      return entry.downloadedFiles.model;
    }
  }
  return null;
}

async function writeResult(filePath: string, content: string): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true});
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

async function main() {
  await load();

  const rerankerPath = await findRerankerModel();
  if (!rerankerPath) {
    const msg = 'No reranker model found. Run `pnpm cli install` with a reranker model first.';
    console.error(msg);
    await writeResult('./temp/rerank-test-en_error.txt', msg + '\n');
    process.exit(1);
  }
  console.log(`Reranker model: ${rerankerPath}\n`);

  let passCount = 0;
  let failCount = 0;

  for (const tc of testCases) {
    const results = await rerank(tc.query, tc.candidates, rerankerPath);
    const sorted = [...results].sort((a, b) => b.relevance_score - a.relevance_score);

    const highScores = tc.highIndices.map(i => results.find(r => r.index === i)!.relevance_score);
    const lowScores = tc.lowIndices.map(i => results.find(r => r.index === i)!.relevance_score);
    const minHigh = Math.min(...highScores);
    const maxLow = Math.max(...lowScores);
    const passed = minHigh > maxLow;

    console.log(`--- ${tc.name} ---`);
    console.log(`Query: ${tc.query}`);
    const lines: string[] = [];
    for (const r of sorted) {
      const label = tc.highIndices.includes(r.index) ? '(high)' : tc.lowIndices.includes(r.index) ? '(low)' : '';
      console.log(`  [${r.relevance_score.toFixed(4)}] doc[${r.index}] ${label}`);
      lines.push(`  [${r.relevance_score.toFixed(4)}] doc[${r.index}] ${label}`);
    }
    console.log(`Result: ${passed ? 'PASS' : 'FAIL'}\n`);

    const testName = tc.name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
    await writeResult(`./temp/${testName}.txt`, [
      `Case: ${tc.name}`,
      `Query: ${tc.query}`,
      ...lines,
      `Result: ${passed ? 'PASS' : 'FAIL'}`
    ].join('\n'));

    if (passed) passCount++;
    else failCount++;
  }

  const summary = `\n=== Summary: ${passCount} passed, ${failCount} failed (total ${testCases.length}) ===`;
  console.log(summary);
}

main().catch((err) => {
  console.error('Rerank test failed:', err);
  process.exit(1);
});
