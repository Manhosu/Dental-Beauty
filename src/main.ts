import { Redis } from 'ioredis';
import { getEnv } from './config/env';
import { SlotLock } from './scheduling/lock';
import { createLockRedis } from './scheduling/redisLock';
import { SchedulingEngine } from './scheduling/schedulingEngine';
import { HttpClinicorpClient } from './integrations/clinicorp/client';
import { buildServer } from './http/server';
import type { InboundDeps } from './http/webhooks/chatbotify.route';
import { createHttpDispatcher } from './scheduling/reguas/dispatcher';
import { startReguas } from './scheduling/reguas/cronEngine';
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
    accessCodeParam: env.CLINICORP_ACCESS_CODE_PARAM,
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

  // Cron-Engine das réguas (§3.4) — só liga se habilitado e com a config completa do fluxo de disparo.
  if (
    env.REGUAS_ENABLED &&
    env.CHATBOTIFY_REGUA_WEBHOOK_URL &&
    env.CHATBOTIFY_REGUA_ACCOUNT_ID &&
    env.CHATBOTIFY_REGUA_TOKEN &&
    env.CHATBOTIFY_REGUA_FLOW
  ) {
    const dispatch = createHttpDispatcher({
      url: env.CHATBOTIFY_REGUA_WEBHOOK_URL,
      accountId: env.CHATBOTIFY_REGUA_ACCOUNT_ID,
      token: env.CHATBOTIFY_REGUA_TOKEN,
      flow: env.CHATBOTIFY_REGUA_FLOW,
    });
    startReguas({ clinicorp, dispatch });
    logger.info('réguas (cron-engine) ativadas');
  }
}

main().catch((err) => {
  logger.error({ err }, 'erro fatal na inicialização');
  process.exit(1);
});
