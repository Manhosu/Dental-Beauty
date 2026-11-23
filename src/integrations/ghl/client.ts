import type { SonaxCrmPort } from '../sonax/sonax';
import { ExternalApiError } from '../../lib/errors';
import { withRetry } from '../../lib/retry';

/**
 * Cliente da API v2 do GoHighLevel. Substitui o `ChatbotifyCrmClient` depois da migração de
 * plataforma (2026-08). Contrato confirmado na doc oficial:
 *   base:    https://services.leadconnectorhq.com
 *   headers: Authorization: Bearer <Private Integration token> + Version: 2021-07-28
 *   upsert:  POST /contacts/upsert  { locationId, phone, name? } → { contact: { id } }
 *   nota:    POST /contacts/{contactId}/notes  { body }
 *
 * Diferença importante para o Chatbotify: lá o upsert e a observação iam numa chamada só e a
 * resposta vinha vazia. Aqui o upsert DEVOLVE o id do contato, então a nota é uma segunda chamada —
 * e por isso conseguimos anexar várias notas ao mesmo paciente sem sobrescrever nada.
 */
export interface GoHighLevelConfig {
  baseUrl: string;
  locationId: string;
  token: string;
  apiVersion?: string;
}

/** Resposta do upsert — só o que precisamos. */
interface UpsertResponse {
  contact?: { id?: string };
  id?: string;
}

/** Campo personalizado no formato que o upsert aceita (`field_value`, não `value`). */
export interface GhlCustomField {
  id: string;
  field_value: string;
}

/**
 * Leitura do contato — só o que precisamos. Na leitura o GHL devolve o campo personalizado como
 * `value`; no upsert ele exige `field_value`. Aceitamos os dois para não depender disso.
 */
interface ContactReadResponse {
  contact?: {
    customFields?: Array<{ id?: string; value?: unknown; field_value?: unknown }>;
  };
}

const DEFAULT_VERSION = '2021-07-28';

export class GoHighLevelCrmClient implements SonaxCrmPort {
  constructor(
    private readonly config: GoHighLevelConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.token}`,
      Version: this.config.apiVersion ?? DEFAULT_VERSION,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    return withRetry(async () => {
      const res = await this.fetchFn(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new ExternalApiError(`GoHighLevel POST ${path} -> ${res.status}`, res.status);
      }
      return (await res.json().catch(() => ({}))) as T;
    });
  }

  /** GET autenticado. O resto do cliente escreve; a leitura do contato é a única leitura. */
  private async get<T>(path: string): Promise<T> {
    return withRetry(async () => {
      const res = await this.fetchFn(`${this.config.baseUrl}${path}`, {
        method: 'GET',
        headers: this.headers(),
      });
      if (!res.ok) {
        throw new ExternalApiError(`GoHighLevel GET ${path} -> ${res.status}`, res.status);
      }
      return (await res.json().catch(() => ({}))) as T;
    });
  }

  /**
   * Lê um campo personalizado do contato.
   *
   * Existe por causa da liberação de horário: o workflow do GHL não consegue mandar o campo
   * personalizado no corpo do webhook, então o backend vai buscar o valor a partir do id do
   * contato. Ver `src/http/routes/reguas.ts`.
   */
  async getContactField(contactId: string, fieldId: string): Promise<string | undefined> {
    const data = await this.get<ContactReadResponse>(`/contacts/${contactId}`);
    const campo = (data.contact?.customFields ?? []).find((c) => c.id === fieldId);
    const valor = campo?.value ?? campo?.field_value;
    if (typeof valor === 'string') return valor.trim() || undefined;
    if (typeof valor === 'number' && Number.isFinite(valor)) return String(valor);
    return undefined;
  }

  /**
   * Cria ou atualiza o contato pelo telefone e devolve o id. O GHL decide entre criar e atualizar
   * conforme a configuração de duplicidade da location — mesmo comportamento que já esperávamos.
   */
  async upsertContact(phone: string, name?: string): Promise<string> {
    const data = await this.request<UpsertResponse>('/contacts/upsert', {
      locationId: this.config.locationId,
      phone,
      ...(name ? { name } : {}),
    });
    const id = data.contact?.id ?? data.id;
    if (!id) {
      throw new ExternalApiError('GoHighLevel não devolveu o id do contato no upsert', 502);
    }
    return id;
  }

  /**
   * Upsert com campos personalizados, usado pelas réguas para gravar no contato os dados que o
   * texto da mensagem vai interpolar (trilha, nome da criança, procedimento...).
   *
   * **Nunca manda `tags` aqui.** A doc do GHL é explícita: o campo `tags` do upsert *sobrescreve*
   * todas as tags do contato. Como a consultoria usa tags para segmentar os disparos deles
   * (`disparocrianca-n2-11/26` e afins), mandar tags neste corpo apagaria o trabalho deles em todo
   * paciente que a régua tocasse. Tag se adiciona pelo endpoint próprio: `addTags`.
   */
  async upsertContactWithFields(input: {
    phone: string;
    name?: string;
    customFields?: GhlCustomField[];
  }): Promise<string> {
    const data = await this.request<UpsertResponse>('/contacts/upsert', {
      locationId: this.config.locationId,
      phone: input.phone,
      ...(input.name ? { name: input.name } : {}),
      ...(input.customFields?.length ? { customFields: input.customFields } : {}),
    });
    const id = data.contact?.id ?? data.id;
    if (!id) {
      throw new ExternalApiError('GoHighLevel não devolveu o id do contato no upsert', 502);
    }
    return id;
  }

  /** Acrescenta tags ao contato sem remover as que já existem. */
  async addTags(contactId: string, tags: string[]): Promise<void> {
    if (tags.length === 0) return;
    await this.request(`/contacts/${contactId}/tags`, { tags });
  }

  /** Anexa uma nota ao contato (histórico da ligação do discador). */
  async addNote(contactId: string, note: string): Promise<void> {
    await this.request(`/contacts/${contactId}/notes`, { body: note });
  }

  /**
   * Implementação da porta usada pelo webhook do Sonax: acha/cria o paciente pelo telefone e
   * registra a ligação. `name` só é enviado quando existe, para não sobrescrever o nome de um
   * paciente já cadastrado com o identificador cru do discador.
   */
  async upsertContactWithNote(phone: string, note: string, name?: string): Promise<void> {
    const contactId = await this.upsertContact(phone, name);
    await this.addNote(contactId, note);
  }
}
