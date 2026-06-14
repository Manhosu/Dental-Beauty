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
