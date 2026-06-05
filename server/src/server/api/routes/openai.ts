import {randomUUID} from 'crypto';
import {App} from '@tinyhttp/app';
import type {ChatHistoryItem} from 'node-llama-cpp';
import AppDb from '../../../storage/app-db.js';
import createChat, {createEmbedding, rerankDocuments} from '../../../manage-models/bind-class/bind-class.js';

export const openAIRouter = new App();

type OpenAIMessage = {
    role: 'system' | 'user' | 'assistant' | 'developer' | 'tool' | 'function';
    content?: string | Array<{type?: string; text?: string}> | null;
};

type OpenAIChatCompletionRequest = {
    model?: string;
    messages?: OpenAIMessage[];
    prompt?: string;
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    stop?: string | string[];
};

type OpenAICompletionRequest = {
    model?: string;
    prompt?: string | string[];
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    stop?: string | string[];
};

type OpenAIEmbeddingRequest = {
    model?: string;
    input?: string | string[] | Array<number> | Array<Array<number>>;
};

type RerankRequest = {
    model?: string;
    query?: string;
    documents?: string[];
    top_n?: number;
    return_documents?: boolean;
};

const created = Math.floor(Date.now() / 1000);

function getActiveModelName(model?: string) {
    return model || AppDb.db.activeModel || Object.keys(AppDb.db.models)[0] || 'default';
}

function getContentText(content: OpenAIMessage['content']) {
    if (typeof content === 'string')
        return content;

    if (Array.isArray(content))
        return content.map(part => part.text ?? '').join('');

    return '';
}

function getPromptFromMessages(messages: OpenAIMessage[] = []) {
    const history: ChatHistoryItem[] = [];
    let prompt = '';

    for (const message of messages) {
        const text = getContentText(message.content);
        if (!text)
            continue;

        if (message.role === 'assistant') {
            history.push({type: 'model', response: [text]});
        } else if (message.role === 'system' || message.role === 'developer') {
            history.push({type: 'system', text});
        } else {
            if (prompt) {
                history.push({type: 'user', text: prompt});
            }
            prompt = text;
        }
    }

    return {history, prompt};
}

function getPromptText(prompt: OpenAICompletionRequest['prompt']) {
    if (Array.isArray(prompt))
        return prompt.join('\n');

    return prompt ?? '';
}

function toLlamaOptions(request: OpenAIChatCompletionRequest | OpenAICompletionRequest) {
    return {
        maxTokens: request.max_tokens,
        temperature: request.temperature,
        topP: request.top_p,
        stopOnWords: typeof request.stop === 'string' ? [request.stop] : request.stop,
    };
}

function writeOpenAIError(res: any, error: any, status = 500) {
    res.status(status).json({
        error: {
            message: error instanceof Error ? error.message : String(error),
            type: 'server_error',
            code: null,
            param: null,
        }
    });
}

function writeSSE(res: any, payload: unknown) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function usage(prompt: string, completion = '') {
    const promptTokens = prompt.length ? prompt.trim().split(/\s+/).length : 0;
    const completionTokens = completion.length ? completion.trim().split(/\s+/).length : 0;

    return {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
    };
}

openAIRouter.get('/models', (_req, res) => {
    res.json({
        object: 'list',
        data: Object.keys(AppDb.db.models).map(model => ({
            id: model,
            object: 'model',
            created,
            owned_by: 'catai',
        })),
    });
});

