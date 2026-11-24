import type { FastifyInstance } from 'fastify';
import { AppError, ExternalApiError } from '../../lib/errors';
import { logger } from '../../lib/logger';

/**
 * Traduz o erro para o status HTTP que o Flow Builder do Chatbotify sabe tratar.
 * Falha da Clinicorp é falha de UPSTREAM (502) — mandar 400 faria o agente entender
 * "dado inválido" e reformular a pergunta ao paciente em vez de tentar de novo/handoff.
 */
function statusFor(error: Error): number {
  if (error instanceof ExternalApiError) {
    // 4xx da Clinicorp (ex.: 409 paciente já existe) é informação útil e passa adiante.
    return error.status >= 400 && error.status < 500 && error.status !== 429 ? error.status : 502;
  }
  if (error instanceof AppError) return 400;
  return 500;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _req, reply) => {
    const status = statusFor(error);
    logger.error({ err: error.message, name: error.name, status }, 'unhandled error');
    reply.status(status).send({ error: error.name, message: error.message });
  });
}
