import type { ClinicorpClient } from '../../integrations/clinicorp/types';
import type { ReguaDispatcher } from './dispatcher';

/** Régua de aniversariantes: felicita cada paciente que faz aniversário (consulta diária). */
export async function runAniversariantes(
  clinicorp: ClinicorpClient,
  dispatch: ReguaDispatcher,
): Promise<number> {
  const birthdays = await clinicorp.listBirthdays();
  let sent = 0;
  for (const b of birthdays) {
    if (!b.mobilePhone) continue;
    await dispatch({ type: 'aniversario', phone: b.mobilePhone, name: b.name });
    sent++;
  }
  return sent;
}

/**
 * Régua anti no-show: para cada agendamento da data alvo, pede confirmação de presença.
 * Uso T-24h: passar a data de amanhã. (T-2h pode ser uma execução horária no futuro.)
 */
export async function runNoShow(
  clinicorp: ClinicorpClient,
  dispatch: ReguaDispatcher,
  date: string,
): Promise<number> {
  const appointments = await clinicorp.listAppointmentsByDate(date);
  let sent = 0;
  for (const a of appointments) {
    if (!a.mobilePhone) continue;
    await dispatch({
      type: 'no_show',
      phone: a.mobilePhone,
      name: a.patientName,
      appointmentId: a.id,
      date: a.date,
      fromTime: a.fromTime,
      ...(a.professionalName !== undefined ? { professionalName: a.professionalName } : {}),
      ...(a.unit !== undefined ? { unit: a.unit } : {}),
    });
    sent++;
  }
  return sent;
}

/** Meses distintos da tabela de retorno do escopo (réguas-e-campanhas.md). */
export const POST_PROCEDURE_INTERVALS = [3, 6, 12] as const;

/**
 * Mapeia a categoria/procedimento atendido para o prazo de retorno (meses), conforme a tabela do
 * cliente: Periodontia 3m; Coroa/Prótese/Implante 12m; demais (limpeza, clareamento, restauração,
 * canal, ortodontia, invisalign, odontopediatria, lente/faceta) 6m. Default = 6m.
 * (Implante ajustado de 6m → 12m pelo cliente em 2026-07, junto dos textos aprovados.)
 */
export function intervalMonthsForCategory(category?: string): number {
  const c = (category ?? '').toLowerCase();
  if (/periodont/.test(c)) return 3;
  if (/pr[óo]tese|coroa|implante/.test(c)) return 12;
  return 6;
}

/**
 * Régua de pós-procedimento (README §3.4 / réguas-e-campanhas.md): para cada agendamento ATENDIDO
 * (StatusId == CHECKOUT) há `intervalMonthsForCategory` meses, dispara o convite de retorno.
 * `monthsAgoIso(runDate, m)` produz a data-alvo de cada bucket de meses.
 */
export async function runPostProcedure(
  clinicorp: ClinicorpClient,
  dispatch: ReguaDispatcher,
  monthsAgoIso: (months: number) => string,
): Promise<number> {
  const statuses = await clinicorp.listAppointmentStatuses();
  const checkoutId = statuses.find((s) => s.type === 'CHECKOUT')?.id;
  if (checkoutId === undefined) return 0; // sem o status mapeado, não dispara (evita falso-positivo)

  let sent = 0;
  for (const months of POST_PROCEDURE_INTERVALS) {
    const target = monthsAgoIso(months);
    const appointments = await clinicorp.listAppointmentsByDate(target);
    for (const a of appointments) {
      if (a.statusId !== checkoutId) continue; // só quem compareceu (alta)
      if (intervalMonthsForCategory(a.categoryDescription) !== months) continue; // bucket certo
      if (!a.mobilePhone) continue;
      await dispatch({
        type: 'pos_procedimento',
        phone: a.mobilePhone,
        name: a.patientName,
        date: a.date,
        ...(a.categoryDescription !== undefined ? { procedure: a.categoryDescription } : {}),
        ...(a.unit !== undefined ? { unit: a.unit } : {}),
      });
      sent++;
    }
  }
  return sent;
}

/**
 * NPS pós-consulta: no dia seguinte à consulta ATENDIDA (StatusId == CHECKOUT), dispara a pesquisa
 * "de 0 a 10". A IA trata a resposta (nota alta → link do Google Maps). `date` = a data-alvo (ontem).
 */
export async function runNps(
  clinicorp: ClinicorpClient,
  dispatch: ReguaDispatcher,
  date: string,
): Promise<number> {
  const statuses = await clinicorp.listAppointmentStatuses();
  const checkoutId = statuses.find((s) => s.type === 'CHECKOUT')?.id;
  if (checkoutId === undefined) return 0;

  const appointments = await clinicorp.listAppointmentsByDate(date);
  let sent = 0;
  for (const a of appointments) {
    if (a.statusId !== checkoutId) continue; // só quem compareceu
    if (!a.mobilePhone) continue;
    await dispatch({ type: 'nps', phone: a.mobilePhone, name: a.patientName });
    sent++;
  }
  return sent;
}
