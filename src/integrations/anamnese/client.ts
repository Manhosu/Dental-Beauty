import { ExternalApiError } from '../../lib/errors';
import { withRetry, type RetryOptions } from '../../lib/retry';

/**
 * Integração com a anamnese online do OdontoBI (spec da clínica, 17/11/2026).
 *
 * O fluxo tem duas chamadas: no D-2 a régua **cria o link** da ficha de saúde e manda ao paciente;
 * no D-1 ela **pergunta se já respondeu** e, só em caso negativo, lembra uma vez.
 *
 * **A IA nunca recebe as respostas** — são dados de saúde e ficam com a clínica. O que volta é
 * apenas o link e o booleano `respondido`. Por isso nada aqui loga corpo de resposta.
 */

/** Formulários disponíveis. Mandar um código fora desta lista devolve 400. */
export const ESPECIALIDADES_ANAMNESE = [
  'odontopediatria',
  'ortodontia',
  'implante',
  'protese',
  'lentes',
  'endodontia',
  'clinico_geral',
] as const;

export type EspecialidadeAnamnese = (typeof ESPECIALIDADES_ANAMNESE)[number];

/** Default da spec: "é também o padrão quando a especialidade não está clara". */
export const ESPECIALIDADE_PADRAO: EspecialidadeAnamnese = 'clinico_geral';

export interface AnamneseLink {
  id: string;
  link: string;
  especialidade: string;
  expiraEm: string;
  /** `true` quando o OdontoBI devolveu um link que já existia para o mesmo paciente/especialidade. */
  reaproveitado: boolean;
  respondido: boolean;
  respondidoEm: string | null;
  /** `true` quando o PDF já foi parar na ficha do Clinicorp. */
  noClinicorp: boolean;
}

export interface CriarLinkInput {
  especialidade: EspecialidadeAnamnese;
  /**
   * PatientId do Clinicorp. Sem ele o link funciona, mas o PDF **não** sobe sozinho para a ficha —
   * então vale sempre mandar quando existir.
   */
  clinicorpPatientId?: string;
  /** Obrigatório quando não há `clinicorpPatientId`. O formulário mostra só o primeiro nome. */
  nome?: string;
}

export interface AnamneseConfig {
  baseUrl: string;
  /** Segredo do header `x-anamnese-secret`. Vem do .env e nunca é logado. */
  secret: string;
}

export interface AnamneseClient {
  criarLink(input: CriarLinkInput): Promise<AnamneseLink>;
  consultarLink(id: string): Promise<AnamneseLink>;
}

interface RespostaBruta {
  id: string;
  link: string;
  especialidade: string;
  expira_em: string;
  reaproveitado?: boolean;
  respondido?: boolean;
  respondido_em?: string | null;
  no_clinicorp?: boolean;
}

function mapLink(raw: RespostaBruta): AnamneseLink {
  return {
    id: raw.id,
    link: raw.link,
    especialidade: raw.especialidade,
    expiraEm: raw.expira_em,
    reaproveitado: raw.reaproveitado === true,
    respondido: raw.respondido === true,
    respondidoEm: raw.respondido_em ?? null,
    noClinicorp: raw.no_clinicorp === true,
  };
}

export class HttpAnamneseClient implements AnamneseClient {
  constructor(
    private readonly config: AnamneseConfig,
    private readonly fetchFn: typeof fetch = fetch,
    /**
     * A spec manda tentar de novo em 502/503 ("o servidor estava reiniciando"), até 3 vezes, com
     * cerca de um minuto entre as tentativas. O Render hiberna o serviço, então a primeira chamada
     * do dia costuma cair justo nisso. `isRetryable` já deixa 400 e 401 passarem direto — são erros
     * de configuração e repetir não ajudaria.
     */
    private readonly retryOpts: RetryOptions = { retries: 3, baseMs: 60_000, maxMs: 120_000 },
  ) {}

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    return withRetry(async () => {
      const headers: Record<string, string> = {
        'x-anamnese-secret': this.config.secret,
        Accept: 'application/json',
      };
      if (body !== undefined) headers['Content-Type'] = 'application/json';

      const res = await this.fetchFn(`${this.config.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        // A mensagem não carrega corpo nem o segredo: 401 e 400 são de configuração, e o resto
        // pode trazer dado de paciente.
        throw new ExternalApiError(`Anamnese ${method} ${path} -> ${res.status}`, res.status);
      }

      return res.json() as Promise<T>;
    }, this.retryOpts);
  }

  async criarLink(input: CriarLinkInput): Promise<AnamneseLink> {
    const body: Record<string, string> = { especialidade: input.especialidade };
    if (input.clinicorpPatientId) body.clinicorp_patient_id = input.clinicorpPatientId;
    if (input.nome) body.nome = input.nome;

    const raw = await this.request<RespostaBruta>('POST', '/api/v1/anamnese/externo/links', body);
    return mapLink(raw);
  }

  async consultarLink(id: string): Promise<AnamneseLink> {
    const raw = await this.request<RespostaBruta>(
      'GET',
      `/api/v1/anamnese/externo/links/${encodeURIComponent(id)}`,
    );
    return mapLink(raw);
  }
}

/**
 * Mapeia o que a agenda diz para o código do formulário. A especialidade "oficial" vem do
 * Additional Info do CRM, mas a régua só tem o texto do agendamento — então casamos por radical,
 * como no retorno pós-procedimento, e caímos em `clinico_geral` quando não dá para saber.
 *
 * Criança vem **antes** de tudo: a spec manda `odontopediatria` para qualquer avaliação de até 12
 * anos, "inclusive ortopedia infantil".
 */
export function especialidadeDoAtendimento(opts: {
  procedimento?: string;
  infantil?: boolean;
}): EspecialidadeAnamnese {
  if (opts.infantil) return 'odontopediatria';

  const c = (opts.procedimento ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

  if (c.trim() === '') return ESPECIALIDADE_PADRAO;
  if (/odontopediatr/.test(c)) return 'odontopediatria';
  if (/ortodontia|aparelho|alinhador|invisalign|mordida|ortopedia/.test(c)) return 'ortodontia';
  if (/implant/.test(c)) return 'implante';
  if (/protese|coroa|dentadura|ponte/.test(c)) return 'protese';
  if (/lente|faceta/.test(c)) return 'lentes';
  if (/canal|endodont/.test(c)) return 'endodontia';
  return ESPECIALIDADE_PADRAO;
}
