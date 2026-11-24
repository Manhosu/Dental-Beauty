import type { Redis } from 'ioredis';
import type { LockRedis } from './lock';

// Adapta o ioredis para a interface LockRedis usada pelo SlotLock.
export function createLockRedis(redis: Redis): LockRedis {
  return {
    set: (key, value, _px, ttlMs, _nx) =>
      redis.set(key, value, 'PX', ttlMs, 'NX') as Promise<'OK' | null>,
    eval: (script, numKeys, key, value) =>
      redis.eval(script, numKeys, key, value) as Promise<number>,
  };
}
