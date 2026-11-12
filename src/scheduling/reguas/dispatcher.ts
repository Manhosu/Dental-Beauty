import { withRetry } from '../../lib/retry';

/** Trilha de texto da régua: os textos aprovados têm versão adulto e versão infantil. */
export type ReguaTrack = 'adulto' | 'infantil';

/** Payload interno por destinatário (vindo dos jobs das réguas). */
export interface ReguaPayload {
  type:
    | 'aniversario'
    | 'no_show'
    | 'lembrete_hoje'
    | 'pos_procedimento'
    | 'nps'
    | 'inatividade'
    | 'pos_cirurgia';
  phone: string;
  name?: string;
  /** 'adulto' (default) ou 'infantil' — o fluxo escolhe o template da trilha certa. */
  track?: ReguaTrack;
  /** Nome da criança, quando a trilha é infantil e o dado está disponível. */
  childName?: string;
  // Extras de no-show (lembrete de presença):
  appointmentId?: string;
  date?: string;
  fromTime?: string;
  professionalName?: string;
  unit?: string;
  // Extra de pós-procedimento (retorno): nome do procedimento/categoria atendida.
  procedure?: string;
  // Extra de inatividade (reengajamento): há quantos meses o paciente não vem (6 ou 12).
  months?: number;
}

export type ReguaDispatcher = (payload: ReguaPayload) => Promise<void>;

/** Credenciais do fluxo "Gatilho HTTP" do Chatbotify (vão nos headers id/token/flow). */
export interface ReguaWebhookConfig {
  url: string;
  accountId: string; // header `id`
  token: string; // header `token`
  flow: string; // header `flow` (id do fluxo)
}

/** Observação livre gravada no contato — contexto para o atendente humano. */
function buildObservacoes(payload: ReguaPayload): string | undefined {
  if ((payload.type === 'no_show' || payload.type === 'lembrete_hoje') && payload.date) {
    return `Lembrete de consulta ${payload.date} ${payload.fromTime ?? ''} ${payload.professionalName ?? ''}`.trim();
  }
  if (payload.type === 'pos_procedimento') {
    return `Retorno recomendado${payload.procedure ? ` (${payload.procedure})` : ''}`.trim();
  }
  if (payload.type === 'inatividade') {
    return `Reengajamento: sem consulta há ${payload.months ?? '?'} meses`;
  }
  return undefined;
}

/**
 * Dispatcher HTTP para o "Gatilho HTTP" do Chatbotify. Formato confirmado pelo painel do bloco:
 * - Headers: Content-Type, id (conta), token, flow (id do fluxo).
 * - Body: `{ nome, numero }` (numero = DDI+DDD+número sem espaços), mais os campos abaixo.
 *
 * Como os textos foram aprovados pela Meta como **templates** (WhatsApp Oficial), o corpo também
 * carrega as variáveis posicionais que o template espera:
 * - `var1` = nome do destinatário (adulto) ou do responsável (infantil);
 * - `var2` = nome da criança (só na trilha infantil).
 * `tipo` e `track` deixam o fluxo escolher o template certo sem precisar de um fluxo por texto.
 *
 * Uma chamada por destinatário (a iteração da lista é do Cron-Engine, README §3.4).
 */
export function createHttpDispatcher(
  cfg: ReguaWebhookConfig,
  fetchFn: typeof fetch = fetch,
): ReguaDispatcher {
  return async (payload: ReguaPayload): Promise<void> => {
    const numero = payload.phone.replace(/\D/g, '');
    const nome = payload.name ?? '';
    const observacoes = buildObservacoes(payload);
    const track: ReguaTrack = payload.track ?? 'adulto';

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
          nome,
          numero,
          tipo: payload.type,
          track,
          var1: nome,
          ...(payload.childName ? { var2: payload.childName } : {}),
          ...(observacoes ? { observacoes } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error(`régua dispatch -> ${res.status}`);
      }
    });
  };
}
