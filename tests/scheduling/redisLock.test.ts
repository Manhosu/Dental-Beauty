import { describe, it, expect, vi } from 'vitest';
import { createLockRedis } from '../../src/scheduling/redisLock';
import type { Redis } from 'ioredis';

function makeFakeRedisClient() {
  return {
    set: vi.fn().mockResolvedValue('OK' as 'OK' | null),
    eval: vi.fn().mockResolvedValue(1),
  } as unknown as Redis;
}

describe('createLockRedis', () => {
  it('set() delegates to redis.set with correct args and returns value', async () => {
    const fake = makeFakeRedisClient();
    const lockRedis = createLockRedis(fake);

    const result = await lockRedis.set('k', 'v', 'PX', 1000, 'NX');

    expect(fake.set).toHaveBeenCalledWith('k', 'v', 'PX', 1000, 'NX');
    expect(result).toBe('OK');
  });

  it('set() returns null when redis.set returns null', async () => {
    const fake = makeFakeRedisClient();
    vi.mocked(fake.set).mockResolvedValue(null as unknown as 'OK');
    const lockRedis = createLockRedis(fake);

    const result = await lockRedis.set('k', 'v', 'PX', 1000, 'NX');

    expect(result).toBeNull();
  });

  it('eval() delegates to redis.eval with correct args and returns value', async () => {
    const fake = makeFakeRedisClient();
    const lockRedis = createLockRedis(fake);
    const script = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

    const result = await lockRedis.eval(script, 1, 'mykey', 'mytoken');

    expect(fake.eval).toHaveBeenCalledWith(script, 1, 'mykey', 'mytoken');
    expect(result).toBe(1);
  });

  it('eval() returns 0 when redis.eval returns 0', async () => {
    const fake = makeFakeRedisClient();
    vi.mocked(fake.eval).mockResolvedValue(0);
    const lockRedis = createLockRedis(fake);

    const result = await lockRedis.eval('script', 1, 'key', 'value');

    expect(result).toBe(0);
  });
});
