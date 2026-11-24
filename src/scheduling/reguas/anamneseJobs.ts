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
 *
 * **Mudança de escopo do cliente em 20/11/2026: o link é SÓ para criança de até 12 anos.** O
 * formulário virou "Conhecendo o Mini Guardião" e quem responde é o responsável. Adulto,
 * adolescente acima de 12 e as demais especialidades (implante, prótese, lentes, endo, clínico)
 * não recebem mais nada — a anamnese deles é feita na clínica, pelo dentista ou pela recepção.
 * Por isso a especialidade enviada é **sempre** `odontopediatria`.
 */

/** Idade máxima que recebe o link da anamnese (regra do cliente, 20/11/2026). */
export const ANAMNESE_IDADE_MAXIMA = 12;

/**
 * A agenda diz que é criança? Usado **só como rede** quando a ficha está sem data de nascimento —
 * o que acontece com paciente novo, porque `create_appointment_by_api` não tem campo de
 * nascimento e a ficha nasce sem ele até a recepção preencher.
 *
 * É seguro porque o sinal não é ambíguo no sentido perigoso: agenda de adulto não escreve
 * "odontopediatria" nem "infantil". Na dúvida, o pior que acontece é não mandar.
 */
export function agendaDizInfantil(procedimento?: string): boolean {
  const c = (procedimento ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return /odontopediatr|infantil|crianca|kids/.test(c);
}

/**
 * Idade em anos completos numa data de referência. `undefined` quando a data de nascimento não
 * vem ou não dá para ler — e aí a régua **não envia**, porque o erro caro é mandar para adulto.
 *
 * Aceita o ISO que a Clinicorp devolve (`1989-05-20T08:00:00.000Z`) e `DD/MM/AAAA`, pelo mesmo
 * motivo de `parseDayMonth`: a API não documenta o formato.
 */
export function idadeEm(birthDate: string | undefined, referencia: string): number | undefined {
  if (!birthDate) return undefined;

  let ano: number;
  let mes: number;
  let dia: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate.trim());
  if (iso) {
    ano = Number(iso[1]);
    mes = Number(iso[2]);
    dia = Number(iso[3]);
  } else {
    const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(birthDate.trim());
    if (!br) return undefined;
    dia = Number(br[1]);
    mes = Number(br[2]);
    ano = Number(br[3]);
  }

  const ref = /^(\d{4})-(\d{2})-(\d{2})/.exec(referencia.trim());
  if (!ref) return undefined;
  const refAno = Number(ref[1]);
  const refMes = Number(ref[2]);
  const refDia = Number(ref[3]);

  let idade = refAno - ano;
  if (refMes < mes || (refMes === mes && refDia < dia)) idade--;
  return idade >= 0 && idade < 130 ? idade : undefined;
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
  let adultos = 0;
  let semIdade = 0;

  for (const a of appointments) {
    if (!a.mobilePhone) continue;
    const procedimento = procedimentoDoAtendimento(a);
    if (!ehPrimeiraAvaliacao(procedimento)) {
      pulados++;
      continue;
    }
    if (await store.recuperar(a.id)) continue; // já mandamos o link para este agendamento

    // Só criança até 12 anos (regra do cliente, 20/11/2026). A idade vem da ficha, buscada
    // pelo id do agendamento — nunca pelo telefone, que numa criança é o do responsável.
    let idade: number | undefined;
    if (a.patientId !== undefined) {
      try {
        const ficha = await clinicorp.getPatientById(a.patientId);
        idade = idadeEm(ficha?.birthDate, date);
      } catch (err) {
        logger.error({ err, appointmentId: a.id }, 'anamnese D-2: falha ao ler a ficha do paciente');
        continue;
      }
    }

    if (idade === undefined) {
      // Ficha sem data de nascimento: cai na rede da agenda. Se nem ela disser que é criança,
      // não envia — o erro caro é mandar ficha infantil para adulto, que é o que o cliente
      // pediu para acabar.
      if (!agendaDizInfantil(procedimento)) {
        semIdade++;
        continue;
      }
    } else if (idade > ANAMNESE_IDADE_MAXIMA) {
      adultos++;
      continue;
    }

    // Sempre o formulário infantil — a spec nova não usa as outras especialidades.
    const especialidade = especialidadeDoAtendimento({ infantil: true });

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
        track: 'infantil' as const,
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

  logger.info({ sent, pulados, adultos, semIdade }, 'anamnese D-2: links criados');
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
        // Só criança tem link desde 20/11/2026, então o lembrete é sempre da trilha infantil.
        track: 'infantil' as const,
      });
      sent++;
    } catch (err) {
      logger.error({ err, appointmentId: a.id }, 'anamnese D-1: falha ao consultar o link');
    }
  }

  logger.info({ sent, jaResponderam }, 'anamnese D-1: lembretes enviados');
  return sent;
}
