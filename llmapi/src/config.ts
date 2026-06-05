import path from 'node:path';
import os from 'node:os';

export const config = {
  port: Number(process.env.LLMAPI_PORT) || 3000,
  dir: process.env.LLMAPI_DIR || path.join(os.homedir(), '.llmapi'),
  modelPath: process.env.MODEL_PATH || path.join(process.cwd(), 'models'),
  modelIndex: process.env.LLMAPI_MODEL_INDEX ?? '',
};
