import { Queue, type ConnectionOptions } from 'bullmq';
import { createRedis } from './connection';

export const QUEUE_NAMES = {
  inbound: 'inbound-messages',
  outbound: 'outbound-dispatch',
} as const;

export function buildQueues(connection = createRedis()) {
  // bullmq bundles its own ioredis internally; cast to satisfy its ConnectionOptions type
  const conn = connection as unknown as ConnectionOptions;
  return {
    inbound: new Queue(QUEUE_NAMES.inbound, { connection: conn }),
    outbound: new Queue(QUEUE_NAMES.outbound, { connection: conn }),
  };
}
