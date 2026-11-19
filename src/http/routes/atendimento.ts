import type { FastifyInstance } from 'fastify';
import {
  attendanceStatus,
  DEFAULT_BUSINESS_HOURS,
  type BusinessHoursConfig,
} from '../../domain/businessHours';

export interface AtendimentoDeps {
  businessHours?: BusinessHoursConfig;
  /** Injetável nos testes. */
  now?: () => Date;
}

/**
 * `GET /atendimento/status` — consultado pelo Flow Builder do Chatbotify antes de deixar o agente
 * responder. Dentro do expediente a recepção humana atende (`attendant: 'recepcao'`) e o fluxo deve
 * desligar o agente com o bloco `Controle de Agente`; fora dele, a IA assume.
 * Réguas e follow-ups não consultam esta rota — rodam sempre.
 */
export function registerAtendimentoRoutes(app: FastifyInstance, deps: AtendimentoDeps = {}): void {
  const cfg = deps.businessHours ?? DEFAULT_BUSINESS_HOURS;
  const now = deps.now ?? ((): Date => new Date());

  app.get('/atendimento/status', async (_req, reply) => {
    return reply.status(200).send({
      ...attendanceStatus(now(), cfg),
      horario: { inicio: cfg.start, fim: cfg.end, dias: cfg.days },
    });
  });
}
