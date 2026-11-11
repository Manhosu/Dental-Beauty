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
    pos_procedimento: 'regua-posprocedimento',
    nps: 'regua-nps',
    pos_cirurgia: 'regua-poscirurgia',
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
