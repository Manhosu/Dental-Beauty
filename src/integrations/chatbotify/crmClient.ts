import type { SonaxCrmPort } from '../sonax/sonax';
import { ExternalApiError } from '../../lib/errors';
import { withRetry } from '../../lib/retry';

/**
 * Cliente da API REST do Chatbotify (CRM). Base e headers confirmados na doc pública (Postman):
 *   base: https://webhook.chatbotify.com.br/webhook/api_chatbotify
 *   headers: id (UUID da conta WhatsApp) + api_token
 *   endpoints: /contatos/get, /contatos/post, /contatos/patch, /pipeline_contacts
 *
 * ⚠️ Os NOMES EXATOS dos campos de request/response não estão 100% documentados publicamente —
 * validar contra a API real (a doc do Postman mostra a estrutura das tabelas, não todos os payloads).
 * Por isso `parseContactId` é tolerante a vários formatos de resposta.
 */
export interface ChatbotifyCrmConfig {
  baseUrl: string; // ex.: https://webhook.chatbotify.com.br/webhook/api_chatbotify
  accountId: string; // header `id`
  apiToken: string; // header `api_token`
}

type Json = Record<string, unknown>;

/** Extrai um id de contato de respostas em formatos variados (dados[].data[].id, data.id, id...). */
export function parseContactId(payload: unknown): string | undefined {
  const visit = (node: unknown, depth: number): string | undefined => {
    if (node == null || depth > 6) return undefined;
    if (Array.isArray(node)) {
      for (const n of node) {
        const r = visit(n, depth + 1);
        if (r) return r;
      }
      return undefined;
    }
    if (typeof node === 'object') {
      const obj = node as Json;
      if (obj.id != null && (typeof obj.id === 'string' || typeof obj.id === 'number')) {
        return String(obj.id);
      }
      for (const k of Object.keys(obj)) {
        const r = visit(obj[k], depth + 1);
        if (r) return r;
      }
    }
    return undefined;
  };
  return visit(payload, 0);
}

export class ChatbotifyCrmClient implements SonaxCrmPort {
  constructor(
    private readonly config: ChatbotifyCrmConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async request(path: string, method: 'GET' | 'POST' | 'PATCH', body?: unknown): Promise<unknown> {
    return withRetry(async () => {
      const res = await this.fetchFn(`${this.config.baseUrl}${path}`, {
        method,
        headers: {
          id: this.config.accountId,
          api_token: this.config.apiToken,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        throw new ExternalApiError(`Chatbotify CRM ${method} ${path} -> ${res.status}`, res.status);
      }
      return res.json().catch(() => ({}));
    });
  }

  async findOrCreateContactByPhone(
    phone: string,
    name?: string,
  ): Promise<{ contactId: string; created: boolean }> {
    // 1) busca por telefone
    const found = await this.request('/contatos/get', 'POST', { telefone: phone, numero: phone });
    const existingId = parseContactId(found);
    if (existingId) return { contactId: existingId, created: false };

    // 2) não achou → cria
    const created = await this.request('/contatos/post', 'POST', {
      telefone: phone,
      numero: phone,
      ...(name ? { nome: name } : {}),
    });
    const newId = parseContactId(created);
    if (!newId) {
      throw new ExternalApiError('Chatbotify CRM: contato criado sem id na resposta', 502);
    }
    return { contactId: newId, created: true };
  }

  async addCallNote(contactId: string, note: string): Promise<void> {
    await this.request('/contatos/patch', 'PATCH', {
      id: contactId,
      // acumula na observação do contato (a API deve concatenar/atualizar conforme o campo real).
      observacoes: note,
    });
  }
}
