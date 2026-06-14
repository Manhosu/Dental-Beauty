import { describe, it, expect } from 'vitest';
import { parseEnv } from '../../src/config/env';

const base = {
  NODE_ENV: 'test',
  PORT: '3000',
  REDIS_URL: 'redis://localhost:6379',
  CLINICORP_API_BASE: 'https://sistema.clinicorp.com',
  CLINICORP_API_USER: 'user',
  CLINICORP_API_TOKEN: 'token',
  CHATBOTIFY_API_BASE: 'https://api.chatbotify.example',
  CHATBOTIFY_API_TOKEN: 'cb-token',
};

describe('parseEnv', () => {
  it('valida e tipa as variáveis', () => {
    const env = parseEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('test');
  });

  it('falha quando falta segredo obrigatório', () => {
    const { CLINICORP_API_TOKEN, ...partial } = base;
    expect(() => parseEnv(partial)).toThrow();
  });
});
