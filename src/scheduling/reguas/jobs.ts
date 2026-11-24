import type { ClinicorpClient } from '../../integrations/clinicorp/types';
import type { ReguaDispatcher } from './dispatcher';
import { visitaPedePesquisa, type VisitCounter } from './visitCounter';
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
 * Varre a agenda de uma data e dispara um aviso por paciente. Serve as duas réguas de lembrete,
 * que leem a mesma coisa e mudam só o texto — por isso o `type` entra como parâmetro.
 */
async function runLembreteAgenda(
  clinicorp: ClinicorpClient,
  dispatch: ReguaDispatcher,
  date: string,
  type: 'no_show' | 'lembrete_hoje',
): Promise<number> {
  const appointments = await clinicorp.listAppointmentsByDate(date);
  let sent = 0;
  for (const a of appointments) {
    if (!a.mobilePhone) continue;
    await dispatch({
      type,
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

/**
 * Régua de confirmação: para cada agendamento da data alvo, pede confirmação de presença.
 * Roda com **96h de antecedência** (`CONFIRMACAO_DIAS_ANTES`) — o cliente mudou de 24h para 4 dias
 * em 12/11/2026, para dar tempo de remarcar a vaga quando o paciente responde NÃO.
 */
export async function runNoShow(
  clinicorp: ClinicorpClient,
  dispatch: ReguaDispatcher,
  date: string,
): Promise<number> {
  return runLembreteAgenda(clinicorp, dispatch, date, 'no_show');
}

/** Quantos dias inteiros separam a marcação da consulta. `undefined` quando não dá para saber. */
export function antecedenciaEmDias(createdAt?: string, appointmentDate?: string): number | undefined {
  if (!createdAt || !appointmentDate) return undefined;
  const criado = Date.parse(createdAt);
  const consulta = Date.parse(appointmentDate);
  if (Number.isNaN(criado) || Number.isNaN(consulta)) return undefined;
  // Compara só a data, em UTC: a hora da marcação não deve mudar o bucket.
  const diaDe = (ms: number): number => Math.floor(ms / 86_400_000);
  return diaDe(consulta) - diaDe(criado);
}

/**
 * Em quantos dias antes da consulta o SIM deve ser pedido — ou `null` para não pedir.
 *
 * Regra da cliente em 17/11/2026, que existe para **liberar a vaga a tempo de chamar outro
 * paciente**:
 *
 * - marcou com **6 dias ou mais** de antecedência → confirma no **D-4**;
 * - marcou de **5 a 3 dias** antes → o D-4 já passou ou cai no dia seguinte à marcação, então vale
 *   a regra dos 2 dias: confirma no **D-2**;
 * - marcou com **2 dias ou menos** → não confirma: a própria mensagem do agendamento já serviu de
 *   confirmação, e um segundo pedido no mesmo par de dias vira incômodo.
 *
 * Sem `CreateDate` na agenda caímos no D-4, que era o comportamento antes desta regra.
 */
export function diasAntesDaConfirmacao(antecedencia?: number): 4 | 2 | null {
  if (antecedencia === undefined) return 4;
  if (antecedencia >= 6) return 4;
  if (antecedencia >= 3) return 2;
  return null;
}

/** As duas janelas em que a confirmação pode cair. Da mais distante para a mais próxima. */
export const CONFIRMACAO_JANELAS = [4, 2] as const;

/**
 * Régua de confirmação com a regra de antecedência (17/11/2026). Varre as duas janelas (D-4 e D-2)
 * e, em cada agendamento, só dispara se aquela for a janela certa para como ele foi marcado.
 *
 * `targetDate(diasAntes)` devolve a data alvo de cada janela a partir de hoje.
 */
export async function runConfirmacao(
  clinicorp: ClinicorpClient,
  dispatch: ReguaDispatcher,
  targetDate: (diasAntes: number) => string,
): Promise<number> {
  let sent = 0;
  let pulados = 0;

  for (const janela of CONFIRMACAO_JANELAS) {
    const appointments = await clinicorp.listAppointmentsByDate(targetDate(janela));
    for (const a of appointments) {
      if (!a.mobilePhone) continue;
      const janelaCerta = diasAntesDaConfirmacao(antecedenciaEmDias(a.createdAt, a.date));
      if (janelaCerta !== janela) {
        if (janelaCerta === null) pulados++;
        continue;
      }
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
  }

  if (pulados > 0) {
    logger.info({ sent, pulados }, 'confirmação: marcados em cima da hora não recebem o pedido de SIM');
  }
  return sent;
}

/**
 * Lembrete da manhã: às 7h30 avisa todo mundo que tem consulta **hoje** (decisão do cliente em
 * 12/11/2026, no lugar do lembrete de 2h antes, que não cabia numa varredura diária).
 *
 * `date` = hoje. É a mesma leitura da confirmação, com texto próprio ("sua consulta é hoje, às X").
 */
export async function runLembreteHoje(
  clinicorp: ClinicorpClient,
  dispatch: ReguaDispatcher,
  date: string,
): Promise<number> {
  return runLembreteAgenda(clinicorp, dispatch, date, 'lembrete_hoje');
}

/** Meses distintos da tabela de retorno do escopo (réguas-e-campanhas.md). */
export const POST_PROCEDURE_INTERVALS = [3, 6, 12] as const;

/**
 * O que o paciente fez, na melhor fonte disponível no agendamento.
 *
 * `Procedures` é o campo estruturado: sai da tabela de preços e, quando o agendamento está ligado a
 * um orçamento aprovado, vem com o nome completo do procedimento ("22 - Tratamento endodôntico 1
 * canal"), o dente e o marcador de executado. É a fonte certa — não tem erro de digitação.
 *
 * `CategoryDescription` é a categoria livre da agenda ("Consulta", "Limpeza", "Avaliação Recreio").
 * Serve de reserva porque hoje é o único campo que a recepção preenche com regularidade.
 *
 * Medido em 13/11/2026 sobre 309 agendamentos (13/10–13/11): `Procedures` preenchido em **3**.
 * A ordem está certa mesmo assim — no dia em que a clínica começar a vincular o procedimento ao
 * agendamento, a régua passa a acertar sozinha, sem mudar uma linha.
 */
export function procedimentoDoAtendimento(appointment: {
  procedures?: string;
  categoryDescription?: string;
}): string | undefined {
  const estruturado = appointment.procedures?.trim();
  if (estruturado) return estruturado;
  return appointment.categoryDescription;
}

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
 * Radicais que o workflow de retorno usa nos ramos "Contém" do campo `Último Procedimento`
 * (ver docs/ghl/mensagens-para-colar.md § Como ficou o retorno pós-procedimento). Mantidos sem
 * acento porque `temTextoDeRetorno` normaliza antes de casar.
 */
export const RADICAIS_RETORNO = [
  'limpeza',
  'clareamento',
  'restaura',
  'canal',
  'tese', // "Prótese" — "Coroa" sozinho não casa, ver aviso no doc
  'implante',
  'periodont',
  'ortodontia',
  'invisalign',
  'lente',
] as const;

/**
 * A categoria da agenda tem algum texto de retorno correspondente?
 *
 * **Por que existe.** A Clinicorp devolve `CategoryDescription` como texto livre de agenda, não como
 * especialidade nem como procedimento executado. Em 30 dias de agenda real (13/10–13/11/2026, 309
 * agendamentos) metade era só "Consulta" e o campo `Procedures` veio vazio em 306 dos 309. Sem este
 * filtro, `intervalMonthsForCategory` joga todo mundo no bucket de 6 meses pelo default e a régua
 * manda ~150 contatos por mês para o GHL só para o workflow descartar no ramo "Procedimento nao
 * mapeado". Gasta chamada de API e suja o contato à toa.
 *
 * Casar aqui com os mesmos radicais do painel mantém os dois lados com a mesma resposta.
 */
export function temTextoDeRetorno(category?: string): boolean {
  const c = (category ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (c.trim() === '') return false;
  return RADICAIS_RETORNO.some((radical) => c.includes(radical));
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
      const procedimento = procedimentoDoAtendimento(a);
      if (!temTextoDeRetorno(procedimento)) continue; // sem texto, nem chega no GHL
      if (intervalMonthsForCategory(procedimento) !== months) continue; // bucket certo
      if (!a.mobilePhone) continue;
      await dispatch({
        type: 'pos_procedimento',
        phone: a.mobilePhone,
        name: a.patientName,
        date: a.date,
        ...(procedimento !== undefined ? { procedure: procedimento } : {}),
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
 * A escala é de **0 a 5** ("o quanto você indicaria a Dental Beauty"), decisão do cliente em
 * 12/11/2026. Nota 5 recebe o convite para avaliar no Google; 4 leva a pergunta "o que faltou para
 * ser 5?"; de 0 a 3 entra um atendente humano. Quem responde o agente trata — aqui só disparamos a
 * pergunta.
 *
 * A **unidade** vai no payload porque o link do Google muda por unidade: Recreio e Ipanema têm
 * links diferentes. Sem ela o agente não tem como escolher.
 *
 * **Frequência:** o cliente vetou o envio depois de toda consulta — para quem está em tratamento,
 * a mesma pergunta a cada sessão incomoda. A régua passou a sair **a cada 3 vindas**, contadas por
 * `counter` (ver `visitCounter.ts`). Sem `counter` o comportamento antigo continua valendo, que é
 * o que o caminho legado do Chatbotify usa.
 */
export async function runNps(
  clinicorp: ClinicorpClient,
  dispatch: ReguaDispatcher,
  date: string,
  counter?: VisitCounter,
): Promise<number> {
  const statuses = await clinicorp.listAppointmentStatuses();
  const checkoutId = statuses.find((s) => s.type === 'CHECKOUT')?.id;
  if (checkoutId === undefined) return 0;

  const appointments = await clinicorp.listAppointmentsByDate(date);
  let sent = 0;
  let pulados = 0;
  for (const a of appointments) {
    if (a.statusId !== checkoutId) continue; // só quem compareceu
    if (!a.mobilePhone) continue;
    // Sem contador, todo mundo cai no texto da primeira consulta — é o comportamento antigo.
    let emTratamento = false;
    if (counter) {
      const total = await counter.increment(a.mobilePhone);
      if (!visitaPedePesquisa(total)) {
        pulados++;
        continue;
      }
      // A 1ª vinda observada ganha o texto de boas-vindas; da 4ª em diante, o de acompanhamento.
      emTratamento = total > 1;
    }
    await dispatch({
      type: emTratamento ? 'nps_tratamento' : 'nps',
      phone: a.mobilePhone,
      name: a.patientName,
      ...(a.unit !== undefined ? { unit: a.unit } : {}),
    });
    sent++;
  }
  if (pulados > 0) {
    logger.info({ sent, pulados }, 'pesquisa de satisfação: fora da vez (a cada 3 vindas)');
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
    const procedimento = procedimentoDoAtendimento(a);
    if (!isProcedimentoCirurgico(procedimento)) continue;
    if (!a.mobilePhone) continue;
    await dispatch({
      type: 'pos_cirurgia',
      phone: a.mobilePhone,
      name: a.patientName,
      ...(procedimento !== undefined ? { procedure: procedimento } : {}),
      ...(a.unit !== undefined ? { unit: a.unit } : {}),
    });
    sent++;
  }
  return sent;
}
