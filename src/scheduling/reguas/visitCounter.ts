/**
 * Contador de visitas atendidas por paciente.
 *
 * A pesquisa de satisfação não sai mais depois de **toda** consulta: para quem está em tratamento,
 * recebendo a mesma pergunta a cada sessão, isso vira incômodo (decisão do cliente em 12/11/2026).
 * A regra passou a ser "a cada 3 vindas".
 *
 * A contagem é por telefone, começa do zero quando o sistema entra no ar e não tenta reconstruir o
 * histórico da Clinicorp — a 1ª visita contada aqui pode ser a trigésima do paciente na clínica.
 * Isso é aceitável: o que interessa é o espaçamento daqui para a frente.
 */

/** De quantas em quantas visitas a pesquisa sai. */
export const NPS_A_CADA_N_VISITAS = 3;

/**
 * 3 anos. Cobre com folga o paciente que só aparece uma vez por ano, sem deixar a chave no Redis
 * para sempre. O TTL é renovado a cada visita, então quem continua vindo nunca expira.
 */
export const VISITAS_TTL_SECONDS = 94_608_000;

export interface VisitCounter {
  /** Conta mais uma visita atendida e devolve o total acumulado do paciente. */
  increment(phone: string): Promise<number>;
}

/** Cliente Redis mínimo necessário (mesmo padrão do SlotLock e do SentRegistry). */
export interface CounterRedis {
  incr(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<unknown>;
}

/** Só os dígitos — mesma chave de identidade usada nas outras réguas. */
function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function visitKey(phone: string): string {
  return `regua:visitas:${phoneKey(phone)}`;
}

export function createRedisVisitCounter(
  redis: CounterRedis,
  ttlSeconds: number = VISITAS_TTL_SECONDS,
): VisitCounter {
  return {
    increment: async (phone) => {
      const key = visitKey(phone);
      const total = await redis.incr(key);
      // Renova a validade a cada visita: paciente ativo nunca perde a contagem.
      await redis.expire(key, ttlSeconds);
      return total;
    },
  };
}

/** Contador em memória — dev e testes. Não sobrevive a restart. */
export function createMemoryVisitCounter(): VisitCounter {
  const totais = new Map<string, number>();
  return {
    increment: async (phone) => {
      const key = visitKey(phone);
      const total = (totais.get(key) ?? 0) + 1;
      totais.set(key, total);
      return total;
    },
  };
}

/**
 * Esta visita pede pesquisa? Dispara na **1ª** visita observada e depois a cada `aCada`
 * (1ª, 4ª, 7ª…).
 *
 * Começar na primeira é de propósito: quem vem uma vez só — uma limpeza, uma avaliação — é
 * justamente de quem se quer a avaliação no Google, e esperar a 3ª vinda deixaria esse paciente
 * de fora para sempre. Quem está em tratamento recebe uma vez a cada três sessões, que é o
 * espaçamento pedido.
 */
export function visitaPedePesquisa(total: number, aCada: number = NPS_A_CADA_N_VISITAS): boolean {
  if (total < 1) return false;
  return (total - 1) % aCada === 0;
}
