import { Worker, type ConnectionOptions } from 'bullmq';
import type { InboundMessage } from '../http/webhooks/chatbotify.schema';
import { NumberRegistry, type WhatsappRole } from '../domain/numberRegistry';
import { QUEUE_NAMES } from './queues';
import { createRedis } from './connection';
import { logger } from '../lib/logger';

export interface ProcessDeps {
  registry: NumberRegistry;
  onRole: Record<WhatsappRole, (msg: InboundMessage) => Promise<void>>;
}

export async function processInbound(msg: InboundMessage, deps: ProcessDeps): Promise<void> {
  const role = deps.registry.roleFor(msg.to);
  if (!role) {
    logger.warn({ to: msg.to }, 'numero de destino sem papel mapeado');
    return;
  }
  await deps.onRole[role](msg);
}

export function startInboundWorker(deps: ProcessDeps): Worker {
  return new Worker(
    QUEUE_NAMES.inbound,
    async (job) => processInbound(job.data as InboundMessage, deps),
    { connection: createRedis() as unknown as ConnectionOptions },
  );
}
