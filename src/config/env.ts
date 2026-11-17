import { z } from 'zod';
import {
  DEFAULT_BUSINESS_HOURS,
  parseWeekdays,
  type BusinessHoursConfig,
} from '../domain/businessHours';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  REDIS_URL: z.string().url(),
  CLINICORP_API_BASE: z.string().url(),
  CLINICORP_API_USER: z.string().min(1),
  CLINICORP_API_TOKEN: z.string().min(1),
  CLINICORP_SUBSCRIBER_ID: z.string().min(1),
  CLINICORP_BUSINESS_ID: z.coerce.number().int().positive(),
  CLINICORP_ACCESS_CODE: z.string().optional(),
  CLINICORP_ACCESS_CODE_PARAM: z.string().optional(),
  // Chatbotify é opcional no microserviço (Arquitetura C: a plataforma chama a gente).
  CHATBOTIFY_API_BASE: z.string().url().optional().or(z.literal('')),
  CHATBOTIFY_API_TOKEN: z.string().optional(),
  // Chave compartilhada com o Flow Builder (header X-Api-Key). Opcional: se vazia, não há enforcement.
  API_KEY_SECRET: z.string().optional(),
  // Réguas (Cron-Engine §3.4) — dormentes por padrão. Liguem com REGUAS_ENABLED=true + a config do fluxo.
  REGUAS_ENABLED: z.string().optional().transform((v) => v === 'true'),
  // Fluxo "Gatilho HTTP" do Chatbotify (aniversário): URL + headers id/token/flow (ver painel do bloco).
  CHATBOTIFY_REGUA_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  CHATBOTIFY_REGUA_ACCOUNT_ID: z.string().optional(),
  CHATBOTIFY_REGUA_TOKEN: z.string().optional(),
  // Conta da RECEPÇÃO — decisão do cliente (2026-08): confirmação/lembrete de consulta e NPS saem
  // pelo número da Recepção (templates Utility); campanhas (aniversário/retorno/reengajamento)
  // continuam saindo pelo Disparos. Se estas 3 ficarem vazias, tudo sai pela conta padrão acima.
  CHATBOTIFY_REGUA_RECEPCAO_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  CHATBOTIFY_REGUA_RECEPCAO_ACCOUNT_ID: z.string().optional(),
  CHATBOTIFY_REGUA_RECEPCAO_TOKEN: z.string().optional(),
  CHATBOTIFY_REGUA_FLOW: z.string().optional(), // id do fluxo de ANIVERSÁRIO
  CHATBOTIFY_REGUA_FLOW_NOSHOW: z.string().optional(), // id do fluxo de NO-SHOW (2º fluxo)
  CHATBOTIFY_REGUA_FLOW_POSPROC: z.string().optional(), // id do fluxo de PÓS-PROCEDIMENTO (retorno)
  CHATBOTIFY_REGUA_FLOW_NPS: z.string().optional(), // id do fluxo de NPS pós-consulta (pesquisa 0-10)
  CHATBOTIFY_REGUA_FLOW_INATIVIDADE: z.string().optional(), // id do fluxo de reengajamento (6/12 meses)
  // Integração do discador Sonax → API CRM do Chatbotify (dormente até configurar as 3 vars abaixo).
  CHATBOTIFY_CRM_API_BASE: z
    .string()
    .url()
    .optional()
    .or(z.literal(''))
    .default('https://webhook.chatbotify.com.br/webhook/api_chatbotify'),
  CHATBOTIFY_CRM_ACCOUNT_ID: z.string().optional(), // header `id` (UUID da conta WhatsApp)
  CHATBOTIFY_CRM_API_TOKEN: z.string().optional(), // header `api_token`
  // Token compartilhado que vai na URL do webhook configurada no painel Sonax (?token=...).
  SONAX_WEBHOOK_TOKEN: z.string().optional(),
  // ── GoHighLevel (plataforma nova, migração 2026-08) ────────────────────────────────────────
  // Enquanto as duas plataformas coexistem, o GHL só entra em ação quando estas vars existirem.
  GHL_API_BASE: z.string().url().optional().or(z.literal('')).default('https://services.leadconnectorhq.com'),
  GHL_API_VERSION: z.string().optional().default('2021-07-28'),
  GHL_LOCATION_ID: z.string().optional(),
  GHL_PRIVATE_TOKEN: z.string().optional(), // Private Integration (pit-...)
  // Ids dos campos personalizados usados pelas réguas (ver docs/ghl-custom-fields.json). Não são
  // segredo: identificam campos dentro da location. Sem eles as réguas do GHL ficam dormentes.
  GHL_FIELD_TRILHA: z.string().optional(),
  GHL_FIELD_NOME_CRIANCA: z.string().optional(),
  GHL_FIELD_ULTIMO_PROCEDIMENTO: z.string().optional(),
  GHL_FIELD_UNIDADE: z.string().optional(),
  GHL_FIELD_REGUA_DIA: z.string().optional(),
  GHL_FIELD_REGUA_HORA: z.string().optional(),
  // ── Anamnese online do OdontoBI (integração 17/11/2026) ────────────────────────────────────
  // D-2 da primeira avaliação a régua cria o link da ficha de saúde e manda; D-1 confere se o
  // paciente respondeu e, se não, lembra uma vez. Sem o segredo a régua fica dormente.
  // O segredo é credencial: vive só no .env (gitignored) e nunca entra em log, código de browser
  // ou mensagem. Se vazar, a clínica troca o valor no servidor do OdontoBI.
  ANAMNESE_API_BASE: z.string().url().optional().or(z.literal('')).default('https://odontobi.onrender.com'),
  ANAMNESE_SECRET: z.string().optional(),
  // Horário comercial da recepção (decisão do cliente 2026-08): dentro dele a recepção atende e a
  // IA de conversa fica calada; fora dele a IA assume. Réguas/follow-ups rodam sempre.
  BUSINESS_HOURS_START: z.string().optional(), // 'HH:mm' (default 09:00)
  BUSINESS_HOURS_END: z.string().optional(), // 'HH:mm', exclusivo (default 18:00)
  BUSINESS_HOURS_DAYS: z.string().optional(), // '1,2,3,4,5' (0=Dom..6=Sáb; default seg–sex)
  BUSINESS_HOURS_TZ_OFFSET: z.coerce.number().optional(), // horas (default -3 = BRT)
});

export type Env = z.infer<typeof envSchema>;

/** Config de horário comercial a partir do env, caindo no default quando não informada. */
export function businessHoursFromEnv(env: Env): BusinessHoursConfig {
  return {
    start: env.BUSINESS_HOURS_START || DEFAULT_BUSINESS_HOURS.start,
    end: env.BUSINESS_HOURS_END || DEFAULT_BUSINESS_HOURS.end,
    days: parseWeekdays(env.BUSINESS_HOURS_DAYS, DEFAULT_BUSINESS_HOURS.days),
    tzOffsetHours: env.BUSINESS_HOURS_TZ_OFFSET ?? DEFAULT_BUSINESS_HOURS.tzOffsetHours,
  };
}

export function parseEnv(source: NodeJS.ProcessEnv | Record<string, unknown> = process.env): Env {
  return envSchema.parse(source);
}

let _env: Env | undefined;
export function getEnv(): Env {
  if (!_env) _env = parseEnv();
  return _env;
}

// Limpa o singleton (usado em testes que manipulam process.env).
export function resetEnv(): void {
  _env = undefined;
}
