import type { ClinicorpClient } from '../../integrations/clinicorp/types';
import type { ReguaDispatcher } from './dispatcher';
import {
  runAniversariantes,
  runNoShow,
  runLembreteHoje,
  runPostProcedure,
  runNps,
  runInactivity,
  runPosCirurgia,
} from './jobs';
import type { VisitCounter } from './visitCounter';
import { logger } from '../../lib/logger';

/** Dispatchers por régua (cada um aponta para o SEU fluxo Gatilho HTTP, com mensagem própria). */
export interface ReguaDispatchers {
  aniversario: ReguaDispatcher;
  noShow?: ReguaDispatcher;
  /** Lembrete da manhã (7h30) para quem tem consulta hoje. Roda na rodada matinal, não na diária. */
  lembreteHoje?: ReguaDispatcher;
  posProcedimento?: ReguaDispatcher;
  nps?: ReguaDispatcher;
  inatividade?: ReguaDispatcher;
  posCirurgia?: ReguaDispatcher;
}

/**
 * Antecedência da confirmação de consulta, em dias. O cliente mudou de 24h para **96h** em
 * 12/11/2026: com 4 dias, quem responde NÃO ainda dá tempo de liberar a vaga para outro paciente.
 */
export const CONFIRMACAO_DIAS_ANTES = 4;

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
  npsCounter?: VisitCounter,
): Promise<{
  aniversario: number;
  noShow: number;
  posProcedimento: number;
  nps: number;
  inatividade: number;
  posCirurgia: number;
}> {
  const aniversario = await runAniversariantes(clinicorp, dispatchers.aniversario, now);
  // Confirmação: agendamentos daqui a 96h (4 dias).
  const noShow = dispatchers.noShow
    ? await runNoShow(clinicorp, dispatchers.noShow, isoDate(now, CONFIRMACAO_DIAS_ANTES))
    : 0;
  const posProcedimento = dispatchers.posProcedimento
    ? await runPostProcedure(clinicorp, dispatchers.posProcedimento, (m) => monthsAgoIso(now, m))
    : 0;
  // NPS pós-consulta: consultas ATENDIDAS de ONTEM (T-1), uma a cada 3 vindas do paciente.
  const nps = dispatchers.nps
    ? await runNps(clinicorp, dispatchers.nps, isoDate(now, -1), npsCounter)
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
  // Cuidado no dia seguinte a cirurgia/extração/canal: atendidos de ONTEM (T-1).
  const posCirurgia = dispatchers.posCirurgia
    ? await runPosCirurgia(clinicorp, dispatchers.posCirurgia, isoDate(now, -1))
    : 0;
  return { aniversario, noShow, posProcedimento, nps, inatividade, posCirurgia };
}

/**
 * Reivindica a execução do dia. Só quem receber `true` roda a rotina — evita execução dupla quando
 * o processo reinicia (Render) ou quando há mais de uma instância. Sem claim, roda sempre.
 */
export type ClaimDailyRun = (dateIso: string) => Promise<boolean>;

/**
 * Agenda uma rotina para rodar uma vez por dia num horário UTC. Retorna a função de parada.
 *
 * **Catch-up:** se o processo subir DEPOIS do horário alvo e a rotina do dia ainda não tiver
 * rodado, ela roda no boot. Sem isso, um restart/hibernação em cima do horário faria o dia inteiro
 * de réguas ser perdido silenciosamente — cenário real no Render.
 */
function scheduleDaily(opts: {
  hourUtc: number;
  minuteUtc: number;
  run: (now: Date) => Promise<void>;
}): () => void {
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;

  const targetFor = (d: Date): number =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), opts.hourUtc, opts.minuteUtc, 0);

  const scheduleNext = (): void => {
    if (stopped) return;
    const now = new Date();
    const next = new Date(targetFor(now));
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);

    timer = setTimeout(
      () => {
        void opts.run(new Date()).finally(scheduleNext);
      },
      next.getTime() - now.getTime(),
    );

    if (timer.unref) timer.unref();
  };

  const bootNow = new Date();
  if (bootNow.getTime() >= targetFor(bootNow)) {
    void opts.run(bootNow);
  }

  scheduleNext();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

/**
 * Cron-Engine (README §3.4): agenda as duas rotinas do dia e devolve uma função que para as duas.
 *
 * - **Rodada principal**, 12h UTC = 09h de Brasília: aniversário, confirmação (96h antes),
 *   retorno pós-procedimento, pesquisa de satisfação, reengajamento e cuidado no dia seguinte.
 * - **Rodada matinal**, 10h30 UTC = 07h30 de Brasília: o lembrete de quem tem consulta HOJE
 *   (pedido do cliente em 12/11/2026). Só liga se `dispatchers.lembreteHoje` existir.
 *
 * Cada rodada tem o seu próprio claim — se as duas dividissem a mesma chave, a primeira do dia
 * cancelaria a segunda.
 */
export function startReguas(opts: {
  clinicorp: ClinicorpClient;
  dispatchers: ReguaDispatchers;
  hourUtc?: number;
  minuteUtc?: number;
  /** Horário da rodada matinal. Default 10h30 UTC = 07h30 BRT. */
  manha?: { hourUtc?: number; minuteUtc?: number };
  claimDailyRun?: ClaimDailyRun;
  /** Claim da rodada matinal. Precisa de chave própria, separada da rodada principal. */
  claimMorningRun?: ClaimDailyRun;
  /** Contador de visitas que espaça a pesquisa de satisfação (a cada 3 vindas). */
  npsCounter?: VisitCounter;
}): () => void {
  const claim: ClaimDailyRun = opts.claimDailyRun ?? (async () => true);
  const claimManha: ClaimDailyRun = opts.claimMorningRun ?? (async () => true);

  const pararPrincipal = scheduleDaily({
    hourUtc: opts.hourUtc ?? 12,
    minuteUtc: opts.minuteUtc ?? 0,
    run: async (now) => {
      const dateIso = isoDate(now);
      if (!(await claim(dateIso))) {
        logger.info({ dateIso }, 'réguas do dia já executadas por outra instância/execução');
        return;
      }
      try {
        const res = await runDailyReguas(
          opts.clinicorp,
          opts.dispatchers,
          now,
          opts.npsCounter,
        );
        logger.info(res, 'réguas diárias executadas');
      } catch (err) {
        logger.error({ err }, 'falha nas réguas diárias');
      }
    },
  });

  const lembreteHoje = opts.dispatchers.lembreteHoje;
  if (!lembreteHoje) return pararPrincipal;

  const pararManha = scheduleDaily({
    hourUtc: opts.manha?.hourUtc ?? 10,
    minuteUtc: opts.manha?.minuteUtc ?? 30,
    run: async (now) => {
      const dateIso = isoDate(now);
      if (!(await claimManha(dateIso))) {
        logger.info({ dateIso }, 'lembrete da manhã já executado por outra instância/execução');
        return;
      }
      try {
        const enviados = await runLembreteHoje(opts.clinicorp, lembreteHoje, dateIso);
        logger.info({ lembreteHoje: enviados }, 'lembrete da manhã executado');
      } catch (err) {
        logger.error({ err }, 'falha no lembrete da manhã');
      }
    },
  });

  return () => {
    pararPrincipal();
    pararManha();
  };
}
