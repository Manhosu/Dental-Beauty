import { withRetry } from '../../lib/retry';

/** Payload interno por destinatário (vindo dos jobs das réguas). */
export interface ReguaPayload {
  type: 'aniversario' | 'no_show' | 'pos_procedimento' | 'nps';
  phone: string;
  name?: string;
  // Extras de no-show (lembrete de presença):
  appointmentId?: string;
  date?: string;
  fromTime?: string;
  professionalName?: string;
  unit?: string;
  // Extra de pós-procedimento (retorno): nome do procedimento/categoria atendida.
  procedure?: string;
}

export type ReguaDispatcher = (payload: ReguaPayload) => Promise<void>;

/** Credenciais do fluxo "Gatilho HTTP" do Chatbotify (vão nos headers id/token/flow). */
export interface ReguaWebhookConfig {
  url: string;
  accountId: string; // header `id`
  token: string; // header `token`
  flow: string; // header `flow` (id do fluxo)
}

/**
 * Dispatcher HTTP para o "Gatilho HTTP" do Chatbotify. Formato confirmado pelo painel do bloco:
 * - Headers: Content-Type, id (conta), token, flow (id do fluxo).
 * - Body: { nome, numero } (numero = DDI+DDD+número sem espaços). O contato é criado e o fluxo
 *   roda, enviando a mensagem configurada no bloco "Mensagem".
 * Uma chamada por destinatário (a iteração da lista é do Cron-Engine, README §3.4).
 */
export function createHttpDispatcher(
  cfg: ReguaWebhookConfig,
  fetchFn: typeof fetch = fetch,
): ReguaDispatcher {
  return async (payload: ReguaPayload): Promise<void> => {
    const numero = payload.phone.replace(/\D/g, '');
    let observacoes: string | undefined;
    if (payload.type === 'no_show' && payload.date) {
      observacoes = `Lembrete de consulta ${payload.date} ${payload.fromTime ?? ''} ${payload.professionalName ?? ''}`.trim();
    } else if (payload.type === 'pos_procedimento') {
      observacoes = `Retorno recomendado${payload.procedure ? ` (${payload.procedure})` : ''}`.trim();
    }

    await withRetry(async () => {
      const res = await fetchFn(cfg.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          id: cfg.accountId,
          token: cfg.token,
          flow: cfg.flow,
        },
        body: JSON.stringify({
          nome: payload.name ?? '',
          numero,
          ...(observacoes ? { observacoes } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error(`régua dispatch -> ${res.status}`);
      }
    });
  };
}
