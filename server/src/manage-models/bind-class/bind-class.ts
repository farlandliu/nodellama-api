import BaseBindClass, {CreateChatOptions, EmbeddingOptions, RerankResult} from './binds/base-bind-class.js';
import AppDb, {ModelSettings} from '../../storage/app-db.js';
import NodeLlamaCppV2 from './binds/node-llama-cpp/node-llama-cpp-v2/node-llama-cpp-v2.js';
import {withLock} from 'lifecycle-utils';
import {ModelNotInstalledError} from './errors/ModelNotInstalledError.js';
import {NoActiveModelError} from './errors/NoActiveModelError.js';
import {NoModelBindError} from './errors/NoModelBindError.js';
import {BindNotFoundError} from './errors/BindNotFoundError.js';
import {ChatContext} from './chat-context.js';
import type {LLamaChatPromptOptions} from 'node-llama-cpp';

export const ALL_BINDS = [NodeLlamaCppV2];
const cachedBinds: { [key: string]: InstanceType<typeof BaseBindClass> } = {};

function getBindCacheKey(modelDetails: ModelSettings<any>) {
    return `${modelDetails.settings.bind}:${modelDetails.downloadedFiles?.model ?? ''}`;
}

export function findLocalModel(modelName?: string) {
    const modelDetails = AppDb.db.models[modelName || AppDb.db.activeModel!];

    if (!modelDetails) {
        if (modelName) {
            throw new ModelNotInstalledError(`Model ${modelName} not installed`);
        }
        throw new NoActiveModelError('No active model');
    }


    if (!modelDetails.settings.bind)
        throw new NoModelBindError('No bind class');

    return modelDetails;
}

export function getCacheBindClass(modelDetails: ModelSettings<any> = findLocalModel()) {
    const bindCacheKey = getBindCacheKey(modelDetails);

    if (cachedBinds[bindCacheKey])
        return cachedBinds[bindCacheKey];

    return null;
}

const lockContext = {};

export async function getOrCreateBind(options?: {model?: string}) {
    return await withLock(lockContext, "createBind", async () => {
        const modelDetails = findLocalModel(options?.model);
        const cachedBindClass = getCacheBindClass(modelDetails);

        if (cachedBindClass)
            return cachedBindClass;

        const bind = modelDetails.settings.bind;

        const bindClass = ALL_BINDS.find(x => x.shortName === bind);
        if (!bindClass)
            throw new BindNotFoundError(`Bind class "${bind}" not found. Try to update the model/Catai`);

        const bindClassInstance = cachedBinds[getBindCacheKey(modelDetails)] ??= new bindClass(modelDetails);
        await bindClassInstance.initialize();
        return bindClassInstance;
    });
}

export async function createEmbedding(input: string[], options?: EmbeddingOptions): Promise<number[][]> {
    const bindClassInstance = await getOrCreateBind(options);
    return await bindClassInstance.createEmbedding(input, options);
}

export async function rerankDocuments(query: string, documents: string[], options?: EmbeddingOptions): Promise<RerankResult[]> {
    const bindClassInstance = await getOrCreateBind(options);
    return await bindClassInstance.rerank(query, documents, options);
}

export default async function createChat(options?: CreateChatOptions): Promise<ChatContext<LLamaChatPromptOptions>> {
    return await withLock(lockContext, "createChat", async () => {
        const modelDetails = findLocalModel(options?.model);
        const cachedBindClass = getCacheBindClass(modelDetails);

        if (cachedBindClass)
            return await cachedBindClass.createChat(options);

        const bind = modelDetails.settings.bind;

        const bindClass = ALL_BINDS.find(x => x.shortName === bind);
        if (!bindClass)
            throw new BindNotFoundError(`Bind class "${bind}" not found. Try to update the model/Catai`);

        const bindClassInstance = cachedBinds[getBindCacheKey(modelDetails)] ??= new bindClass(modelDetails);
        await bindClassInstance.initialize();
        return await bindClassInstance.createChat(options);
    });
}

export function getModelPath(name: string) {
    return findLocalModel(name).downloadedFiles?.model;
}
