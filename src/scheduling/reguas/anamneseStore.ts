/**
 * Guarda o `id` do link de anamnese entre as duas pontas da régua.
 *
 * A spec do OdontoBI manda "guardar o id devolvido junto do agendamento": ele é criado no **D-2** e
 * só é usado no **D-1**, para perguntar se o paciente respondeu. Como as duas rodadas são execuções
 * diferentes do processo (e o Render reinicia no meio), o id precisa de um lugar fora da memória.
 *
 * Guardamos só o par agendamento → id do link. Nada de dado de saúde: as respostas nunca chegam
 * até aqui.
 */

/** TTL de 7 dias: cobre D-2 → D-1 com folga de sobra, mesmo com remarcação. */
export const ANAMNESE_TTL_SECONDS = 604_800;

export interface AnamneseStore {
  /** Guarda o id do link criado para um agendamento. */
  lembrar(appointmentId: string, linkId: string): Promise<void>;
  /** Devolve o id guardado, ou `undefined` se não houver (ou se já expirou). */
  recuperar(appointmentId: string): Promise<string | undefined>;
}

export interface StoreRedis {
  set(key: string, value: string, ex: 'EX', ttlSeconds: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
}

export function anamneseKey(appointmentId: string): string {
  return `regua:anamnese:${appointmentId}`;
}

export function createRedisAnamneseStore(
  redis: StoreRedis,
  ttlSeconds: number = ANAMNESE_TTL_SECONDS,
): AnamneseStore {
  return {
    lembrar: async (appointmentId, linkId) => {
      await redis.set(anamneseKey(appointmentId), linkId, 'EX', ttlSeconds);
    },
    recuperar: async (appointmentId) => {
      const v = await redis.get(anamneseKey(appointmentId));
      return v ?? undefined;
    },
  };
}

/** Versão em memória — dev e testes. Não sobrevive a restart, como o resto dos fallbacks. */
export function createMemoryAnamneseStore(): AnamneseStore {
  const mapa = new Map<string, string>();
  return {
    lembrar: async (appointmentId, linkId) => {
      mapa.set(anamneseKey(appointmentId), linkId);
    },
    recuperar: async (appointmentId) => mapa.get(anamneseKey(appointmentId)),
  };
}
