import { Redis } from 'ioredis';
import { getEnv } from './config/env';
import { SlotLock } from './scheduling/lock';
import { createLockRedis } from './scheduling/redisLock';
import { SchedulingEngine } from './scheduling/schedulingEngine';
import { HttpClinicorpClient } from './integrations/clinicorp/client';
import { buildServer } from './http/server';
import type { InboundDeps } from './http/webhooks/chatbotify.route';
import { logger } from './lib/logger';

async function main(): Promise<void> {
  const env = getEnv();

  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const lock = new SlotLock(createLockRedis(redis));

  const clinicorp = new HttpClinicorpClient({
    baseUrl: env.CLINICORP_API_BASE,
    user: env.CLINICORP_API_USER,
    token: env.CLINICORP_API_TOKEN,
    subscriberId: env.CLINICORP_SUBSCRIBER_ID,
    businessId: env.CLINICORP_BUSINESS_ID,
    accessCode: env.CLINICORP_ACCESS_CODE,
  });

  const engine = new SchedulingEngine(clinicorp, lock);

  // Minimal no-op InboundDeps stub — webhook processing is handled by the worker process.
  const inboundDeps: InboundDeps = {
    enqueue: async () => {},
    idempotency: {
      alreadyProcessed: async () => false,
      markProcessed: async () => {},
    },
  };

  const app = buildServer(inboundDeps, { engine, clinicorp });

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ port: env.PORT }, 'servidor iniciado');
}

main().catch((err) => {
  logger.error({ err }, 'erro fatal na inicialização');
  process.exit(1);
});
