import type { ClinicorpClient } from '../../integrations/clinicorp/types';
import type { ReguaDispatcher } from './dispatcher';
import {
  runAniversariantes,
  runConfirmacao,
  runLembreteHoje,
  runPostProcedure,
  runNps,
  runInactivity,
  runPosCirurgia,
} from './jobs';
import type { VisitCounter } from './visitCounter';
import type { AnamneseStore } from './anamneseStore';
import type { AnamneseClient } from '../../integrations/anamnese/client';
import { runAnamneseD2, runAnamneseD1 } from './anamneseJobs';
import { logger } from '../../lib/logger';

/** Dispatchers por régua (cada um aponta para o SEU fluxo Gatilho HTTP, com mensagem própria). */
export interface ReguaDispatchers {
  aniversario: ReguaDispatcher;
  noShow?: ReguaDispatcher;
  /** Lembrete da manhã (8h) para quem tem consulta hoje. Roda na rodada matinal, não na diária. */
  lembreteHoje?: ReguaDispatcher;
  posProcedimento?: ReguaDispatcher;
  nps?: ReguaDispatcher;
  inatividade?: ReguaDispatcher;
  posCirurgia?: ReguaDispatcher;
}

/**
 * Antecedência padrão da confirmação, em dias. O cliente mudou de 24h para **96h** em 12/11/2026:
 * com 4 dias, quem responde NÃO ainda dá tempo de liberar a vaga para outro paciente.
 *
 * Em 17/11/2026 virou a janela *máxima*: quem marcou de 5 a 3 dias antes confirma no D-2 e quem
 * marcou em cima da hora não confirma. Ver `diasAntesDaConfirmacao` em `jobs.ts`.
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
  // Confirmação: D-4 para quem marcou com 6+ dias, D-2 para quem marcou de 5 a 3 dias antes.
  const noShow = dispatchers.noShow
    ? await runConfirmacao(clinicorp, dispatchers.noShow, (dias) => isoDate(now, dias))
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
 * - **Rodada principal**, 12h UTC = 09h de Brasília: aniversário, confirmação (D-4 ou D-2),
 *   retorno pós-procedimento, pesquisa de satisfação, reengajamento e cuidado no dia seguinte.
 * - **Rodada matinal**, 11h UTC = 08h de Brasília: o lembrete de quem tem consulta HOJE (pedido do
 *   cliente em 12/11/2026, movido de 07h30 para 08h em 17/11). Só liga se
 *   `dispatchers.lembreteHoje` existir. As 8h também abrem a janela de envios ativos do fluxo.
 *
 * Cada rodada tem o seu próprio claim — se as duas dividissem a mesma chave, a primeira do dia
 * cancelaria a segunda.
 */
export function startReguas(opts: {
  clinicorp: ClinicorpClient;
  dispatchers: ReguaDispatchers;
  hourUtc?: number;
  minuteUtc?: number;
  /** Horário da rodada matinal. Default 11h UTC = 08h BRT. */
  manha?: { hourUtc?: number; minuteUtc?: number };
  claimDailyRun?: ClaimDailyRun;
  /** Claim da rodada matinal. Precisa de chave própria, separada da rodada principal. */
  claimMorningRun?: ClaimDailyRun;
  /** Contador de visitas que espaça a pesquisa de satisfação (a cada 3 vindas). */
  npsCounter?: VisitCounter;
  /**
   * Anamnese online do OdontoBI. Roda junto da rodada das 8h: cria o link no D-2 e lembra no D-1.
   * Dormente enquanto não vier — depende do `ANAMNESE_SECRET`.
   */
  anamnese?: {
    client: AnamneseClient;
    store: AnamneseStore;
    dispatch: ReguaDispatcher;
  };
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
  const anamnese = opts.anamnese;
  if (!lembreteHoje && !anamnese) return pararPrincipal;

  const pararManha = scheduleDaily({
    hourUtc: opts.manha?.hourUtc ?? 11,
    minuteUtc: opts.manha?.minuteUtc ?? 0,
    run: async (now) => {
      const dateIso = isoDate(now);
      if (!(await claimManha(dateIso))) {
        logger.info({ dateIso }, 'rodada das 8h já executada por outra instância/execução');
        return;
      }
      // Cada peça falha sozinha: um erro no lembrete não pode levar a anamnese junto.
      if (lembreteHoje) {
        try {
          const enviados = await runLembreteHoje(opts.clinicorp, lembreteHoje, dateIso);
          logger.info({ lembreteHoje: enviados }, 'lembrete da manhã executado');
        } catch (err) {
          logger.error({ err }, 'falha no lembrete da manhã');
        }
      }
      if (anamnese) {
        try {
          const criados = await runAnamneseD2(
            opts.clinicorp,
            anamnese.client,
            anamnese.store,
            anamnese.dispatch,
            isoDate(now, 2),
          );
          const lembrados = await runAnamneseD1(
            opts.clinicorp,
            anamnese.client,
            anamnese.store,
            anamnese.dispatch,
            isoDate(now, 1),
          );
          logger.info({ criados, lembrados }, 'anamnese online executada');
        } catch (err) {
          logger.error({ err }, 'falha na anamnese online');
        }
      }
    },
  });

  return () => {
    pararPrincipal();
    pararManha();
  };
}
