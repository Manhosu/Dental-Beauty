import { withRetry } from '../../lib/retry';
import type { ReguaDispatcher, ReguaPayload, ReguaTrack } from './dispatcher';

/**
 * Dispatcher das réguas para o **GoHighLevel**, via gatilho "Inbound Webhook" de um workflow.
 *
 * Diferença para o Chatbotify: lá o gatilho exigia headers de autenticação (id/token/flow) e o
 * corpo era limitado a `nome`/`numero`/`observacoes`. No GHL a URL do webhook já é o segredo
 * (contém um id único por workflow) e o corpo é **JSON livre** — o workflow mapeia os campos que
 * quiser. Por isso mandamos o payload completo: o texto passa a poder usar qualquer um deles.
 *
 * Um workflow por régua (e por trilha adulto/infantil), cada um com sua própria URL.
 */
export interface GhlWebhookConfig {
  /** URL do Inbound Webhook do workflow (copiada do gatilho no GHL). */
  url: string;
}

/** Corpo enviado ao workflow. Nomes em snake_case, que é o padrão de campo do GHL. */
export interface GhlReguaBody {
  phone: string;
  name: string;
  first_name: string;
  tipo: ReguaPayload['type'];
  track: ReguaTrack;
  nome_crianca?: string;
  observacoes?: string;
  appointment_id?: string;
  data?: string;
  hora?: string;
  profissional?: string;
  unidade?: string;
  procedimento?: string;
  meses?: number;
}

/** Só o primeiro nome — é o que os textos aprovados usam ("Oi, [Nome]!"). */
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

/** Observação livre gravada junto ao contato, para contexto do atendente. */
function observacoes(p: ReguaPayload): string | undefined {
  if (p.type === 'no_show' && p.date) {
    return `Lembrete de consulta ${p.date} ${p.fromTime ?? ''} ${p.professionalName ?? ''}`.trim();
  }
  if (p.type === 'pos_procedimento') {
    return `Retorno recomendado${p.procedure ? ` (${p.procedure})` : ''}`.trim();
  }
  if (p.type === 'inatividade') {
    return `Reengajamento: sem consulta há ${p.months ?? '?'} meses`;
  }
  return undefined;
}

/** Monta o corpo enviado ao Inbound Webhook (exportado para os testes e para a doc). */
export function buildGhlBody(p: ReguaPayload): GhlReguaBody {
  const nome = p.name ?? '';
  const obs = observacoes(p);
  return {
    phone: p.phone.replace(/\D/g, ''),
    name: nome,
    first_name: primeiroNome(nome),
    tipo: p.type,
    track: p.track ?? 'adulto',
    ...(p.childName ? { nome_crianca: p.childName } : {}),
    ...(obs ? { observacoes: obs } : {}),
    ...(p.appointmentId ? { appointment_id: p.appointmentId } : {}),
    ...(p.date ? { data: p.date } : {}),
    ...(p.fromTime ? { hora: p.fromTime } : {}),
    ...(p.professionalName ? { profissional: p.professionalName } : {}),
    ...(p.unit ? { unidade: p.unit } : {}),
    ...(p.procedure ? { procedimento: p.procedure } : {}),
    ...(p.months !== undefined ? { meses: p.months } : {}),
  };
}

export function createGhlDispatcher(
  cfg: GhlWebhookConfig,
  fetchFn: typeof fetch = fetch,
): ReguaDispatcher {
  return async (payload: ReguaPayload): Promise<void> => {
    await withRetry(async () => {
      const res = await fetchFn(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildGhlBody(payload)),
      });
      if (!res.ok) {
        throw new Error(`régua GHL dispatch -> ${res.status}`);
      }
    });
  };
}
