Reranking Documents
After you search for the most similar documents using embedding vectors, you can use inference to rerank (sort) the documents based on their relevance to the given query.

Doing this allows you to combine the best of both worlds: the speed of embedding and the quality of inference.


import {fileURLToPath} from "url";
import path from "path";
import {getLlama} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "bge-reranker-v2-m3-Q8_0.gguf")
});
const context = await model.createRankingContext();

const documents = [
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
];

const query = "Tell me a geographical fact";
const rankedDocuments = await context.rankAndSort(query, documents);

const topDocument = rankedDocuments[0]!;
const secondDocument = rankedDocuments[1]!;

console.log("query:", query);
console.log("Top document:", topDocument.document);
console.log("Second document:", secondDocument.document);
console.log("Ranked documents:", rankedDocuments);
This example will produce this output:


query: Tell me a geographical fact
Top document: Mount Everest is the tallest mountain in the world
Second document: The capital of France is Paris
This example uses bge-reranker-v2-m3-Q8_0.gguf