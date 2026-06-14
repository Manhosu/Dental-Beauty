import type { FastifyInstance } from 'fastify';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _req, reply) => {
    logger.error({ err: error.message, name: error.name }, 'unhandled error');
    const status = error instanceof AppError ? 400 : 500;
    reply.status(status).send({ error: error.name, message: error.message });
  });
}
