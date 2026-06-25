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
