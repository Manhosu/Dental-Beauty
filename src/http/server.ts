import Fastify, { type FastifyInstance } from 'fastify';
import { registerErrorHandler } from './middleware/errorHandler';
import { handleInbound, type InboundDeps } from './webhooks/chatbotify.route';

export function buildServer(deps: InboundDeps): FastifyInstance {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/webhooks/chatbotify', async (req, reply) => {
    const result = await handleInbound(req.body, deps);
    if (result.status === 'invalid') return reply.status(400).send(result);
    if (result.status === 'duplicate') return reply.status(200).send(result);
    return reply.status(202).send(result);
  });

  return app;
}
