import type { SonaxCrmPort } from '../sonax/sonax';
import { ExternalApiError } from '../../lib/errors';
import { withRetry } from '../../lib/retry';

/**
 * Cliente da API REST do Chatbotify (CRM). Confirmado na doc oficial (Postman) + testado ao vivo:
 *   base:    https://webhook.chatbotify.com.br/webhook/api_chatbotify
 *   headers: id (UUID da conta WhatsApp) + api_token
 *   criar/atualizar contato: POST /contatos/post  (é upsert por phone_number; resposta vem VAZIA)
 *   corpo: { whatsapp_account_id, phone_number, observations, name? }
 *
 * As respostas dos webhooks (n8n) vêm 200 sem corpo — por isso não dá pra recuperar id; o upsert
 * numa chamada só resolve (cria se novo, atualiza se já existe pelo telefone).
 */
export interface ChatbotifyCrmConfig {
  baseUrl: string; // ex.: https://webhook.chatbotify.com.br/webhook/api_chatbotify
  accountId: string; // header `id` E body `whatsapp_account_id` (mesmo UUID da conta WhatsApp)
  apiToken: string; // header `api_token`
}

export class ChatbotifyCrmClient implements SonaxCrmPort {
  constructor(
    private readonly config: ChatbotifyCrmConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async request(path: string, method: 'GET' | 'POST' | 'PATCH', body?: unknown): Promise<void> {
    await withRetry(async () => {
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
    });
  }

  async upsertContactWithNote(phone: string, note: string, name?: string): Promise<void> {
    await this.request('/contatos/post', 'POST', {
      whatsapp_account_id: this.config.accountId,
      phone_number: phone,
      observations: note,
      ...(name ? { name } : {}),
    });
  }
}
