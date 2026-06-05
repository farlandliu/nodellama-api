import {
    ChatSessionModelFunction,
    getLlama,
    Llama,
    LLamaChatPromptOptions,
    LlamaChatSession,
    LlamaChatSessionOptions,
    LlamaContextOptions,
    LlamaEmbeddingContextOptions,
    LlamaModel,
    LlamaModelOptions,
    LlamaOptions,
    LlamaRankingContextOptions
} from 'node-llama-cpp';
import NodeLlamaCppChat from './node-llama-cpp-chat.js';
import BaseBindClass, {EmbeddingOptions, RerankResult} from '../../base-bind-class.js';
import objectAssignDeep from 'object-assign-deep';
import fsExtra from 'fs-extra';
import {ModelNotInstalledError} from '../../../errors/ModelNotInstalledError.js';
import {getWebSearchFunction} from './calls/web-search.js';
import {getCurrencyConversionFunction} from './calls/currency-conversion.js';
import {getWeatherFunction} from './calls/get-weather.js';
import {getDateFunction} from './calls/get-date.js';
import {getStocksFunction} from './calls/get-stocks.js';

type ChatFlags = {
    builtInAPICall?: {
        webSearch: boolean;
        date: boolean;
        weather: boolean;
        currency: boolean;
        stocks: boolean;
    } | true;
};

type CompletionSettings = {
    completion?: {
        maxTokens: number;
    }
}

export type NodeLlamaCppOptions =
    Omit<LlamaContextOptions, 'model'> &
    Omit<LlamaModelOptions, 'modelPath'> &
    Omit<LlamaChatSessionOptions, 'contextSequence'> &
    LLamaChatPromptOptions & ChatFlags & CompletionSettings;


let cachedLlama: Llama | null = null;

export async function initCatAILlama(options?: LlamaOptions) {
    return cachedLlama = await getLlama(options);
}

export default class NodeLlamaCppV2 extends BaseBindClass<NodeLlamaCppOptions> {
    public static override shortName = 'node-llama-cpp-v2';
    public static override description = 'node-llama-cpp v2, that support GGUF model, and advanced feature such as output format, max tokens and much more';
    private _model?: LlamaModel;

    async createChat(overrideSettings?: NodeLlamaCppOptions) {
        if (!this._model)
            throw new Error('Model not initialized');

        const settings = objectAssignDeep({}, this.modelSettings.settings, overrideSettings);
        const context = await this._model.createContext({
            ...settings
        });

        const session = new LlamaChatSession({
            contextSequence: context.getSequence(),
            ...settings
        });

        this._flagsToSettings(settings);
        return new NodeLlamaCppChat(settings, session);
    }


    async createEmbedding(input: string[], overrideSettings?: EmbeddingOptions): Promise<number[][]> {
        if (!this._model)
            throw new Error('Model not initialized');

        const settings = objectAssignDeep({}, this.modelSettings.settings, overrideSettings);
        const context = await this._model.createEmbeddingContext(this._getEmbeddingContextOptions(settings));

        try {
            const embeddings = await Promise.all(input.map(async item => {
                const embedding = await context.getEmbeddingFor(item);
                return [...embedding.vector];
            }));

            return embeddings;
        } finally {
            await context.dispose();
        }
    }

    async rerank(query: string, documents: string[], overrideSettings?: EmbeddingOptions): Promise<RerankResult[]> {
        if (!this._model)
            throw new Error('Model not initialized');

        const settings = objectAssignDeep({}, this.modelSettings.settings, overrideSettings);
        const context = await this._model.createRankingContext(this._getRankingContextOptions(settings));

        try {
            const scores = await context.rankAll(query, documents);
            return scores.map((score, index) => ({
                index,
                relevance_score: score,
            }));
        } finally {
            await context.dispose();
        }
    }

    async initialize(): Promise<void> {
        if (!await fsExtra.pathExists(this.modelSettings.downloadedFiles.model)) {
            throw new ModelNotInstalledError(`Model ${this.modelSettings.downloadedFiles.model} does not exist locally - run "sync" to cleanup none exiting models`);
        }

        const llama = cachedLlama ?? await initCatAILlama();
        this._model = await llama.loadModel({
            modelPath: this.modelSettings.downloadedFiles.model,
            ...this.modelSettings.settings
        });
    }


    private _getEmbeddingContextOptions(settings?: Partial<NodeLlamaCppOptions>): LlamaEmbeddingContextOptions {
        const {contextSize, batchSize, threads, createSignal, ignoreMemorySafetyChecks} = settings ?? {};

        return {
            contextSize,
            batchSize,
            threads: typeof threads === 'number' ? threads : undefined,
            createSignal,
            ignoreMemorySafetyChecks,
        };
    }

    private _getRankingContextOptions(settings?: Partial<NodeLlamaCppOptions>): LlamaRankingContextOptions {
        const {contextSize, batchSize, threads, createSignal, ignoreMemorySafetyChecks} = settings ?? {};

        return {
            contextSize,
            batchSize,
            threads: typeof threads === 'number' ? threads : undefined,
            createSignal,
            ignoreMemorySafetyChecks,
        };
    }

    private _flagsToSettings(settings: NodeLlamaCppOptions) {
        const {webSearch = false, currency = false, date = false, weather = false, stocks = false} = settings.builtInAPICall === true ? {
            webSearch: true,
            date: true,
            weather: true,
            currency: true,
            stocks: true,
        } : (settings.builtInAPICall ?? {});

        const functions: Record<string, ChatSessionModelFunction> = settings.functions ??= {};

        if (webSearch) {
            functions.webSearch = getWebSearchFunction();
        }

        if (currency) {
            functions.currencyConversion = getCurrencyConversionFunction();
        }

        if (weather) {
            functions.getWeather = getWeatherFunction();
        }

        if (date) {
            functions.getDate = getDateFunction();
        }

        if (stocks) {
            functions.getStocks = getStocksFunction();
        }
    }
}
