import { withRetry } from '../../lib/retry';

/** Payload enviado por destinatário ao fluxo "Gatilho HTTP" do Chatbotify, que faz o envio no WhatsApp. */
export interface ReguaPayload {
  type: 'aniversario' | 'no_show';
  phone: string;
  name?: string;
  // Extras de no-show (lembrete de presença):
  appointmentId?: string;
  date?: string;
  fromTime?: string;
  professionalName?: string;
  unit?: string;
}

export type ReguaDispatcher = (payload: ReguaPayload) => Promise<void>;

/**
 * Dispatcher HTTP: faz POST do payload no fluxo "Gatilho HTTP" do Chatbotify (uma chamada por
 * destinatário — a iteração da lista é responsabilidade do Cron-Engine, ver README §3.4).
 */
export function createHttpDispatcher(
  webhookUrl: string,
  fetchFn: typeof fetch = fetch,
): ReguaDispatcher {
  return async (payload: ReguaPayload): Promise<void> => {
    await withRetry(async () => {
      const res = await fetchFn(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`régua dispatch -> ${res.status}`);
      }
    });
  };
}
