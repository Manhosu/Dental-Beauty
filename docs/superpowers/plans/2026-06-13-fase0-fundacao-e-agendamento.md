# Fase 0 (Fundação & Spikes) + Núcleo do Motor de Agendamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montar a fundação do serviço (config, logging LGPD, resiliência, validação de webhooks, esqueleto Fastify+worker, roteamento multi-número), executar os spikes que mapeiam as APIs reais, e implementar a lógica de agendamento síncrono com lock atômico contra uma interface `ClinicorpClient` testável.

**Architecture:** Serviço Fastify (TypeScript) recebe webhooks e enfileira; worker BullMQ/Redis processa. Lock atômico em Redis (`SET NX`) mitiga double-booking. A lógica de negócio é testada contra interfaces (fakes), e a implementação HTTP dos clients fica para um plano seguinte, após os spikes revelarem os contratos reais.

**Tech Stack:** Node 20+, TypeScript, Vitest, Fastify, Zod, pino (com redaction LGPD), BullMQ, ioredis.

---

## Estrutura de arquivos (criada ao longo do plano)

```
package.json · tsconfig.json · vitest.config.ts · eslint.config.js · .env.example · .prettierrc
src/
  config/env.ts                 # env validado por Zod
  lib/errors.ts                 # classes de erro + classificação retryable/fatal
  lib/logger.ts                 # pino + máscara LGPD (telefone, CPF, nome)
  lib/retry.ts                  # backoff exponencial com jitter
  domain/numberRegistry.ts      # mapa número↔papel
  http/server.ts                # factory do app Fastify
  http/middleware/errorHandler.ts
  http/webhooks/chatbotify.schema.ts   # Zod do payload de entrada
  http/webhooks/chatbotify.route.ts    # rota + idempotência + enqueue
  queue/connection.ts           # conexão Redis/BullMQ
  queue/queues.ts               # definição das filas
  queue/worker.ts               # bootstrap do worker
  integrations/clinicorp/types.ts      # interface ClinicorpClient + tipos de domínio
  integrations/chatbotify/types.ts     # interface ChatbotifyClient
  scheduling/lock.ts            # lock atômico Redis
  scheduling/schedulingEngine.ts       # disponibilidade + lock + confirmação
tests/  (espelha src/)
docs/superpowers/spikes/        # entregáveis dos spikes
```

---

## Task 1: Bootstrap do projeto (TypeScript + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.prettierrc`, `eslint.config.js`, `src/index.ts`, `tests/smoke.test.ts`

- [ ] **Step 1: Escrever o teste de fumaça**

```ts
// tests/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('roda o ambiente de testes', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Criar `package.json`**

```json
{
  "name": "dental-beauty-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "dependencies": {
    "fastify": "^4.28.1",
    "zod": "^3.23.8",
    "pino": "^9.3.2",
    "bullmq": "^5.12.0",
    "ioredis": "^5.4.1"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "vitest": "^2.0.5",
    "@types/node": "^20.14.0",
    "eslint": "^9.9.0",
    "typescript-eslint": "^8.1.0",
    "prettier": "^3.3.3"
  }
}
```

- [ ] **Step 3: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Criar configs auxiliares**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
```

```json
// .prettierrc
{ "singleQuote": true, "semi": true, "trailingComma": "all", "printWidth": 100 }
```

```js
// eslint.config.js
import tseslint from 'typescript-eslint';
export default tseslint.config(...tseslint.configs.recommended, {
  ignores: ['dist', 'node_modules'],
});
```

```ts
// src/index.ts
export const APP_NAME = 'dental-beauty-agent';
```

- [ ] **Step 5: Instalar e rodar o teste**

Run: `npm install && npm test`
Expected: 1 teste PASS (smoke).

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .prettierrc eslint.config.js src tests
git commit -m "chore: bootstrap typescript + vitest"
```

---

## Task 2: Configuração de ambiente validada por Zod

**Files:**
- Create: `src/config/env.ts`, `.env.example`, `tests/config/env.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
// tests/config/env.test.ts
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
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npx vitest run tests/config/env.test.ts`
Expected: FAIL (`parseEnv` não existe).

- [ ] **Step 3: Implementar**

```ts
// src/config/env.ts
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

export const env: Env = parseEnv();
```

- [ ] **Step 4: Criar `.env.example`** (sem valores reais — segredos vão no `.env`, que é gitignored)

```bash
NODE_ENV=development
PORT=3000
REDIS_URL=redis://localhost:6379
CLINICORP_API_BASE=https://sistema.clinicorp.com
CLINICORP_API_USER=
CLINICORP_API_TOKEN=
CHATBOTIFY_API_BASE=
CHATBOTIFY_API_TOKEN=
```

- [ ] **Step 5: Rodar — deve passar**

Run: `npx vitest run tests/config/env.test.ts`
Expected: 2 testes PASS.

- [ ] **Step 6: Commit**

```bash
git add src/config/env.ts .env.example tests/config/env.test.ts
git commit -m "feat: env validado por zod"
```

---

## Task 3: Classes de erro + classificação retryable/fatal

**Files:**
- Create: `src/lib/errors.ts`, `tests/lib/errors.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
// tests/lib/errors.test.ts
import { describe, it, expect } from 'vitest';
import { AppError, ExternalApiError, isRetryable } from '../../src/lib/errors';

