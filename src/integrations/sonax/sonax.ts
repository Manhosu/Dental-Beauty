import { z } from 'zod';

/**
 * Integração com o discador Sonax (SONAVOIP). O Sonax chama o nosso webhook (GET com query params)
 * nos eventos de ATENDIMENTO e DESLIGAMENTO de uma ligação de campanha. Contrato (2026-07):
 *   ?ID_CHAMADA=&ID_CHAMADA_ORIGINADOR=&RAMAL=&ALIASRAMAL=&NUMERO=&NUMERO_REC=
 *    &DATA_INICIO=&DATA_FIM=&STATUS_CHAMADA=&STATUS_ATENDIMENTO=&DURACAO_CHAMADA=&URL_GRAVACAO=
 * Doc: https://conteudo.sonax.net.br/kb/pt-br/article/159253/api-de-integracao-de-voz
 */

/** Só os dígitos de um telefone (chave de identidade do contato). */
export function digits(v: string | undefined): string {
  return (v ?? '').replace(/\D/g, '');
}

/** Trata "", placeholders "<NUMERO>" e espaços como ausência de valor. */
function clean(v: string | undefined): string | undefined {
  const t = (v ?? '').trim();
  if (!t || /^<.*>$/.test(t)) return undefined;
  return t;
}

/** Query params crus do Sonax. NUMERO e ID_CHAMADA são obrigatórios; o resto é opcional. */
export const sonaxQuerySchema = z.object({
  ID_CHAMADA: z.string().min(1),
  ID_CHAMADA_ORIGINADOR: z.string().optional(),
  RAMAL: z.string().optional(),
  ALIASRAMAL: z.string().optional(),
  NUMERO: z.string().min(1),
  NUMERO_REC: z.string().optional(),
  DATA_INICIO: z.string().optional(),
  DATA_FIM: z.string().optional(),
  STATUS_CHAMADA: z.string().optional(),
  STATUS_ATENDIMENTO: z.string().optional(),
  DURACAO_CHAMADA: z.string().optional(),
  URL_GRAVACAO: z.string().optional(),
  // Token compartilhado que colocamos na URL configurada no painel Sonax (autenticação simples).
  token: z.string().optional(),
});

export type SonaxQuery = z.infer<typeof sonaxQuerySchema>;

/** Evento normalizado de uma ligação do discador. */
export interface SonaxCallEvent {
  callId: string;
  phone: string; // NUMERO (do paciente), só dígitos
  phase: 'answered' | 'ended';
  originatorCallId?: string;
  ramal?: string;
  aliasRamal?: string;
  numberReceived?: string;
  startedAt?: string;
  endedAt?: string;
  callStatus?: string;
  answerStatus?: string;
  durationSec?: number;
  recordingUrl?: string;
}

/** Normaliza os params crus num evento. `ended` quando DATA_FIM veio preenchida (desligamento). */
export function normalizeSonaxEvent(q: SonaxQuery): SonaxCallEvent {
  const endedAt = clean(q.DATA_FIM);
  const durRaw = clean(q.DURACAO_CHAMADA);
  const durNum = durRaw !== undefined ? Number(durRaw.replace(/[^\d]/g, '')) : NaN;
  const optionals: Partial<SonaxCallEvent> = {
    originatorCallId: clean(q.ID_CHAMADA_ORIGINADOR),
    ramal: clean(q.RAMAL),
    aliasRamal: clean(q.ALIASRAMAL),
    numberReceived: clean(q.NUMERO_REC),
    startedAt: clean(q.DATA_INICIO),
    endedAt,
    callStatus: clean(q.STATUS_CHAMADA),
    answerStatus: clean(q.STATUS_ATENDIMENTO),
    durationSec: Number.isFinite(durNum) ? durNum : undefined,
    recordingUrl: clean(q.URL_GRAVACAO),
  };
  // Remove as chaves undefined (compat com exactOptionalPropertyTypes).
  for (const k of Object.keys(optionals) as (keyof SonaxCallEvent)[]) {
    if (optionals[k] === undefined) delete optionals[k];
  }
  return {
    callId: q.ID_CHAMADA,
    phone: digits(q.NUMERO),
    phase: endedAt !== undefined ? 'ended' : 'answered',
    ...optionals,
  };
}

/** Porta de CRM que o handler usa. Implementada pelo ChatbotifyCrmClient (ou um mock nos testes). */
export interface SonaxCrmPort {
  /** Acha o contato pelo telefone; cria se não existir. */
  findOrCreateContactByPhone(phone: string, name?: string): Promise<{ contactId: string; created: boolean }>;
  /** Registra a ligação no contato (observação/nota). */
  addCallNote(contactId: string, note: string): Promise<void>;
}

/** Texto da nota registrada no contato a partir do evento. */
export function buildCallNote(e: SonaxCallEvent): string {
  const partes = [
    `[Ligação Sonax] ${e.phase === 'ended' ? 'encerrada' : 'atendida'}`,
    e.answerStatus ? `status: ${e.answerStatus}` : undefined,
    e.callStatus ? `chamada: ${e.callStatus}` : undefined,
    e.startedAt ? `início: ${e.startedAt}` : undefined,
    e.endedAt ? `fim: ${e.endedAt}` : undefined,
    e.durationSec !== undefined ? `duração: ${e.durationSec}s` : undefined,
    e.recordingUrl ? `gravação: ${e.recordingUrl}` : undefined,
    `id: ${e.callId}`,
  ].filter(Boolean);
  return partes.join(' · ');
}

/**
 * Orquestra o que fazer quando o Sonax avisa de uma ligação: encontra/cria o paciente pelo telefone
 * e registra a ligação (status, duração, gravação) no contato do CRM. A movimentação de etapa do
 * funil fica de fora por ora (as etapas de ligação ainda não foram definidas com o cliente).
 */
export async function handleSonaxCall(
  event: SonaxCallEvent,
  crm: SonaxCrmPort,
): Promise<{ contactId: string; created: boolean; noted: boolean }> {
  const { contactId, created } = await crm.findOrCreateContactByPhone(event.phone);
  await crm.addCallNote(contactId, buildCallNote(event));
  return { contactId, created, noted: true };
}
