import type { ClinicorpClient } from '../../integrations/clinicorp/types';
import type { AnamneseClient } from '../../integrations/anamnese/client';
import { especialidadeDoAtendimento } from '../../integrations/anamnese/client';
import type { ReguaDispatcher } from './dispatcher';
import type { AnamneseStore } from './anamneseStore';
import { procedimentoDoAtendimento } from './jobs';
import { logger } from '../../lib/logger';

/**
 * Régua da anamnese online (spec do OdontoBI, 17/11/2026), em duas pontas:
 *
 * - **D-2 às 8h** — cria o link da ficha de saúde e manda ao paciente.
 * - **D-1 às 8h** — pergunta ao OdontoBI se ele respondeu; se não, lembra **uma** vez.
 *
 * As respostas nunca passam por aqui: o que volta da API é só o link e um booleano.
 */

/** Trilha infantil pela agenda: odontopediatria e o que a clínica escreve como infantil. */
function ehInfantil(procedimento?: string): boolean {
  const c = (procedimento ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return /odontopediatr|infantil|crianca|kids/.test(c);
}

/**
 * É a **primeira avaliação** do paciente? Só essas recebem a anamnese — a spec exclui retorno,
 * consulta de tratamento e quem já tem ficha.
 *
 * **Heurística, e assumida como tal.** O sinal bom seria a especialidade gravada no Additional Info
 * do CRM, que o backend não enxerga. O que temos é a categoria livre da agenda, onde a clínica
 * escreve "Avaliação Recreio", "Avaliação Ipanema" e "Avaliação para paciente - retorno(COBRADA)".
 * Então: vale quem tem "avalia" no texto **e não tem "retorno"**.
 *
 * O erro possível nos dois sentidos é brando: mandar a ficha para quem já tem só gera um link
 * reaproveitado, e deixar de mandar faz o dentista preencher na cadeira, como hoje.
 */
export function ehPrimeiraAvaliacao(procedimento?: string): boolean {
  const c = (procedimento ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (c.trim() === '') return false;
  if (/retorno|revisao|manutencao/.test(c)) return false;
  return /avalia/.test(c);
}

/**
 * D-2: cria o link e dispara a mensagem. `date` é a data da consulta (hoje + 2).
 *
 * Um agendamento que já tem link guardado é pulado: a spec garante que chamar de novo devolve o
 * mesmo link (`reaproveitado: true`), mas o paciente receberia a mensagem duas vezes.
 */
export async function runAnamneseD2(
  clinicorp: ClinicorpClient,
  anamnese: AnamneseClient,
  store: AnamneseStore,
  dispatch: ReguaDispatcher,
  date: string,
): Promise<number> {
  const appointments = await clinicorp.listAppointmentsByDate(date);
  let sent = 0;
  let pulados = 0;

  for (const a of appointments) {
    if (!a.mobilePhone) continue;
    const procedimento = procedimentoDoAtendimento(a);
    if (!ehPrimeiraAvaliacao(procedimento)) {
      pulados++;
      continue;
    }
    if (await store.recuperar(a.id)) continue; // já mandamos o link para este agendamento

    const infantil = ehInfantil(procedimento);
    const especialidade = especialidadeDoAtendimento({
      ...(procedimento !== undefined ? { procedimento } : {}),
      infantil,
    });

    try {
      const link = await anamnese.criarLink({
        especialidade,
        ...(a.patientId !== undefined ? { clinicorpPatientId: String(a.patientId) } : {}),
        ...(a.patientName ? { nome: a.patientName } : {}),
      });
      await store.lembrar(a.id, link.id);
      await dispatch({
        type: 'anamnese',
        phone: a.mobilePhone,
        name: a.patientName,
        appointmentId: a.id,
        date: a.date,
        fromTime: a.fromTime,
        anamneseLink: link.link,
        especialidade,
        ...(infantil ? { track: 'infantil' as const } : {}),
        ...(a.professionalName !== undefined ? { professionalName: a.professionalName } : {}),
        ...(a.unit !== undefined ? { unit: a.unit } : {}),
      });
      sent++;
    } catch (err) {
      // Um paciente que falha não pode derrubar a rodada dos outros. O link não foi guardado,
      // então a próxima execução tenta de novo.
      logger.error({ err, appointmentId: a.id }, 'anamnese D-2: falha ao criar ou enviar o link');
    }
  }

  logger.info({ sent, pulados }, 'anamnese D-2: links criados');
  return sent;
}

/**
 * D-1: um único lembrete para quem ainda não respondeu. `date` é a data da consulta (hoje + 1).
 *
 * Quem não respondeu nem depois disso não recebe mais nada — a consulta segue normal e o dentista
 * faz a anamnese na cadeira.
 */
export async function runAnamneseD1(
  clinicorp: ClinicorpClient,
  anamnese: AnamneseClient,
  store: AnamneseStore,
  dispatch: ReguaDispatcher,
  date: string,
): Promise<number> {
  const appointments = await clinicorp.listAppointmentsByDate(date);
  let sent = 0;
  let jaResponderam = 0;

  for (const a of appointments) {
    if (!a.mobilePhone) continue;
    const linkId = await store.recuperar(a.id);
    if (!linkId) continue; // nunca mandamos ficha para este agendamento

    try {
      const link = await anamnese.consultarLink(linkId);
      if (link.respondido) {
        jaResponderam++;
        continue;
      }
      await dispatch({
        type: 'anamnese_lembrete',
        phone: a.mobilePhone,
        name: a.patientName,
        appointmentId: a.id,
        date: a.date,
        fromTime: a.fromTime,
        anamneseLink: link.link,
        especialidade: link.especialidade,
        ...(ehInfantil(procedimentoDoAtendimento(a)) ? { track: 'infantil' as const } : {}),
      });
      sent++;
    } catch (err) {
      logger.error({ err, appointmentId: a.id }, 'anamnese D-1: falha ao consultar o link');
    }
  }

  logger.info({ sent, jaResponderam }, 'anamnese D-1: lembretes enviados');
  return sent;
}