openAIRouter.post('/chat/completions', async (req, res) => {
    const body = req.body as OpenAIChatCompletionRequest;
    const model = getActiveModelName(body.model);
    const id = `chatcmpl-${randomUUID()}`;
    const {history, prompt} = getPromptFromMessages(body.messages);

    if (!prompt) {
        writeOpenAIError(res, new Error('messages must include a user message'), 400);
        return;
    }

    try {
        const chat = await createChat({model, ...toLlamaOptions(body)} as any);
        chat.setChatHistory(history);

        req.once('close', () => chat.abort());

        if (body.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            await chat.prompt(prompt, token => writeSSE(res, {
                id,
                object: 'chat.completion.chunk',
                created,
                model,
                choices: [{index: 0, delta: {content: token.toString()}, finish_reason: null}],
            }));

            writeSSE(res, {
                id,
                object: 'chat.completion.chunk',
                created,
                model,
                choices: [{index: 0, delta: {}, finish_reason: 'stop'}],
            });
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }

        const content = await chat.prompt(prompt) ?? '';
        res.json({
            id,
            object: 'chat.completion',
            created,
            model,
            choices: [{
                index: 0,
                message: {role: 'assistant', content},
                finish_reason: 'stop',
            }],
            usage: usage(prompt, content),
        });
    } catch (error) {
        writeOpenAIError(res, error);
    }
});

openAIRouter.post('/completions', async (req, res) => {
    const body = req.body as OpenAICompletionRequest;
    const model = getActiveModelName(body.model);
    const id = `cmpl-${randomUUID()}`;
    const prompt = getPromptText(body.prompt);

    if (!prompt) {
        writeOpenAIError(res, new Error('prompt is required'), 400);
        return;
    }

    try {
        const chat = await createChat({model, ...toLlamaOptions(body)} as any);
        req.once('close', () => chat.abort());

        if (body.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            await chat.complete(prompt, token => writeSSE(res, {
                id,
                object: 'text_completion',
                created,
                model,
                choices: [{index: 0, text: token.toString(), finish_reason: null}],
            }));

            writeSSE(res, {
                id,
                object: 'text_completion',
                created,
                model,
                choices: [{index: 0, text: '', finish_reason: 'stop'}],
            });
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }

        const text = await chat.complete(prompt) ?? '';
        res.json({
            id,
            object: 'text_completion',
            created,
            model,
            choices: [{index: 0, text, finish_reason: 'stop'}],
            usage: usage(prompt, text),
        });
    } catch (error) {
        writeOpenAIError(res, error);
    }
});

openAIRouter.post('/embeddings', async (req, res) => {
    const body = req.body as OpenAIEmbeddingRequest;
    const model = getActiveModelName(body.model);
    const input = body.input;

    if (input == null) {
        writeOpenAIError(res, new Error('input is required'), 400);
        return;
    }

    if (typeof input !== 'string' && (!Array.isArray(input) || input.some(item => typeof item !== 'string'))) {
        writeOpenAIError(res, new Error('input must be a string or array of strings'), 400);
        return;
    }

    const inputs: string[] = typeof input === 'string' ? [input] : input as string[];

    try {
        const embeddings = await createEmbedding(inputs, {model} as any);
        res.json({
            object: 'list',
            model,
            data: embeddings.map((embedding, index) => ({
                object: 'embedding',
                index,
                embedding,
            })),
            usage: {
                prompt_tokens: inputs.reduce((total, item) => total + usage(item).prompt_tokens, 0),
                total_tokens: inputs.reduce((total, item) => total + usage(item).prompt_tokens, 0),
            },
        });
    } catch (error) {
        writeOpenAIError(res, error);
    }
});

openAIRouter.post('/rerank', async (req, res) => {
    const body = req.body as RerankRequest;
    const model = getActiveModelName(body.model);

    if (!body.query || !Array.isArray(body.documents)) {
        writeOpenAIError(res, new Error('query and documents are required'), 400);
        return;
    }

    try {
        let results = await rerankDocuments(body.query, body.documents, {model} as any);
        results = results.sort((a, b) => b.relevance_score - a.relevance_score);

        if (typeof body.top_n === 'number')
            results = results.slice(0, body.top_n);

        res.json({
            id: `rerank-${randomUUID()}`,
            object: 'list',
            model,
            results: results.map(result => ({
                index: result.index,
                relevance_score: result.relevance_score,
                ...(body.return_documents ? {document: {text: body.documents![result.index]}} : {}),
            })),
            usage: {
                total_tokens: usage([body.query, ...body.documents].join(' ')).prompt_tokens,
            },
        });
    } catch (error) {
        writeOpenAIError(res, error);
    }
});
