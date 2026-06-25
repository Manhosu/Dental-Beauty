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