describe('errors', () => {
  it('ExternalApiError 429 é retryable', () => {
    expect(isRetryable(new ExternalApiError('rate limit', 429))).toBe(true);
  });
  it('ExternalApiError 500 é retryable', () => {
    expect(isRetryable(new ExternalApiError('server', 503))).toBe(true);
  });
  it('ExternalApiError 400 é fatal', () => {
    expect(isRetryable(new ExternalApiError('bad', 400))).toBe(false);
  });
  it('AppError genérico é fatal', () => {
    expect(isRetryable(new AppError('x'))).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npx vitest run tests/lib/errors.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

```ts
// src/lib/errors.ts
export class AppError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export class ExternalApiError extends AppError {
  constructor(message: string, public readonly status: number, cause?: unknown) {
    super(message, cause);
  }
}

export class LockError extends AppError {}

export function isRetryable(err: unknown): boolean {
  if (err instanceof ExternalApiError) {
    return err.status === 429 || err.status >= 500;
  }
  return false;
}
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npx vitest run tests/lib/errors.test.ts`
Expected: 4 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/errors.ts tests/lib/errors.test.ts
git commit -m "feat: classes de erro e classificacao retryable"
```

---

## Task 4: Retry com backoff exponencial + jitter

**Files:**
- Create: `src/lib/retry.ts`, `tests/lib/retry.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
// tests/lib/retry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../src/lib/retry';
import { ExternalApiError } from '../../src/lib/errors';

describe('withRetry', () => {
  it('reexecuta em erro retryable e por fim resolve', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ExternalApiError('rl', 429))
      .mockResolvedValueOnce('ok');
    const result = await withRetry(fn, { retries: 3, baseMs: 1, jitter: () => 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('não reexecuta erro fatal', async () => {
    const fn = vi.fn().mockRejectedValue(new ExternalApiError('bad', 400));
    await expect(withRetry(fn, { retries: 3, baseMs: 1, jitter: () => 0 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('estoura após esgotar tentativas', async () => {
    const fn = vi.fn().mockRejectedValue(new ExternalApiError('rl', 503));
    await expect(withRetry(fn, { retries: 2, baseMs: 1, jitter: () => 0 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npx vitest run tests/lib/retry.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

```ts
// src/lib/retry.ts
import { isRetryable } from './errors';

export interface RetryOptions {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  jitter?: () => number; // 0..1, injetável para testes
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 200;
  const maxMs = opts.maxMs ?? 10_000;
  const jitter = opts.jitter ?? Math.random;
  const sleep = opts.sleep ?? defaultSleep;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err) || attempt >= retries) throw err;
      const backoff = Math.min(maxMs, baseMs * 2 ** attempt);
      await sleep(backoff + jitter() * backoff);
      attempt++;
    }
  }
}
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npx vitest run tests/lib/retry.test.ts`
Expected: 3 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/retry.ts tests/lib/retry.test.ts
git commit -m "feat: retry com backoff exponencial e jitter"
```

---

## Task 5: Logger com máscara LGPD

**Files:**
- Create: `src/lib/logger.ts`, `tests/lib/logger.test.ts`

- [ ] **Step 1: Escrever o teste** (testamos a função de mascaramento pura, não o transport do pino)

```ts
// tests/lib/logger.test.ts
import { describe, it, expect } from 'vitest';
import { maskSensitive } from '../../src/lib/logger';

describe('maskSensitive', () => {
  it('mascara telefone preservando finais', () => {
    expect(maskSensitive('21997552032')).toBe('*******2032');
  });
  it('mascara CPF', () => {
    expect(maskSensitive('123.456.789-00')).toContain('***');
  });
  it('mascara campos sensíveis em objeto', () => {
    const out = maskSensitive({ nome: 'Maria Silva', telefone: '21999998888', idade: 30 }) as Record<string, unknown>;
    expect(out.nome).not.toBe('Maria Silva');
    expect(out.telefone).toBe('*******8888');
    expect(out.idade).toBe(30);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npx vitest run tests/lib/logger.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/lib/logger.ts
import pino from 'pino';

const SENSITIVE_KEYS = new Set(['nome', 'name', 'telefone', 'phone', 'cpf', 'email']);

function maskString(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 8) {
    // telefone/CPF: preserva os 4 últimos dígitos
    const visible = value.slice(-4);
    return '*'.repeat(Math.max(0, value.length - 4)) + visible;
  }
  // nome ou texto curto: preserva inicial
  return value.length > 1 ? value[0] + '*'.repeat(value.length - 1) : '*';
}

export function maskSensitive(input: unknown): unknown {
  if (typeof input === 'string') return maskString(input);
  if (Array.isArray(input)) return input.map(maskSensitive);
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? maskSensitive(v) : v;
    }
    return out;
  }
  return input;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['*.telefone', '*.phone', '*.cpf', '*.nome', '*.name', '*.email'],
    censor: (value) => maskSensitive(value),
  },
});
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npx vitest run tests/lib/logger.test.ts`
Expected: 3 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/logger.ts tests/lib/logger.test.ts
git commit -m "feat: logger com mascara LGPD"
```

---

## Task 6: NumberRegistry (roteamento número↔papel)

**Files:**
- Create: `src/domain/numberRegistry.ts`, `tests/domain/numberRegistry.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
// tests/domain/numberRegistry.test.ts
import { describe, it, expect } from 'vitest';
import { NumberRegistry, WhatsappRole } from '../../src/domain/numberRegistry';

const registry = new NumberRegistry([
  { number: '5521991282761', role: 'reception' },
  { number: '5521981217082', role: 'lead' },
  { number: '5521920002328', role: 'dispatch' },
  { number: '5521975520232', role: 'quote' },
]);

describe('NumberRegistry', () => {
  it('resolve papel por número (normalizando)', () => {
    expect(registry.roleFor('+55 (21) 98121-7082')).toBe<WhatsappRole>('lead');
  });
  it('resolve número por papel', () => {
    expect(registry.numberFor('dispatch')).toBe('5521920002328');
  });
  it('retorna undefined para número desconhecido', () => {
    expect(registry.roleFor('5511000000000')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npx vitest run tests/domain/numberRegistry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/domain/numberRegistry.ts
export type WhatsappRole = 'reception' | 'lead' | 'dispatch' | 'quote';

export interface NumberMapping {
  number: string; // E.164 só dígitos, ex: 5521991282761
  role: WhatsappRole;
}

function normalize(raw: string): string {
  return raw.replace(/\D/g, '');
}

export class NumberRegistry {
  private byNumber = new Map<string, WhatsappRole>();
  private byRole = new Map<WhatsappRole, string>();

  constructor(mappings: NumberMapping[]) {
    for (const m of mappings) {
      const n = normalize(m.number);
      this.byNumber.set(n, m.role);
      this.byRole.set(m.role, n);
    }
  }

  roleFor(number: string): WhatsappRole | undefined {
    return this.byNumber.get(normalize(number));
  }

  numberFor(role: WhatsappRole): string | undefined {
    return this.byRole.get(role);
  }
}
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npx vitest run tests/domain/numberRegistry.test.ts`
Expected: 3 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/numberRegistry.ts tests/domain/numberRegistry.test.ts
git commit -m "feat: number registry para roteamento multi-numero"
```

---

## Task 7: Schema Zod do webhook do Chatbotify

> Nota: o payload exato será confirmado no **Spike 2**. Este schema cobre o mínimo necessário (mensagem de entrada com remetente, destino e conteúdo) e usa `.passthrough()` para não quebrar com campos extras. Ajustar após o spike.

**Files:**
- Create: `src/http/webhooks/chatbotify.schema.ts`, `tests/http/chatbotify.schema.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
// tests/http/chatbotify.schema.test.ts
import { describe, it, expect } from 'vitest';
import { inboundMessageSchema } from '../../src/http/webhooks/chatbotify.schema';

describe('inboundMessageSchema', () => {
  it('aceita mensagem de texto válida', () => {
    const r = inboundMessageSchema.safeParse({
      eventId: 'evt_1',
      from: '5521999998888',
      to: '5521981217082',
      type: 'text',
      text: 'quero agendar implante',
    });
    expect(r.success).toBe(true);
  });
  it('rejeita payload sem eventId', () => {
    const r = inboundMessageSchema.safeParse({ from: 'x', to: 'y', type: 'text', text: 'oi' });
    expect(r.success).toBe(false);
  });
  it('aceita mensagem de áudio com url', () => {
    const r = inboundMessageSchema.safeParse({
      eventId: 'evt_2',
      from: '5521999998888',
      to: '5521981217082',
      type: 'audio',
      mediaUrl: 'https://cdn.example/a.ogg',
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npx vitest run tests/http/chatbotify.schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/http/webhooks/chatbotify.schema.ts
import { z } from 'zod';

export const inboundMessageSchema = z
  .object({
    eventId: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    type: z.enum(['text', 'audio', 'image', 'document', 'other']),
    text: z.string().optional(),
    mediaUrl: z.string().url().optional(),
  })
  .passthrough();

export type InboundMessage = z.infer<typeof inboundMessageSchema>;
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npx vitest run tests/http/chatbotify.schema.test.ts`
Expected: 3 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/http/webhooks/chatbotify.schema.ts tests/http/chatbotify.schema.test.ts
git commit -m "feat: schema zod do webhook chatbotify (provisorio ate spike 2)"
```

---

## Task 8: Conexão Redis + filas BullMQ

**Files:**
- Create: `src/queue/connection.ts`, `src/queue/queues.ts`, `tests/queue/queues.test.ts`

- [ ] **Step 1: Escrever o teste** (valida nomes/definições das filas, sem subir Redis)

```ts
// tests/queue/queues.test.ts
import { describe, it, expect } from 'vitest';
import { QUEUE_NAMES } from '../../src/queue/queues';

describe('queues', () => {
  it('define as filas esperadas', () => {
    expect(QUEUE_NAMES.inbound).toBe('inbound-messages');
    expect(QUEUE_NAMES.outbound).toBe('outbound-dispatch');
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npx vitest run tests/queue/queues.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/queue/connection.ts
import { Redis } from 'ioredis';
import { env } from '../config/env';

// maxRetriesPerRequest: null é requerido pelo BullMQ
export function createRedis(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
```

```ts
// src/queue/queues.ts
import { Queue } from 'bullmq';
import { createRedis } from './connection';

export const QUEUE_NAMES = {
  inbound: 'inbound-messages',
  outbound: 'outbound-dispatch',
} as const;

export function buildQueues(connection = createRedis()) {
  return {
    inbound: new Queue(QUEUE_NAMES.inbound, { connection }),
    outbound: new Queue(QUEUE_NAMES.outbound, { connection }),
  };
}
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npx vitest run tests/queue/queues.test.ts`
Expected: 1 teste PASS.

- [ ] **Step 5: Commit**

```bash
git add src/queue/connection.ts src/queue/queues.ts tests/queue/queues.test.ts
git commit -m "feat: conexao redis e definicao de filas bullmq"
```

---

## Task 9: Rota de webhook com idempotência + enqueue

**Files:**
- Create: `src/http/webhooks/chatbotify.route.ts`, `tests/http/chatbotify.route.test.ts`

- [ ] **Step 1: Escrever o teste** (injeta um enqueuer fake e um store de idempotência em memória)

```ts
// tests/http/chatbotify.route.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleInbound } from '../../src/http/webhooks/chatbotify.route';

function makeDeps() {
  const seen = new Set<string>();
  return {
    enqueue: vi.fn(async () => {}),
    idempotency: {
      alreadyProcessed: async (id: string) => seen.has(id),
      markProcessed: async (id: string) => void seen.add(id),
    },
  };
}

const msg = { eventId: 'e1', from: '5521999998888', to: '5521981217082', type: 'text', text: 'oi' };

describe('handleInbound', () => {
  it('enfileira mensagem válida', async () => {
    const deps = makeDeps();
    const res = await handleInbound(msg, deps);
    expect(res.status).toBe('enqueued');
    expect(deps.enqueue).toHaveBeenCalledOnce();
  });

  it('é idempotente: não enfileira o mesmo eventId duas vezes', async () => {
    const deps = makeDeps();
    await handleInbound(msg, deps);
    const res2 = await handleInbound(msg, deps);
    expect(res2.status).toBe('duplicate');
    expect(deps.enqueue).toHaveBeenCalledOnce();
  });

  it('rejeita payload inválido', async () => {
    const deps = makeDeps();
    const res = await handleInbound({ bad: true }, deps);
    expect(res.status).toBe('invalid');
    expect(deps.enqueue).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npx vitest run tests/http/chatbotify.route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/http/webhooks/chatbotify.route.ts
import { inboundMessageSchema, type InboundMessage } from './chatbotify.schema';

export interface IdempotencyStore {
  alreadyProcessed(id: string): Promise<boolean>;
  markProcessed(id: string): Promise<void>;
}

export interface InboundDeps {
  enqueue: (msg: InboundMessage) => Promise<void>;
  idempotency: IdempotencyStore;
}

export type InboundResult =
  | { status: 'enqueued' }
  | { status: 'duplicate' }
  | { status: 'invalid'; issues: unknown };

export async function handleInbound(raw: unknown, deps: InboundDeps): Promise<InboundResult> {
  const parsed = inboundMessageSchema.safeParse(raw);
  if (!parsed.success) return { status: 'invalid', issues: parsed.error.issues };

  const msg = parsed.data;
  if (await deps.idempotency.alreadyProcessed(msg.eventId)) return { status: 'duplicate' };

  await deps.enqueue(msg);
  await deps.idempotency.markProcessed(msg.eventId);
  return { status: 'enqueued' };
}
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npx vitest run tests/http/chatbotify.route.test.ts`
Expected: 3 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/http/webhooks/chatbotify.route.ts tests/http/chatbotify.route.test.ts
git commit -m "feat: handler de webhook com idempotencia e enqueue"
```

---

## Task 10: Factory do servidor Fastify + error handler

**Files:**
- Create: `src/http/middleware/errorHandler.ts`, `src/http/server.ts`, `tests/http/server.test.ts`

- [ ] **Step 1: Escrever o teste** (usa `app.inject` do Fastify, sem abrir porta)

```ts
// tests/http/server.test.ts
import { describe, it, expect } from 'vitest';
import { buildServer } from '../../src/http/server';

describe('server', () => {
  it('GET /health responde 200', async () => {
    const app = buildServer({
      enqueue: async () => {},
      idempotency: { alreadyProcessed: async () => false, markProcessed: async () => {} },
    });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('POST /webhooks/chatbotify enfileira e responde 202', async () => {
    let enqueued = 0;
    const app = buildServer({
      enqueue: async () => void enqueued++,
      idempotency: { alreadyProcessed: async () => false, markProcessed: async () => {} },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/chatbotify',
      payload: { eventId: 'e1', from: 'a', to: 'b', type: 'text', text: 'oi' },
    });
    expect(res.statusCode).toBe(202);
    expect(enqueued).toBe(1);
    await app.close();
  });

  it('payload inválido responde 400', async () => {
    const app = buildServer({
      enqueue: async () => {},
      idempotency: { alreadyProcessed: async () => false, markProcessed: async () => {} },
    });
    const res = await app.inject({ method: 'POST', url: '/webhooks/chatbotify', payload: { bad: true } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npx vitest run tests/http/server.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar o error handler**

```ts
// src/http/middleware/errorHandler.ts
import type { FastifyInstance } from 'fastify';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _req, reply) => {
    logger.error({ err: error.message, name: error.name }, 'unhandled error');
    const status = error instanceof AppError ? 400 : 500;
    reply.status(status).send({ error: error.name, message: error.message });
  });
}
```

- [ ] **Step 4: Implementar a factory do servidor**

```ts
// src/http/server.ts
import Fastify, { type FastifyInstance } from 'fastify';
import { registerErrorHandler } from './middleware/errorHandler';
import { handleInbound, type InboundDeps } from './webhooks/chatbotify.route';

export function buildServer(deps: InboundDeps): FastifyInstance {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/webhooks/chatbotify', async (req, reply) => {
    const result = await handleInbound(req.body, deps);
    if (result.status === 'invalid') return reply.status(400).send(result);
    if (result.status === 'duplicate') return reply.status(200).send(result);
    return reply.status(202).send(result);
  });

  return app;
}
```

- [ ] **Step 5: Rodar — deve passar**

Run: `npx vitest run tests/http/server.test.ts`
Expected: 3 testes PASS.

- [ ] **Step 6: Commit**

```bash
git add src/http/middleware/errorHandler.ts src/http/server.ts tests/http/server.test.ts
git commit -m "feat: factory do servidor fastify com webhook e health"
```

---

## Task 11: Interfaces dos clients externos (contratos)

> Define **apenas as interfaces e tipos de domínio** que a lógica de agendamento consome. As implementações HTTP ficam para o plano pós-spike. Isso permite testar o `SchedulingEngine` contra um fake já agora.

**Files:**
- Create: `src/integrations/clinicorp/types.ts`, `src/integrations/chatbotify/types.ts`, `tests/integrations/types.test.ts`

- [ ] **Step 1: Escrever o teste** (garante que um fake satisfaz a interface — checagem de contrato em tempo de compilação + runtime)

```ts
// tests/integrations/types.test.ts
import { describe, it, expect } from 'vitest';
import type { ClinicorpClient, AvailabilitySlot } from '../../src/integrations/clinicorp/types';

const fake: ClinicorpClient = {
  async getAvailability() {
    const slot: AvailabilitySlot = {
      slotId: 's1',
      professionalId: 'p1',
      unitId: 'u1',
      specialty: 'implante',
      startsAt: '2026-07-01T13:00:00Z',
    };
    return [slot];
  },
  async createAppointment() {
    return { appointmentId: 'a1', status: 'confirmed' };
  },
  async cancelAppointment() {
    return { released: true };
  },
};

describe('ClinicorpClient contract', () => {
  it('fake implementa a interface e retorna slots', async () => {
    const slots = await fake.getAvailability({ specialty: 'implante' });
    expect(slots[0].slotId).toBe('s1');
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npx vitest run tests/integrations/types.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar os tipos**

```ts
// src/integrations/clinicorp/types.ts
export interface AvailabilitySlot {
  slotId: string;
  professionalId: string;
  unitId: string;
  specialty: string;
  startsAt: string; // ISO 8601
}

export interface AvailabilityQuery {
  specialty: string;
  professionalId?: string;
  unitId?: string;
  from?: string;
  to?: string;
}

export interface CreateAppointmentInput {
  slotId: string;
  patient: { name: string; phone: string };
  specialty: string;
}

export interface AppointmentResult {
  appointmentId: string;
  status: 'confirmed';
}

export interface ClinicorpClient {
  getAvailability(query: AvailabilityQuery): Promise<AvailabilitySlot[]>;
  createAppointment(input: CreateAppointmentInput): Promise<AppointmentResult>;
  cancelAppointment(appointmentId: string): Promise<{ released: boolean }>;
}
```

```ts
// src/integrations/chatbotify/types.ts
export interface OutboundMessage {
  to: string; // número de destino (E.164 dígitos)
  from: string; // número do papel (dispatch/lead/...)
  text?: string;
  mediaUrl?: string;
}

export interface ChatbotifyClient {
  sendMessage(msg: OutboundMessage): Promise<{ messageId: string }>;
  suppressBot(conversationId: string): Promise<void>;
  resumeBot(conversationId: string): Promise<void>;
}
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npx vitest run tests/integrations/types.test.ts`
Expected: 1 teste PASS.

- [ ] **Step 5: Commit**

```bash
git add src/integrations tests/integrations/types.test.ts
git commit -m "feat: interfaces de contrato dos clients clinicorp e chatbotify"
```

---

## Task 12: Lock atômico em Redis (anti double-booking)

**Files:**
- Create: `src/scheduling/lock.ts`, `tests/scheduling/lock.test.ts`

> Usa um cliente Redis injetável com a interface mínima (`set`/`eval`), permitindo um fake em memória nos testes sem subir Redis.

- [ ] **Step 1: Escrever o teste**

```ts
// tests/scheduling/lock.test.ts
import { describe, it, expect } from 'vitest';
import { SlotLock, type LockRedis } from '../../src/scheduling/lock';

// Fake mínimo que emula SET NX PX e DEL condicional via eval
function makeFakeRedis(): LockRedis {
  const store = new Map<string, string>();
  return {
    async set(key, value, _mode, _px, _ttl, nx) {
      if (nx === 'NX' && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    },
    async eval(_script, _numKeys, key, value) {
      if (store.get(key) === value) {
        store.delete(key);
        return 1;
      }
      return 0;
    },
  };
}

describe('SlotLock', () => {
  it('adquire lock livre e bloqueia segunda aquisição', async () => {
    const lock = new SlotLock(makeFakeRedis());
    const a = await lock.acquire('p1', 's1', 5000);
    expect(a).not.toBeNull();
    const b = await lock.acquire('p1', 's1', 5000);
    expect(b).toBeNull();
  });

  it('libera lock apenas com o token correto', async () => {
    const redis = makeFakeRedis();
    const lock = new SlotLock(redis);
    const handle = await lock.acquire('p1', 's2', 5000);
    expect(handle).not.toBeNull();
    const released = await lock.release(handle!);
    expect(released).toBe(true);
    // após liberar, dá para readquirir
    const again = await lock.acquire('p1', 's2', 5000);
    expect(again).not.toBeNull();
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npx vitest run tests/scheduling/lock.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/scheduling/lock.ts
export interface LockRedis {
  set(
    key: string,
    value: string,
    mode: 'PX',
    px: 'PX',
    ttl: number,
    nx: 'NX',
  ): Promise<'OK' | null>;
  eval(script: string, numKeys: number, key: string, value: string): Promise<number>;
}

export interface LockHandle {
  key: string;
  token: string;
}

const RELEASE_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

let tokenCounter = 0;

export class SlotLock {
  constructor(private readonly redis: LockRedis) {}

  private keyFor(professionalId: string, slotId: string): string {
    return `lock:slot:${professionalId}:${slotId}`;
  }

  async acquire(professionalId: string, slotId: string, ttlMs: number): Promise<LockHandle | null> {
    const key = this.keyFor(professionalId, slotId);
    const token = `${professionalId}:${slotId}:${++tokenCounter}`;
    const res = await this.redis.set(key, token, 'PX', 'PX', ttlMs, 'NX');
    return res === 'OK' ? { key, token } : null;
  }

  async release(handle: LockHandle): Promise<boolean> {
    const res = await this.redis.eval(RELEASE_SCRIPT, 1, handle.key, handle.token);
    return res === 1;
  }
}
```

> Nota de implementação real: o `ioredis` aceita `redis.set(key, token, 'PX', ttlMs, 'NX')`. A assinatura acima é um adaptador explícito para testabilidade; no plano pós-spike, criar um wrapper fino sobre `ioredis` que satisfaça `LockRedis`.

- [ ] **Step 4: Rodar — deve passar**

Run: `npx vitest run tests/scheduling/lock.test.ts`
Expected: 2 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scheduling/lock.ts tests/scheduling/lock.test.ts
git commit -m "feat: lock atomico de horario em redis"
```

---

## Task 13: SchedulingEngine (disponibilidade + lock + confirmação)

**Files:**
- Create: `src/scheduling/schedulingEngine.ts`, `tests/scheduling/schedulingEngine.test.ts`

> Esta é a regra de negócio central: confirma o agendamento **somente** após sucesso da Clinicorp, segurando o lock durante a operação e liberando-o ao final (sucesso ou falha).

- [ ] **Step 1: Escrever o teste**

```ts
// tests/scheduling/schedulingEngine.test.ts
import { describe, it, expect, vi } from 'vitest';
import { SchedulingEngine } from '../../src/scheduling/schedulingEngine';
import type { ClinicorpClient } from '../../src/integrations/clinicorp/types';
import type { SlotLock, LockHandle } from '../../src/scheduling/lock';

function fakeLock(acquire: boolean) {
  const handle: LockHandle = { key: 'k', token: 't' };
  return {
    acquire: vi.fn(async () => (acquire ? handle : null)),
    release: vi.fn(async () => true),
  } as unknown as SlotLock;
}

function fakeClient(over: Partial<ClinicorpClient> = {}): ClinicorpClient {
  return {
    getAvailability: vi.fn(async () => []),
    createAppointment: vi.fn(async () => ({ appointmentId: 'a1', status: 'confirmed' as const })),
    cancelAppointment: vi.fn(async () => ({ released: true })),
    ...over,
  };
}

const patient = { name: 'Maria', phone: '5521999998888' };

describe('SchedulingEngine.book', () => {
  it('confirma quando lock é obtido e Clinicorp responde sucesso', async () => {
    const lock = fakeLock(true);
    const client = fakeClient();
    const engine = new SchedulingEngine(client, lock, 30_000);
    const res = await engine.book({ slotId: 's1', professionalId: 'p1', specialty: 'implante', patient });
    expect(res.status).toBe('confirmed');
    expect(res.appointmentId).toBe('a1');
    expect(lock.release).toHaveBeenCalledOnce();
  });

  it('retorna slot_taken quando o lock não é obtido (concorrência)', async () => {
    const lock = fakeLock(false);
    const client = fakeClient();
    const engine = new SchedulingEngine(client, lock, 30_000);
    const res = await engine.book({ slotId: 's1', professionalId: 'p1', specialty: 'implante', patient });
    expect(res.status).toBe('slot_taken');
    expect(client.createAppointment).not.toHaveBeenCalled();
  });

  it('libera o lock e retorna failed se a Clinicorp falhar', async () => {
    const lock = fakeLock(true);
    const client = fakeClient({
      createAppointment: vi.fn(async () => {
        throw new Error('clinicorp down');
      }),
    });
    const engine = new SchedulingEngine(client, lock, 30_000);
    const res = await engine.book({ slotId: 's1', professionalId: 'p1', specialty: 'implante', patient });
    expect(res.status).toBe('failed');
    expect(lock.release).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npx vitest run tests/scheduling/schedulingEngine.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/scheduling/schedulingEngine.ts
import type { ClinicorpClient } from '../integrations/clinicorp/types';
import type { SlotLock } from './lock';
import { logger } from '../lib/logger';

export interface BookRequest {
  slotId: string;
  professionalId: string;
  specialty: string;
  patient: { name: string; phone: string };
}

export type BookResult =
  | { status: 'confirmed'; appointmentId: string }
  | { status: 'slot_taken' }
  | { status: 'failed'; reason: string };

export class SchedulingEngine {
  constructor(
    private readonly client: ClinicorpClient,
    private readonly lock: SlotLock,
    private readonly lockTtlMs = 30_000,
  ) {}

  async book(req: BookRequest): Promise<BookResult> {
    const handle = await this.lock.acquire(req.professionalId, req.slotId, this.lockTtlMs);
    if (!handle) return { status: 'slot_taken' };

    try {
      const result = await this.client.createAppointment({
        slotId: req.slotId,
        specialty: req.specialty,
        patient: req.patient,
      });
      return { status: 'confirmed', appointmentId: result.appointmentId };
    } catch (err) {
      logger.error({ err: (err as Error).message, slotId: req.slotId }, 'falha ao agendar');
      return { status: 'failed', reason: (err as Error).message };
    } finally {
      await this.lock.release(handle);
    }
  }
}
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npx vitest run tests/scheduling/schedulingEngine.test.ts`
Expected: 3 testes PASS.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: todos os testes PASS.

- [ ] **Step 6: Commit**

```bash
git add src/scheduling/schedulingEngine.ts tests/scheduling/schedulingEngine.test.ts
git commit -m "feat: scheduling engine com lock e confirmacao sincrona"
```

---

## Task 14: Bootstrap do worker BullMQ (consumidor da fila inbound)

**Files:**
- Create: `src/queue/worker.ts`, `tests/queue/worker.test.ts`

> Testamos a **função processadora** isolada (pura, injetável), não o runtime do BullMQ.

- [ ] **Step 1: Escrever o teste**

```ts
// tests/queue/worker.test.ts
import { describe, it, expect, vi } from 'vitest';
import { processInbound } from '../../src/queue/worker';
import { NumberRegistry } from '../../src/domain/numberRegistry';

const registry = new NumberRegistry([{ number: '5521981217082', role: 'lead' }]);

describe('processInbound', () => {
  it('roteia a mensagem para o papel do número de destino', async () => {
    const handler = vi.fn(async () => {});
    await processInbound(
      { eventId: 'e1', from: '5521999998888', to: '5521981217082', type: 'text', text: 'oi' },
      { registry, onRole: { lead: handler, reception: vi.fn(), dispatch: vi.fn(), quote: vi.fn() } },
    );
    expect(handler).toHaveBeenCalledOnce();
  });

  it('ignora número desconhecido sem lançar', async () => {
    await expect(
      processInbound(
        { eventId: 'e2', from: 'x', to: '5511000000000', type: 'text', text: 'oi' },
        { registry, onRole: { lead: vi.fn(), reception: vi.fn(), dispatch: vi.fn(), quote: vi.fn() } },
      ),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npx vitest run tests/queue/worker.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/queue/worker.ts
import { Worker } from 'bullmq';
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
    { connection: createRedis() },
  );
}
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npx vitest run tests/queue/worker.test.ts`
Expected: 2 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/queue/worker.ts tests/queue/worker.test.ts
git commit -m "feat: worker inbound com roteamento por papel"
```

---

## Task 15: Spike 1 — Mapear a API real da Clinicorp

> **Tarefa de investigação, não de código.** Entregável: documento de achados. Usa o token fornecido (via `.env`, nunca commitado). **Não criar agendamentos reais** sem dado descartável; preferir endpoints de leitura.

**Files:**
- Create: `docs/superpowers/spikes/2026-06-13-spike1-clinicorp.md`

- [ ] **Step 1: Autenticar** contra `CLINICORP_API_BASE` com usuário/token e registrar o fluxo OAuth2 real (headers, expiração).

- [ ] **Step 2: Mapear endpoints** de: consulta de disponibilidade (filtros: profissional, unidade, especialidade), criação de agendamento, cancelamento/liberação de vaga, busca de paciente, procedimentos. Registrar método, path, params e shape de request/response reais.

- [ ] **Step 3: Verificar webhooks** ("Gestão de Webhook"): eventos disponíveis (ex: agendamento criado/cancelado) e se substituem o polling diário do Cron-Engine.

- [ ] **Step 4: Documentar divergências** entre o shape real e as interfaces de `src/integrations/clinicorp/types.ts`. Listar ajustes necessários.

- [ ] **Step 5: Escrever o entregável** `docs/superpowers/spikes/2026-06-13-spike1-clinicorp.md` com: autenticação, tabela de endpoints, exemplos de payload (mascarados), decisão polling vs webhook, e lista de ajustes nos tipos.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/spikes/2026-06-13-spike1-clinicorp.md
git commit -m "docs: spike 1 - mapeamento da api clinicorp"
```

---

## Task 16: Spike 2 — Mapear o Chatbotify (conta do cliente)

> **Tarefa de investigação.** Acessa a conta `financeiro@dentalbeauty.com.br` (credencial via cofre, não commitada). Entregável: documento de achados + decisão de ferramenta a assinar, se necessário.

**Files:**
- Create: `docs/superpowers/spikes/2026-06-13-spike2-chatbotify.md`

- [ ] **Step 1: Inspecionar a conta** e descobrir como o Chatbotify expõe: webhook de entrada (formato real do payload → validar/ajustar `chatbotify.schema.ts`), API de envio de mensagem/mídia, e mecanismo de supressão/retomada do bot.

- [ ] **Step 2: Conectar os 4 números** de WhatsApp (recepção, lead, disparos, orçamento) e registrar instance IDs ↔ papéis para alimentar o `NumberRegistry`.

- [ ] **Step 3: Identificar se há STT nativo** de áudio. Se não houver, registrar a necessidade do componente Whisper-class (Groq/OpenAI) para a Fase 2.

- [ ] **Step 4: Listar ferramentas/assinaturas necessárias** (ex: plano que habilite API/webhook) para informar o cliente, que topou assinar.

- [ ] **Step 5: Escrever o entregável** `docs/superpowers/spikes/2026-06-13-spike2-chatbotify.md` com: formato do webhook, API de disparo, supressão do bot, mapa número↔instância, situação do STT, e ferramentas a assinar.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/spikes/2026-06-13-spike2-chatbotify.md
git commit -m "docs: spike 2 - mapeamento da conta chatbotify"
```

---

## Task 17: Atualizar README com setup e arquitetura da Fase 0

**Files:**
- Modify: `README.md` (adicionar seção de desenvolvimento)

- [ ] **Step 1: Acrescentar** ao README uma seção "## Desenvolvimento" com: pré-requisitos (Node 20+, Redis), `cp .env.example .env` e preenchimento dos segredos, `npm install`, `npm test`, e como rodar servidor/worker. Referenciar o spec e este plano.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: instrucoes de desenvolvimento da fase 0"
```

---

## Self-Review (cobertura vs spec)

- **Topologia Fastify + worker** → Tasks 8, 10, 14 ✔
- **Config/Secrets** → Task 2 + `.gitignore` (já commitado) ✔
- **Logger LGPD** → Task 5 ✔
- **Retry exponencial + classificação de erro** → Tasks 3, 4 ✔
- **Validação Zod de webhooks + idempotência** → Tasks 7, 9 ✔
- **Roteamento multi-número** → Tasks 6, 14 ✔
- **Lock atômico anti double-booking** → Task 12 ✔
- **Agendamento síncrono (confirma só pós-sucesso)** → Task 13 ✔
- **Spikes Clinicorp/Chatbotify/Webhook** → Tasks 15, 16 ✔
- **Interfaces de client (contrato)** → Task 11 ✔

**Deferido conscientemente para o plano pós-spike** (depende dos achados dos spikes — escrever código exato agora seria adivinhação):
- Implementação HTTP real de `ClinicorpClient` e `ChatbotifyClient` (sobre as interfaces da Task 11).
- Adaptador `ioredis` concreto para `LockRedis` (Task 12).
- Wiring final de `buildServer` + worker + filas reais no entrypoint de produção.

**Fora deste plano (fases seguintes do spec):** IA conversacional/STT, KnowledgeBase, HandoffManager, Cron-Engine, painel admin.
