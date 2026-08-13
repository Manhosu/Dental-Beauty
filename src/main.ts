import { Redis } from 'ioredis';
import { businessHoursFromEnv, getEnv } from './config/env';
import { SlotLock } from './scheduling/lock';
import { createLockRedis } from './scheduling/redisLock';
import { SchedulingEngine } from './scheduling/schedulingEngine';
import { HttpClinicorpClient } from './integrations/clinicorp/client';
import { ChatbotifyCrmClient } from './integrations/chatbotify/crmClient';
import { buildServer } from './http/server';
import { createHttpDispatcher, type ReguaWebhookConfig } from './scheduling/reguas/dispatcher';
import { isoDate, startReguas } from './scheduling/reguas/cronEngine';
import { createRedisSentRegistry, withDedupe } from './scheduling/reguas/dedupe';
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

  // Integração do discador Sonax (webhook → CRM Chatbotify). Só liga quando as credenciais da API
  // do Chatbotify estiverem configuradas; caso contrário fica dormente.
  const sonaxDeps =
    env.CHATBOTIFY_CRM_ACCOUNT_ID && env.CHATBOTIFY_CRM_API_TOKEN
      ? {
          crm: new ChatbotifyCrmClient({
            baseUrl: env.CHATBOTIFY_CRM_API_BASE,
            accountId: env.CHATBOTIFY_CRM_ACCOUNT_ID,
            apiToken: env.CHATBOTIFY_CRM_API_TOKEN,
          }),
          ...(env.SONAX_WEBHOOK_TOKEN ? { token: env.SONAX_WEBHOOK_TOKEN } : {}),
        }
      : undefined;

  const businessHours = businessHoursFromEnv(env);
  const app = buildServer({
    scheduling: { engine, clinicorp },
    ...(sonaxDeps ? { sonax: sonaxDeps } : {}),
    atendimento: { businessHours },
  });

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
    // Conta de CAMPANHA (Disparos): aniversário, retorno pós-procedimento e reengajamento.
    const campanha: Omit<ReguaWebhookConfig, 'flow'> = {
      url: env.CHATBOTIFY_REGUA_WEBHOOK_URL,
      accountId: env.CHATBOTIFY_REGUA_ACCOUNT_ID,
      token: env.CHATBOTIFY_REGUA_TOKEN,
    };

    // Conta da RECEPÇÃO: lembrete/confirmação de consulta e NPS (templates Utility) — decisão do
    // cliente. Sem a config própria, cai na conta de campanha (comportamento anterior).
    const recepcao: Omit<ReguaWebhookConfig, 'flow'> =
      env.CHATBOTIFY_REGUA_RECEPCAO_WEBHOOK_URL &&
      env.CHATBOTIFY_REGUA_RECEPCAO_ACCOUNT_ID &&
      env.CHATBOTIFY_REGUA_RECEPCAO_TOKEN
        ? {
            url: env.CHATBOTIFY_REGUA_RECEPCAO_WEBHOOK_URL,
            accountId: env.CHATBOTIFY_REGUA_RECEPCAO_ACCOUNT_ID,
            token: env.CHATBOTIFY_REGUA_RECEPCAO_TOKEN,
          }
        : campanha;

    // Trava anti-duplicidade compartilhada (Redis) — sobrevive a restart do processo.
    const sentRegistry = createRedisSentRegistry(redis);
    const guarded = (cfg: ReguaWebhookConfig): ReturnType<typeof createHttpDispatcher> =>
      withDedupe(createHttpDispatcher(cfg), sentRegistry, () => isoDate(new Date()));

    const dispatchers = {
      aniversario: guarded({ ...campanha, flow: env.CHATBOTIFY_REGUA_FLOW }),
      // No-show só liga quando o 2º fluxo (mensagem de lembrete) existir. Sai pela Recepção.
      ...(env.CHATBOTIFY_REGUA_FLOW_NOSHOW
        ? { noShow: guarded({ ...recepcao, flow: env.CHATBOTIFY_REGUA_FLOW_NOSHOW }) }
        : {}),
      // Pós-procedimento (retorno) só liga quando o 3º fluxo existir.
      ...(env.CHATBOTIFY_REGUA_FLOW_POSPROC
        ? { posProcedimento: guarded({ ...campanha, flow: env.CHATBOTIFY_REGUA_FLOW_POSPROC }) }
        : {}),
      // NPS pós-consulta só liga quando o fluxo de pesquisa existir. Sai pela Recepção.
      ...(env.CHATBOTIFY_REGUA_FLOW_NPS
        ? { nps: guarded({ ...recepcao, flow: env.CHATBOTIFY_REGUA_FLOW_NPS }) }
        : {}),
      // Reengajamento por inatividade (6/12 meses) só liga quando o fluxo existir.
      ...(env.CHATBOTIFY_REGUA_FLOW_INATIVIDADE
        ? { inatividade: guarded({ ...campanha, flow: env.CHATBOTIFY_REGUA_FLOW_INATIVIDADE }) }
        : {}),
    };

    // Reivindica a execução do dia no Redis — com o catch-up do boot, garante 1 rodada por dia
    // mesmo que o serviço reinicie ou hiberne em cima do horário.
    startReguas({
      clinicorp,
      dispatchers,
      claimDailyRun: (dateIso) => sentRegistry.claim(`regua:run:${dateIso}`, 172_800),
    });
    logger.info(
      {
        noShow: !!env.CHATBOTIFY_REGUA_FLOW_NOSHOW,
        posProcedimento: !!env.CHATBOTIFY_REGUA_FLOW_POSPROC,
        nps: !!env.CHATBOTIFY_REGUA_FLOW_NPS,
        inatividade: !!env.CHATBOTIFY_REGUA_FLOW_INATIVIDADE,
        contaRecepcaoSeparada: recepcao !== campanha,
      },
      'réguas (cron-engine) ativadas',
    );
  }
}

main().catch((err) => {
  logger.error({ err }, 'erro fatal na inicialização');
  process.exit(1);
});
