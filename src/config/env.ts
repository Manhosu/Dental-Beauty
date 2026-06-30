import { z } from 'zod';

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
  CHATBOTIFY_REGUA_FLOW: z.string().optional(), // id do fluxo de ANIVERSÁRIO
  CHATBOTIFY_REGUA_FLOW_NOSHOW: z.string().optional(), // id do fluxo de NO-SHOW (2º fluxo)
  CHATBOTIFY_REGUA_FLOW_POSPROC: z.string().optional(), // id do fluxo de PÓS-PROCEDIMENTO (retorno)
});

export type Env = z.infer<typeof envSchema>;

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
