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
