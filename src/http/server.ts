import Fastify, { type FastifyInstance } from 'fastify';
import { getEnv } from '../config/env';
import { registerErrorHandler } from './middleware/errorHandler';
import { registerAgendamentoRoutes, type AgendamentoDeps } from './routes/agendamento';
import { registerCatalogoRoutes } from './routes/catalogo';
import { registerSonaxRoutes, type SonaxRouteDeps } from './routes/sonax';
import { registerAtendimentoRoutes, type AtendimentoDeps } from './routes/atendimento';
import { registerReguasRoutes, type ReguasRouteDeps } from './routes/reguas';

export interface ServerDeps {
  /** Agendamento + catálogo (Clinicorp). Ausente = servidor só com /health e /atendimento/status. */
  scheduling?: AgendamentoDeps;
  /** Webhook do discador Sonax — só registrado quando a integração CRM está configurada. */
  sonax?: SonaxRouteDeps;
  /** Horário comercial consultado pelo Flow Builder. */
  atendimento?: AtendimentoDeps;
  /** Chamadas de volta dos workflows do GHL (hoje: liberar horário sem confirmação). */
  reguas?: ReguasRouteDeps;
}

/** Rotas públicas (sem X-Api-Key). `/webhooks/sonax` autentica por token na URL. */
const OPEN_PATHS = new Set(['/health', '/webhooks/sonax']);

export function buildServer(deps: ServerDeps = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);

  // Proteção X-Api-Key: se API_KEY_SECRET estiver definida, exige o header em todas as rotas
  // exceto as públicas. Se vazia/ausente (local/dev), não há enforcement.
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
    if (OPEN_PATHS.has(path)) return;
    if (req.headers['x-api-key'] !== expected) {
      return reply.status(401).send({ error: 'unauthorized' });
    }
  });

  app.get('/health', async () => ({ status: 'ok' }));

  registerAtendimentoRoutes(app, deps.atendimento);

  if (deps.scheduling) {
    registerAgendamentoRoutes(app, deps.scheduling);
    registerCatalogoRoutes(app, { clinicorp: deps.scheduling.clinicorp });
  }

  if (deps.sonax) {
    registerSonaxRoutes(app, deps.sonax);
  }

  if (deps.reguas) {
    registerReguasRoutes(app, deps.reguas);
  }

  return app;
}
