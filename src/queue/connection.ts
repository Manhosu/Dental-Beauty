import { Redis } from 'ioredis';
import { getEnv } from '../config/env';

// maxRetriesPerRequest: null é requerido pelo BullMQ
export function createRedis(): Redis {
  return new Redis(getEnv().REDIS_URL, { maxRetriesPerRequest: null });
}
