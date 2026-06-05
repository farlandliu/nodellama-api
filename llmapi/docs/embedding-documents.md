Using Embedding
What is an embedding?

An embedding is a numerical vector representation that captures the semantic meaning of a text.

To embed a text is the process of converting a text into an embedding.

This is useful for many NLP (Natural Language Processing) tasks, such as classification, clustering, and similarity search.

This is often used for searching for similar texts based on their meaning, rather than verbatim text matching.

When you have a lot of data, processing all of it using inference (by feeding it into a model and asking it questions about the data) is slow and can be expensive. Using inference for processing provides the most high-quality results, but it's not always necessary.

For example, assuming that we have 10K documents and want to find the most relevant ones to a given query, using inference for all of those documents can take a long time, and even if done in parallel, it can be expensive (in terms of compute resource usage costs).

Instead, we can embed all the documents once and then search for the most similar ones to the query based on the embeddings. To do that, we embed all the documents in advance and store the embeddings in a database. Then, when a query comes in, we embed the query and search for the most similar embeddings in the database, and return the corresponding documents.

Read the choosing a model tutorial to learn how to choose the right model for your use case.

Finding Relevant Documents
Let's see an example of how we can embed 10 texts and then search for the most relevant one to a given query:

NOTE

Always make sure you only compare embeddings created using the exact same model file.

Comparing embeddings created using different models can lead to incorrect results and may even cause errors.


import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaEmbedding} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "bge-small-en-v1.5-q8_0.gguf")
});
const context = await model.createEmbeddingContext();

async function embedDocuments(documents: readonly string[]) {
    const embeddings = new Map<string, LlamaEmbedding>();

    await Promise.all(
        documents.map(async (document) => {
            const embedding = await context.getEmbeddingFor(document);
            embeddings.set(document, embedding);

            console.debug(
                `${embeddings.size}/${documents.length} documents embedded`
            );
        })
    );

    return embeddings;
}

function findSimilarDocuments(
    embedding: LlamaEmbedding,
    documentEmbeddings: Map<string, LlamaEmbedding>
) {
    const similarities = new Map<string, number>();
    for (const [otherDocument, otherDocumentEmbedding] of documentEmbeddings)
        similarities.set(
            otherDocument,
            embedding.calculateCosineSimilarity(otherDocumentEmbedding)
        );

    return Array.from(similarities.keys())
        .sort((a, b) => similarities.get(b)! - similarities.get(a)!);
}

const documentEmbeddings = await embedDocuments([
    "The sky is clear and blue today",
    "I love eating pizza with extra cheese",
    "Dogs love to play fetch with their owners",
    "The capital of France is Paris",
    "Drinking water is important for staying hydrated",
    "Mount Everest is the tallest mountain in the world",
    "A warm cup of tea is perfect for a cold winter day",
    "Painting is a form of creative expression",
    "Not all the things that shine are made of gold",
    "Cleaning the house is a good way to keep it tidy"
]);


const query = "What is the tallest mountain on Earth?";
const queryEmbedding = await context.getEmbeddingFor(query);

const similarDocuments = findSimilarDocuments(
    queryEmbedding,
    documentEmbeddings
);
const topSimilarDocument = similarDocuments[0];

console.log("query:", query);
console.log("Document:", topSimilarDocument);
This example will produce this output:


query: What is the tallest mountain on Earth?
Document: Mount Everest is the tallest mountain in the world
This example uses bge-small-en-v1.5