import type { GhlCustomField, GoHighLevelCrmClient } from '../../integrations/ghl/client';
import type { ReguaDispatcher, ReguaPayload } from './dispatcher';

/**
 * Dispatcher das réguas para o **GoHighLevel** via **tag no contato**.
 *
 * Substitui o `ghlDispatcher` (Inbound Webhook). Motivo: no painel do cliente o gatilho
 * "Webhook recebido" é marcado como **acionador premium** e o GHL cobra por execução. Como as
 * réguas rodam todo dia, isso viraria custo recorrente na conta da clínica. O gatilho
 * "Tag de contato" não cobra, e é o mesmo padrão que a consultoria já usa nos disparos dela.
 *
 * Fluxo de cada envio:
 *   1. upsert do contato pelo telefone, gravando nos campos personalizados os dados que o texto
 *      da mensagem interpola (trilha, nome da criança, procedimento);
 *   2. `POST /contacts/{id}/tags` com a tag da régua — é isso que dispara o workflow.
 *
 * A tag carrega só o que decide **qual workflow** roda. O que decide qual *texto* dentro do
 * workflow (trilha adulto/infantil, procedimento) vai em campo personalizado, para o workflow
 * ramificar com `{{contact.*}}`.
 */

/** Ids dos campos personalizados da location (ver `docs/ghl-custom-fields.json`). */
export interface GhlReguaFieldIds {
  trilha: string;
  nomeCrianca: string;
  ultimoProcedimento: string;
  /** Unidade do atendimento. A pesquisa de satisfação usa para escolher o link do Google certo. */
  unidade: string;
  /** Dia da consulta, já formatado para o texto da confirmação. */
  reguaDia: string;
  /** Hora da consulta, já formatada para o texto da confirmação. */
  reguaHora: string;
  /**
   * Link pessoal da ficha de anamnese. Opcional: enquanto o campo não existir na location, a régua
   * da anamnese grava o resto e o workflow simplesmente não tem o que interpolar.
   */
  anamneseLink?: string | undefined;
}

export interface GhlTagDispatcherConfig {
  client: Pick<GoHighLevelCrmClient, 'upsertContactWithFields' | 'addTags'>;
  fields: GhlReguaFieldIds;
}

/**
 * Tag que dispara o workflow. Prefixo `regua-` para não colidir com as tags da consultoria
 * (`disparo*`, `convite*`). Reengajamento separa 6 e 12 meses porque são textos diferentes e
 * convém poder ligar um sem o outro.
 */
export function tagForPayload(payload: ReguaPayload): string {
  if (payload.type === 'inatividade') {
    return `regua-inatividade-${payload.months ?? 12}`;
  }
  const porTipo: Record<Exclude<ReguaPayload['type'], 'inatividade'>, string> = {
    aniversario: 'regua-aniversario',
    no_show: 'regua-confirmacao',
    lembrete_hoje: 'regua-lembrete-hoje',
    pos_procedimento: 'regua-posprocedimento',
    nps: 'regua-nps',
    pos_cirurgia: 'regua-poscirurgia',
    anamnese: 'regua-anamnese',
    anamnese_lembrete: 'regua-anamnese-lembrete',
  };
  return porTipo[payload.type];
}

/**
 * O campo "Trilha" no GHL é de opção única e as opções cadastradas são **"Adulto"** e
 * **"Infantil"**, com inicial maiúscula. A API aceita qualquer string no valor, mas a condição do
 * workflow compara com a opção — gravar minúsculo faria todo mundo cair no ramo "Sem trilha" e
 * ninguém receberia mensagem. Por isso a conversão aqui.
 */
function trilhaParaOpcaoGhl(track: ReguaPayload['track']): string {
  return track === 'infantil' ? 'Infantil' : 'Adulto';
}

/**
 * Mesma história do campo "Unidade": as opções cadastradas são **"Recreio"** e **"Ipanema"**.
 * A Clinicorp devolve o nome da unidade em formatos variados ("DENTAL BEAUTY RECREIO", "recreio"),
 * então normalizamos. Sem casar com a opção, a pesquisa de satisfação não consegue escolher o link
 * do Google certo — cada unidade tem o seu.
 */
export function unidadeParaOpcaoGhl(unit: string | undefined): string | undefined {
  if (!unit) return undefined;
  const normalizado = unit
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (normalizado.includes('recreio')) return 'Recreio';
  if (normalizado.includes('ipanema')) return 'Ipanema';
  return undefined;
}

/**
 * Dia da consulta no formato que vai no texto ("12/11"). A Clinicorp devolve a data em ISO
 * ("2026-11-12T03:00:00.000Z") ou já como YYYY-MM-DD; os dois casos entram aqui.
 *
 * Lê a data **em UTC de propósito**: o campo da Clinicorp vem com o fuso embutido e converter de
 * novo mudaria o dia da consulta para quem é atendido de manhã cedo.
 */
export function diaParaTexto(date: string | undefined): string | undefined {
  if (!date) return undefined;
  const d = new Date(date.length === 10 ? `${date}T12:00:00Z` : date);
  if (Number.isNaN(d.getTime())) return undefined;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/** Hora da consulta normalizada para HH:mm ("9:00" vira "09:00"). */
export function horaParaTexto(fromTime: string | undefined): string | undefined {
  if (!fromTime) return undefined;
  const m = /^(\d{1,2}):(\d{2})/.exec(fromTime.trim());
  if (!m) return undefined;
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}

/** Campos personalizados a gravar no contato antes de marcar a tag. */
export function buildCustomFields(
  payload: ReguaPayload,
  ids: GhlReguaFieldIds,
): GhlCustomField[] {
  const campos: GhlCustomField[] = [
    { id: ids.trilha, field_value: trilhaParaOpcaoGhl(payload.track) },
  ];
  if (payload.childName) {
    campos.push({ id: ids.nomeCrianca, field_value: payload.childName });
  }
  if (payload.procedure) {
    campos.push({ id: ids.ultimoProcedimento, field_value: payload.procedure });
  }
  const unidade = unidadeParaOpcaoGhl(payload.unit);
  if (unidade) {
    campos.push({ id: ids.unidade, field_value: unidade });
  }
  const dia = diaParaTexto(payload.date);
  if (dia) {
    campos.push({ id: ids.reguaDia, field_value: dia });
  }
  const hora = horaParaTexto(payload.fromTime);
  if (hora) {
    campos.push({ id: ids.reguaHora, field_value: hora });
  }
  if (ids.anamneseLink && payload.anamneseLink) {
    campos.push({ id: ids.anamneseLink, field_value: payload.anamneseLink });
  }
  return campos;
}

export function createGhlTagDispatcher(cfg: GhlTagDispatcherConfig): ReguaDispatcher {
  return async (payload: ReguaPayload): Promise<void> => {
    const contactId = await cfg.client.upsertContactWithFields({
      phone: payload.phone.replace(/\D/g, ''),
      ...(payload.name ? { name: payload.name } : {}),
      customFields: buildCustomFields(payload, cfg.fields),
    });
    await cfg.client.addTags(contactId, [tagForPayload(payload)]);
  };
}
