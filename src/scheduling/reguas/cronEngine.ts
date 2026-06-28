import type { ClinicorpClient } from '../../integrations/clinicorp/types';
import type { ReguaDispatcher } from './dispatcher';
import { runAniversariantes } from './jobs';
import { logger } from '../../lib/logger';

/** Data YYYY-MM-DD deslocada por `daysFromNow` (UTC) a partir de `base`. */
export function isoDate(base: Date, daysFromNow = 0): string {
  return new Date(base.getTime() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Executa as réguas do dia. Hoje só ANIVERSÁRIO (o fluxo de envio "Gatilho HTTP → Mensagem" criado
 * tem o texto de aniversário). A régua de no-show precisa do SEU PRÓPRIO fluxo/dispatcher (mensagem
 * diferente) — `runNoShow` continua disponível para quando esse 2º fluxo existir. `now` mantido p/ T-24h.
 */
export async function runDailyReguas(
  clinicorp: ClinicorpClient,
  dispatch: ReguaDispatcher,
  _now: Date,
): Promise<{ aniversario: number }> {
  const aniversario = await runAniversariantes(clinicorp, dispatch);
  return { aniversario };
}

/**
 * Cron-Engine (README §3.4): agenda a rotina diária no horário alvo (UTC).
 * 12h UTC = 09h no horário de Brasília (BRT, UTC-3). Retorna uma função para parar.
 */
export function startReguas(opts: {
  clinicorp: ClinicorpClient;
  dispatch: ReguaDispatcher;
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
      void runDailyReguas(opts.clinicorp, opts.dispatch, new Date())
        .then((res) => logger.info(res, 'réguas diárias executadas'))
        .catch((err) => logger.error({ err }, 'falha nas réguas diárias'))
        .finally(scheduleNext);
    }, next.getTime() - now.getTime());

    if (timer.unref) timer.unref();
  };

  scheduleNext();
  return () => clearTimeout(timer);
}
