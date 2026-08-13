import type { ReguaDispatcher, ReguaPayload } from './dispatcher';
import { logger } from '../../lib/logger';

/**
 * Trava de "não enviar duas vezes". As réguas rodam 1x/dia, mas um restart do serviço (Render
 * reinicia/hiberna) pode re-executar a rotina do dia — e reenviar mensagem para paciente real é
 * o pior erro possível nesta fase. Cada destinatário é reivindicado atomicamente antes do envio.
 */
export interface SentRegistry {
  /** `true` se ESTA chamada reservou a chave (ou seja, ainda não tinha sido enviada). */
  claim(key: string, ttlSeconds: number): Promise<boolean>;
  /** Libera a reserva — usado quando o envio falha, para permitir nova tentativa. */
  release(key: string): Promise<void>;
}

/** Cliente Redis mínimo necessário (mesmo padrão do SlotLock). */
export interface DedupeRedis {
  set(key: string, value: string, ex: 'EX', ttlSeconds: number, nx: 'NX'): Promise<'OK' | null>;
  del(key: string): Promise<number>;
}

export function createRedisSentRegistry(redis: DedupeRedis): SentRegistry {
  return {
    claim: async (key, ttlSeconds) => (await redis.set(key, '1', 'EX', ttlSeconds, 'NX')) === 'OK',
    release: async (key) => {
      await redis.del(key);
    },
  };
}

/** Registro em memória — fallback quando não há Redis (dev/testes). Não sobrevive a restart. */
export function createMemorySentRegistry(): SentRegistry {
  const seen = new Map<string, number>();
  return {
    claim: async (key, ttlSeconds) => {
      const now = Date.now();
      const expiresAt = seen.get(key);
      if (expiresAt !== undefined && expiresAt > now) return false;
      seen.set(key, now + ttlSeconds * 1000);
      return true;
    },
    release: async (key) => {
      seen.delete(key);
    },
  };
}

/** Chave de envio: uma régua, um paciente, um dia. */
export function sentKey(payload: ReguaPayload, dateIso: string): string {
  const phone = payload.phone.replace(/\D/g, '');
  return `regua:sent:${payload.type}:${dateIso}:${phone}`;
}

/** 48h cobre o dia do disparo com folga, sem inchar o Redis. */
export const SENT_TTL_SECONDS = 172_800;

/**
 * Envolve um dispatcher com a trava de duplicidade. Se o envio falhar, a reserva é liberada para
 * que a próxima execução possa tentar de novo (a falha não deve "queimar" o destinatário do dia).
 */
export function withDedupe(
  dispatch: ReguaDispatcher,
  registry: SentRegistry,
  todayIso: () => string,
  ttlSeconds: number = SENT_TTL_SECONDS,
): ReguaDispatcher {
  return async (payload: ReguaPayload): Promise<void> => {
    const key = sentKey(payload, todayIso());
    if (!(await registry.claim(key, ttlSeconds))) {
      logger.info({ type: payload.type }, 'régua: envio duplicado ignorado');
      return;
    }
    try {
      await dispatch(payload);
    } catch (err) {
      await registry.release(key);
      throw err;
    }
  };
}
