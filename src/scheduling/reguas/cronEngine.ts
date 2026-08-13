import type { ClinicorpClient } from '../../integrations/clinicorp/types';
import type { ReguaDispatcher } from './dispatcher';
import { runAniversariantes, runNoShow, runPostProcedure, runNps, runInactivity } from './jobs';
import { logger } from '../../lib/logger';

/** Dispatchers por régua (cada um aponta para o SEU fluxo Gatilho HTTP, com mensagem própria). */
export interface ReguaDispatchers {
  aniversario: ReguaDispatcher;
  noShow?: ReguaDispatcher;
  posProcedimento?: ReguaDispatcher;
  nps?: ReguaDispatcher;
  inatividade?: ReguaDispatcher;
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
): Promise<{
  aniversario: number;
  noShow: number;
  posProcedimento: number;
  nps: number;
  inatividade: number;
}> {
  const aniversario = await runAniversariantes(clinicorp, dispatchers.aniversario);
  const noShow = dispatchers.noShow
    ? await runNoShow(clinicorp, dispatchers.noShow, isoDate(now, 1))
    : 0;
  const posProcedimento = dispatchers.posProcedimento
    ? await runPostProcedure(clinicorp, dispatchers.posProcedimento, (m) => monthsAgoIso(now, m))
    : 0;
  // NPS pós-consulta: consultas ATENDIDAS de ONTEM (T-1).
  const nps = dispatchers.nps
    ? await runNps(clinicorp, dispatchers.nps, isoDate(now, -1))
    : 0;
  // Inatividade (reengajamento): atendidos há 6/12 meses que não voltaram desde então.
  const inatividade = dispatchers.inatividade
    ? await runInactivity(
        clinicorp,
        dispatchers.inatividade,
        (m) => monthsAgoIso(now, m),
        isoDate(now),
      )
    : 0;
  return { aniversario, noShow, posProcedimento, nps, inatividade };
}

/**
 * Reivindica a execução do dia. Só quem receber `true` roda a rotina — evita execução dupla quando
 * o processo reinicia (Render) ou quando há mais de uma instância. Sem claim, roda sempre.
 */
export type ClaimDailyRun = (dateIso: string) => Promise<boolean>;

/**
 * Cron-Engine (README §3.4): agenda a rotina diária no horário alvo (UTC).
 * 12h UTC = 09h no horário de Brasília (BRT, UTC-3). Retorna uma função para parar.
 *
 * **Catch-up:** se o processo subir DEPOIS do horário alvo e a rotina do dia ainda não tiver
 * rodado, ela roda no boot. Sem isso, um restart/hibernação em cima do horário faria o dia inteiro
 * de réguas ser perdido silenciosamente — cenário real no Render.
 */
export function startReguas(opts: {
  clinicorp: ClinicorpClient;
  dispatchers: ReguaDispatchers;
  hourUtc?: number;
  claimDailyRun?: ClaimDailyRun;
}): () => void {
  const hour = opts.hourUtc ?? 12;
  const claim: ClaimDailyRun = opts.claimDailyRun ?? (async () => true);
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;

  const runOnce = async (now: Date): Promise<void> => {
    const dateIso = isoDate(now);
    if (!(await claim(dateIso))) {
      logger.info({ dateIso }, 'réguas do dia já executadas por outra instância/execução');
      return;
    }
    try {
      const res = await runDailyReguas(opts.clinicorp, opts.dispatchers, now);
      logger.info(res, 'réguas diárias executadas');
    } catch (err) {
      logger.error({ err }, 'falha nas réguas diárias');
    }
  };

  const scheduleNext = (): void => {
    if (stopped) return;
    const now = new Date();
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0),
    );
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);

    timer = setTimeout(() => {
      void runOnce(new Date()).finally(scheduleNext);
    }, next.getTime() - now.getTime());

    if (timer.unref) timer.unref();
  };

  // Catch-up: o horário de hoje já passou → tenta rodar agora (o claim decide se é a 1ª vez).
  const bootNow = new Date();
  const targetToday = Date.UTC(
    bootNow.getUTCFullYear(),
    bootNow.getUTCMonth(),
    bootNow.getUTCDate(),
    hour,
    0,
    0,
  );
  if (bootNow.getTime() >= targetToday) {
    void runOnce(bootNow);
  }

  scheduleNext();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
