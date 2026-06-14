import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  REDIS_URL: z.string().url(),
  CLINICORP_API_BASE: z.string().url(),
  CLINICORP_API_USER: z.string().min(1),
  CLINICORP_API_TOKEN: z.string().min(1),
  CHATBOTIFY_API_BASE: z.string().url(),
  CHATBOTIFY_API_TOKEN: z.string().min(1),
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
