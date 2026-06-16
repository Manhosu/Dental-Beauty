import type { ChatbotifyClient, OutboundMessage } from './types';
import { ExternalApiError } from '../../lib/errors';
import { withRetry } from '../../lib/retry';

export interface ChatbotifyConfig {
  baseUrl: string;
  token: string;
}

// NOTA: os endpoints REST do Chatbotify ainda NÃO foram confirmados (plataforma é no-code/Flow Builder).
// Esta implementação assume um contrato REST plausível com Bearer token; AJUSTAR quando a API real for confirmada (spike 2).
export class HttpChatbotifyClient implements ChatbotifyClient {
  constructor(
    private readonly config: ChatbotifyConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async request(path: string, body: unknown): Promise<unknown> {
    return withRetry(async () => {
      const res = await this.fetchFn(`${this.config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new ExternalApiError(`Chatbotify POST ${path} -> ${res.status}`, res.status);
      }
      return res.json().catch(() => ({}));
    });
  }

  async sendMessage(msg: OutboundMessage): Promise<{ messageId: string }> {
    const data = (await this.request('/messages', msg)) as { id?: string; messageId?: string };
    return { messageId: String(data.messageId ?? data.id ?? '') };
  }

  async suppressBot(conversationId: string): Promise<void> {
    await this.request('/bot/suppress', { conversationId });
  }

  async resumeBot(conversationId: string): Promise<void> {
    await this.request('/bot/resume', { conversationId });
  }
}
