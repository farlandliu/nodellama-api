import {App} from '@tinyhttp/app';
import {adminRouter} from './routes/admin.js';
import {chatRouter} from './routes/chat.js';
import {openAIRouter} from './routes/openai.js';

export const apiRouter =  new App();

apiRouter.use("/admin", adminRouter);
apiRouter.use("/chat", chatRouter as any);
apiRouter.use("/v1", openAIRouter as any);
