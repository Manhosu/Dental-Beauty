import type { ClinicorpClient } from '../../integrations/clinicorp/types';
import type { ReguaDispatcher } from './dispatcher';
import { logger } from '../../lib/logger';

/**
 * Idade máxima tratada como público infantil (Dental Beauty Kids). Os textos aprovados têm trilha
 * própria para criança — ver `textos-reguas-APROVADO.md`.
 */
export const INFANTIL_MAX_AGE = 12;

/**
 * Extrai dia e mês de uma data de nascimento. A Clinicorp não documenta o formato, então aceita
 * ISO (`2026-08-17`, com ou sem hora) e `DD/MM/AAAA`. Retorna `null` quando não reconhece.
 */
export function parseDayMonth(birthDate: string): { day: number; month: number } | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate.trim());
  if (iso) return { day: Number(iso[3]), month: Number(iso[2]) };
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(birthDate.trim());
  if (br) return { day: Number(br[1]), month: Number(br[2]) };
  return null;
}

/**
 * O aniversário é HOJE? `GET /patient/birthdays` não aceita filtro de data, então não há garantia
 * de que a lista traga só o dia corrente — sem esta checagem, uma lista mensal viraria dezenas de
 * mensagens indevidas por dia. Data ilegível → `false` (não enviar na dúvida).
 */
export function isBirthdayToday(birthDate: string, today: Date): boolean {
  const dm = parseDayMonth(birthDate);
  if (dm === null) return false;
  return dm.day === today.getUTCDate() && dm.month === today.getUTCMonth() + 1;
}

/**
 * Régua de aniversariantes: felicita quem faz aniversário HOJE (consulta diária).
 * Só dispara para registros com telefone E com a data batendo com o dia da execução.
 */
