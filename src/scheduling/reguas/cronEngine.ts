import type { ClinicorpClient } from '../../integrations/clinicorp/types';
import type { ReguaDispatcher } from './dispatcher';
import { runAniversariantes, runNoShow, runPostProcedure } from './jobs';
import { logger } from '../../lib/logger';

/** Dispatchers por régua (cada um aponta para o SEU fluxo Gatilho HTTP, com mensagem própria). */
export interface ReguaDispatchers {
  aniversario: ReguaDispatcher;
  noShow?: ReguaDispatcher;
  posProcedimento?: ReguaDispatcher;
}

/** Data YYYY-MM-DD deslocada por `daysFromNow` (UTC) a partir de `base`. */
export function isoDate(base: Date, daysFromNow = 0): string {
  return new Date(base.getTime() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
}

/** Data YYYY-MM-DD `months` meses antes de `base` (UTC, aritmética de calendário). */
export function monthsAgoIso(base: Date, months: number): string {
  const d = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - months, base.getUTCDate()),
  );
  return d.toISOString().slice(0, 10);
}

/**
 * Executa as réguas do dia: ANIVERSÁRIO (sempre), NO-SHOW (T-24h = agendamentos de amanhã) e
 * PÓS-PROCEDIMENTO (retorno N meses após alta/CHECKOUT). No-show e pós-procedimento só rodam se o
 * dispatcher correspondente estiver configurado (cada um precisa do SEU fluxo, mensagem diferente).
 */
export async function runDailyReguas(
  clinicorp: ClinicorpClient,
  dispatchers: ReguaDispatchers,
  now: Date,
): Promise<{ aniversario: number; noShow: number; posProcedimento: number }> {
  const aniversario = await runAniversariantes(clinicorp, dispatchers.aniversario);
  const noShow = dispatchers.noShow
    ? await runNoShow(clinicorp, dispatchers.noShow, isoDate(now, 1))
    : 0;
  const posProcedimento = dispatchers.posProcedimento
    ? await runPostProcedure(clinicorp, dispatchers.posProcedimento, (m) => monthsAgoIso(now, m))
    : 0;
  return { aniversario, noShow, posProcedimento };
}

/**
 * Cron-Engine (README §3.4): agenda a rotina diária no horário alvo (UTC).
 * 12h UTC = 09h no horário de Brasília (BRT, UTC-3). Retorna uma função para parar.
 */
export function startReguas(opts: {
  clinicorp: ClinicorpClient;
  dispatchers: ReguaDispatchers;
  hourUtc?: number;
}): () => void {
  const hour = opts.hourUtc ?? 12;
  let timer: NodeJS.Timeout;

  const scheduleNext = (): void => {
    const now = new Date();
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0),
    );
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);

    timer = setTimeout(() => {
      void runDailyReguas(opts.clinicorp, opts.dispatchers, new Date())
        .then((res) => logger.info(res, 'réguas diárias executadas'))
        .catch((err) => logger.error({ err }, 'falha nas réguas diárias'))
        .finally(scheduleNext);
    }, next.getTime() - now.getTime());

    if (timer.unref) timer.unref();
  };

  scheduleNext();
  return () => clearTimeout(timer);
}
