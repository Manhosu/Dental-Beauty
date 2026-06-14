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
