import { randomUUID } from 'node:crypto';

export interface LockRedis {
  set(
    key: string,
    value: string,
    px: 'PX',
    ttlMs: number,
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

export class SlotLock {
  constructor(private readonly redis: LockRedis) {}

  private keyFor(professionalId: string, slotId: string): string {
    return `lock:slot:${professionalId}:${slotId}`;
  }

  async acquire(professionalId: string, slotId: string, ttlMs: number): Promise<LockHandle | null> {
    const key = this.keyFor(professionalId, slotId);
    const token = randomUUID();
    const res = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    return res === 'OK' ? { key, token } : null;
  }

  async release(handle: LockHandle): Promise<boolean> {
    const res = await this.redis.eval(RELEASE_SCRIPT, 1, handle.key, handle.token);
    return res === 1;
  }
}
