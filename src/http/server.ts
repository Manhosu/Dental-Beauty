import Fastify, { type FastifyInstance } from 'fastify';
import { getEnv } from '../config/env';
import { registerErrorHandler } from './middleware/errorHandler';
import { handleInbound, type InboundDeps } from './webhooks/chatbotify.route';
import { registerAgendamentoRoutes, type AgendamentoDeps } from './routes/agendamento';
import { registerCatalogoRoutes } from './routes/catalogo';
import { registerSonaxRoutes, type SonaxRouteDeps } from './routes/sonax';

export function buildServer(
  deps: InboundDeps,
  scheduling?: AgendamentoDeps,
  sonax?: SonaxRouteDeps,
): FastifyInstance {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);

  // Proteção X-Api-Key: se API_KEY_SECRET estiver definida, exige o header em todas as rotas
  // exceto /health. Se vazia/ausente (local/dev), não há enforcement.
  app.addHook('preHandler', async (req, reply) => {
    // Lê o segredo sem forçar a validação completa do env (mantém local/dev/testes abertos quando não há env completo).
    let expected: string | undefined;
    try {
      expected = getEnv().API_KEY_SECRET;
    } catch {
      expected = process.env.API_KEY_SECRET;
    }
    if (!expected) return;
    const path = req.url.split('?')[0];
    // /health e o webhook do Sonax não usam X-Api-Key (o Sonax autentica por token na URL).
    if (path === '/health' || path === '/webhooks/sonax') return;
    if (req.headers['x-api-key'] !== expected) {
      return reply.status(401).send({ error: 'unauthorized' });
    }
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/webhooks/chatbotify', async (req, reply) => {
    const result = await handleInbound(req.body, deps);
    if (result.status === 'invalid') return reply.status(400).send(result);
    if (result.status === 'duplicate') return reply.status(200).send(result);
    return reply.status(202).send(result);
  });

  if (scheduling) {
    registerAgendamentoRoutes(app, scheduling);
    registerCatalogoRoutes(app, { clinicorp: scheduling.clinicorp });
  }

  // Webhook do discador Sonax — só registra quando a integração CRM estiver configurada (dormente por padrão).
  if (sonax) {
    registerSonaxRoutes(app, sonax);
  }

  return app;
}
