import type { FastifyInstance } from 'fastify';
import { logger } from '../../lib/logger';
import {
  sonaxQuerySchema,
  normalizeSonaxEvent,
  handleSonaxCall,
  type SonaxCrmPort,
} from '../../integrations/sonax/sonax';

export interface SonaxRouteDeps {
  crm: SonaxCrmPort;
  /** Token compartilhado esperado na query (?token=...). Se ausente, não valida (dev). */
  token?: string;
}

/**
 * GET /webhooks/sonax — recebido do discador Sonax nos eventos de atendimento/desligamento.
 * Autentica por `token` na URL (não por X-Api-Key, pois o Sonax só envia query params).
 * Sempre responde 200 (mesmo em falha de processamento) para não gerar retry-storm no discador;
 * falhas ficam no log.
 */
export function registerSonaxRoutes(app: FastifyInstance, deps: SonaxRouteDeps): void {
  app.get('/webhooks/sonax', async (req, reply) => {
    const parsed = sonaxQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'invalid', issues: parsed.error.issues });
    }
    if (deps.token && parsed.data.token !== deps.token) {
      return reply.status(401).send({ ok: false, error: 'unauthorized' });
    }

    const event = normalizeSonaxEvent(parsed.data);
    try {
      const result = await handleSonaxCall(event, deps.crm);
      return reply.status(200).send({ ok: true, phase: event.phase, ...result });
    } catch (err) {
      logger.error({ err, callId: event.callId, phone: event.phone }, 'falha ao processar webhook Sonax');
      return reply.status(200).send({ ok: false, error: 'processing_failed' });
    }
  });
}
