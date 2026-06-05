import {ModelSettings} from '../../../storage/app-db.js';
import {ChatContext} from '../chat-context.js';
import {NodeLlamaCppOptions} from './node-llama-cpp/node-llama-cpp-v2/node-llama-cpp-v2.js';

export type CreateChatOptions = NodeLlamaCppOptions & {
    model: string
}

export type EmbeddingOptions = Partial<NodeLlamaCppOptions> & {
    model: string
}

export type RerankResult = {
    index: number;
    relevance_score: number;
}

export default abstract class BaseBindClass<Settings> {
    public static shortName?: string;
    public static description?: string;

    public constructor(public modelSettings: ModelSettings<Settings>) {
    }

    public abstract initialize(): Promise<void> | void;

    public abstract createChat(overrideSettings?: CreateChatOptions): Promise<ChatContext>

    public abstract createEmbedding(input: string[], overrideSettings?: EmbeddingOptions): Promise<number[][]>

    public abstract rerank(query: string, documents: string[], overrideSettings?: EmbeddingOptions): Promise<RerankResult[]>
}