export async function runAniversariantes(
  clinicorp: ClinicorpClient,
  dispatch: ReguaDispatcher,
  today: Date = new Date(),
): Promise<number> {
  const birthdays = await clinicorp.listBirthdays();
  let sent = 0;
  let ignorados = 0;
  for (const b of birthdays) {
    if (!b.mobilePhone) continue;
    if (!isBirthdayToday(b.birthDate, today)) {
      ignorados++;
      continue;
    }
    // A Clinicorp entrega a idade — é o que separa a arte/texto adulto do infantil.
    const infantil = typeof b.age === 'number' && b.age <= INFANTIL_MAX_AGE;
    await dispatch({
      type: 'aniversario',
      phone: b.mobilePhone,
      name: b.name,
      ...(infantil ? { track: 'infantil' as const, childName: b.name } : {}),
    });
    sent++;
  }
  if (ignorados > 0) {
    logger.info({ sent, ignorados }, 'régua aniversário: registros fora da data foram ignorados');
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
 * Procedimento que justifica a mensagem de cuidado no dia seguinte: cirurgia, extração ou canal
 * (decisão do cliente em 11/11/2026, para adulto e infantil).
 *
 * A Clinicorp devolve a categoria como texto livre, então casamos por radical. Cobre as variações
 * que aparecem na agenda: "Cirurgia", "Exodontia", "Extração", "Canal", "Endodontia". Frenectomia
 * entra por ser cirúrgica e por existir como categoria própria na clínica.
 *
 * **Implante ficou de fora de propósito.** A colocação é cirúrgica, mas a mesma categoria cobre as
 * etapas protéticas, que não são. Incluir mandaria "como você está depois do procedimento de
 * ontem?" para quem só foi ajustar a prótese. Se o cliente quiser incluir, é só acrescentar o
 * radical aqui.
 */
export function isProcedimentoCirurgico(category?: string): boolean {
  const c = (category ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (c.trim() === '') return false;
  return /cirurg|exodontia|extraca|extraco|canal|endodont|frenectomia/.test(c);
}

/** Meses de inatividade que disparam reengajamento (réguas-e-campanhas.md §Réguas por inatividade). */
export const INACTIVITY_INTERVALS = [6, 12] as const;

/** Só os dígitos do telefone — chave de identidade do paciente entre agendamentos. */
function phoneKey(phone?: string): string {
  return (phone ?? '').replace(/\D/g, '');
}

/** Dia seguinte a uma data YYYY-MM-DD (UTC). */
function nextDayIso(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Régua de INATIVIDADE (reengajamento — réguas-e-campanhas.md): paciente ATENDIDO (CHECKOUT) há
 * exatamente N meses (6 ou 12) e SEM nenhum agendamento desde então. Quem voltou depois da
 * data-alvo não é inativo, então é excluído. `todayIso` fecha a janela de verificação.
 */
export async function runInactivity(
  clinicorp: ClinicorpClient,
  dispatch: ReguaDispatcher,
  monthsAgoIso: (months: number) => string,
  todayIso: string,
): Promise<number> {
  const statuses = await clinicorp.listAppointmentStatuses();
  const checkoutId = statuses.find((s) => s.type === 'CHECKOUT')?.id;
  if (checkoutId === undefined) return 0;

  let sent = 0;
  for (const months of INACTIVITY_INTERVALS) {
    const target = monthsAgoIso(months);
    const candidates = (await clinicorp.listAppointmentsByDate(target)).filter(
      (a) => a.statusId === checkoutId && phoneKey(a.mobilePhone),
    );
    if (candidates.length === 0) continue;

    // Quem tem qualquer agendamento APÓS a data-alvo voltou — logo, não está inativo.
    const dayAfter = nextDayIso(target);
    const since =
      dayAfter <= todayIso ? await clinicorp.listAppointmentsByDate(dayAfter, todayIso) : [];
    const voltaram = new Set(since.map((a) => phoneKey(a.mobilePhone)).filter(Boolean));

    const jaEnviados = new Set<string>();
    for (const a of candidates) {
      const key = phoneKey(a.mobilePhone);
      if (voltaram.has(key) || jaEnviados.has(key)) continue;
      jaEnviados.add(key);
      await dispatch({
        type: 'inatividade',
        phone: a.mobilePhone as string,
        name: a.patientName,
        months,
      });
      sent++;
    }
  }
  return sent;
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
 * Pesquisa de satisfação no dia seguinte à consulta ATENDIDA (StatusId == CHECKOUT).
 * `date` = a data-alvo (ontem).
 *
 * A escala é de **1 a 5 estrelas** (decisão do cliente em 11/11/2026, antes era NPS de 0 a 10).
 * Quem dá 5 recebe o convite para avaliar no Google; 4 ou menos vira conversa. Quem responde o
 * agente trata — aqui só disparamos a pergunta.
 *
 * A **unidade** vai no payload porque o link do Google muda por unidade: Recreio e Ipanema têm
 * links diferentes. Sem ela o agente não tem como escolher.
 *
 * O cliente pediu que a pesquisa não saia depois de toda consulta, e sim depois da avaliação ou no
 * decorrer do tratamento, **só para quem ainda não avaliou**. Quem filtra isso é o workflow, com
 * uma condição em `NPS - Nota`: se o campo já está preenchido, o paciente não recebe de novo.
 * Resolver assim evita ter que adivinhar qual consulta era a avaliação, e dá o mesmo resultado:
 * cada paciente é convidado uma vez só.
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
    await dispatch({
      type: 'nps',
      phone: a.mobilePhone,
      name: a.patientName,
      ...(a.unit !== undefined ? { unit: a.unit } : {}),
    });
    sent++;
  }
  return sent;
}

/**
 * Cuidado no dia seguinte a cirurgia, extração ou canal (aprovada pelo cliente em 11/11/2026).
 * Mesma leitura da pesquisa de satisfação — consulta ATENDIDA na data-alvo — filtrando pelos
 * procedimentos cirúrgicos. Vale para adulto e infantil, e o workflow escolhe o texto pela trilha.
 *
 * `date` = a data-alvo (ontem).
 */
export async function runPosCirurgia(
  clinicorp: ClinicorpClient,
  dispatch: ReguaDispatcher,
  date: string,
): Promise<number> {
  const statuses = await clinicorp.listAppointmentStatuses();
  const checkoutId = statuses.find((s) => s.type === 'CHECKOUT')?.id;
  if (checkoutId === undefined) return 0; // sem o status mapeado, não dispara

  const appointments = await clinicorp.listAppointmentsByDate(date);
  let sent = 0;
  for (const a of appointments) {
    if (a.statusId !== checkoutId) continue; // só quem compareceu
    if (!isProcedimentoCirurgico(a.categoryDescription)) continue;
    if (!a.mobilePhone) continue;
    await dispatch({
      type: 'pos_cirurgia',
      phone: a.mobilePhone,
      name: a.patientName,
      ...(a.categoryDescription !== undefined ? { procedure: a.categoryDescription } : {}),
      ...(a.unit !== undefined ? { unit: a.unit } : {}),
    });
    sent++;
  }
  return sent;
}
