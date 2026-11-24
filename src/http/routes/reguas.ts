import type { FastifyInstance } from 'fastify';
import type { ClinicorpClient } from '../../integrations/clinicorp/types';
import { logger } from '../../lib/logger';

/**
 * Rotas que o **workflow do GoHighLevel** chama de volta, pela ação "Webhook" (saída HTTP, que é
 * ação e não acionador — o acionador "Webhook recebido" é que seria premium e cobrado por
 * execução).
 *
 * Hoje tem uma só: liberar o horário de quem não confirmou. O resto da régua de confirmação vive
 * inteiro no painel, porque o estado que ela precisa — "o paciente respondeu SIM?" — nasce e mora
 * no GHL; trazer isso para cá só para devolver em seguida seria dar a volta no mundo.
 */

/**
 * De onde sai o id do agendamento na Clinicorp.
 *
 * A primeira versão exigia `appointmentId` no corpo, montado na ação de webhook do workflow pelo
 * chip de variável do campo "Régua - Agendamento". **Isso nunca funcionou.** As execuções de 22 e
 * 23/11 mostraram o chip montado na tela, o campo do contato preenchido 23h antes, e a chave
 * simplesmente ausente do corpo: o GHL não interpola campo personalizado nos "Dados
 * personalizados" do webhook. Refazer o chip não mudou nada.
 *
 * Então a rota pára de depender dele. Procura o id em qualquer lugar razoável do corpo e, se não
 * achar, busca no próprio contato pela API do GHL a partir do id do contato — que vem nos "dados
 * padrão" que a ação manda sempre. Ver `docs/ghl/go-live.md`.
 */

/** Chaves que carregam o id do agendamento direto, na grafia que a gente mesmo pediu. */
const CHAVES_AGENDAMENTO = ['appointmentId', 'appointment_id'];

/**
 * Último recurso dentro do corpo: qualquer chave que *fale* de agendamento. Cobre o caso de o GHL
 * mandar os campos personalizados com o nome deles ("Régua - Agendamento") ou com o fieldKey
 * (`rgua__agendamento`), que é o que não sabemos de antemão.
 */
const CHAVE_AGENDAMENTO_SOLTA = /agendamento/i;

/** Chaves que carregam o id do contato. `id` fica por último: na raiz do corpo ele é ambíguo. */
const CHAVES_CONTATO = ['contact_id', 'contactId', 'contactID', 'id'];

/** Objetos aninhados do corpo do GHL onde também vale procurar, além da raiz. */
const ANINHADOS = ['customData', 'custom_data', 'customFields', 'custom_fields', 'contact'];

/** A raiz do corpo mais os aninhados que existirem, para procurar nos dois níveis. */
function objetosDoCorpo(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  const raiz = body as Record<string, unknown>;
  const objetos = [raiz];
  for (const chave of ANINHADOS) {
    const valor = raiz[chave];
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      objetos.push(valor as Record<string, unknown>);
    }
  }
  return objetos;
}

/** Normaliza para string não vazia. O GHL manda id numérico em alguns lugares. */
function texto(valor: unknown): string | undefined {
  if (typeof valor === 'string') return valor.trim() || undefined;
  if (typeof valor === 'number' && Number.isFinite(valor)) return String(valor);
  return undefined;
}

/** Acha o id do agendamento no corpo, onde quer que o GHL tenha posto. */
export function extrairAppointmentId(body: unknown): string | undefined {
  const objetos = objetosDoCorpo(body);
  // Primeiro a grafia exata, para não confundir com uma chave que só *parece* ser a certa.
  for (const chave of CHAVES_AGENDAMENTO) {
    for (const objeto of objetos) {
      const valor = texto(objeto[chave]);
      if (valor) return valor;
    }
  }
  for (const objeto of objetos) {
    for (const [chave, valor] of Object.entries(objeto)) {
      if (!CHAVE_AGENDAMENTO_SOLTA.test(chave)) continue;
      const achado = texto(valor);
      if (achado) return achado;
    }
  }
  return undefined;
}

/** Acha o id do contato no corpo, para poder buscar o agendamento na API do GHL. */
export function extrairContactId(body: unknown): string | undefined {
  const objetos = objetosDoCorpo(body);
  for (const chave of CHAVES_CONTATO) {
    for (const objeto of objetos) {
      const valor = texto(objeto[chave]);
      if (valor) return valor;
    }
  }
  return undefined;
}

/**
 * Só os **nomes** das chaves que chegaram, para a resposta de erro dizer o que o GHL mandou.
 * Nome de chave e nada de valor: o corpo carrega nome e telefone de paciente, e esta resposta
 * aparece no registro de execução do painel.
 */
function chavesRecebidas(body: unknown): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  return Object.keys(body as Record<string, unknown>);
}

/**
 * Quantos dias à frente a conferência pós-cancelamento varre a agenda. A consulta liberada está
 * sempre a poucos dias (D-3 para quem confirmou no D-4, D-1 para quem confirmou no D-2), então
 * uma janela de uma semana cobre com folga.
 */
export const JANELA_CONFERENCIA_DIAS = 7;

function isoDate(base: Date, diasDepois: number): string {
  return new Date(base.getTime() + diasDepois * 86_400_000).toISOString().slice(0, 10);
}

export interface ReguasRouteDeps {
  clinicorp: Pick<ClinicorpClient, 'cancelAppointment' | 'listAppointmentsByDate'>;
  /**
   * Interruptor de segurança. Cancelar na agenda é **irreversível** e atinge a clínica de verdade,
   * então começa desligado: a rota responde `simulado`, o workflow segue sem erro e nada muda na
   * Clinicorp. A clínica liga em `LIBERAR_HORARIO_ATIVO=true` quando tiver acompanhado alguns
   * casos e quiser que a liberação valha.
   *
   * Enquanto estiver desligado, a mensagem "liberamos o seu horário" **não pode ser publicada** —
   * ela afirma ao paciente algo que não aconteceu. Ver `docs/ghl/roteiro-ia-v2-cliente.md`.
   */
  liberarHorarioAtivo: boolean;
  /**
   * Lê o campo "Régua - Agendamento" do contato no GHL. É a rede de segurança para o corpo que
   * chega sem `appointmentId` — hoje, *todos* eles. Opcional: sem o GHL configurado (ou sem o id
   * do campo), a rota fica só com o que vier no corpo.
   */
  buscarAgendamentoDoContato?: (contactId: string) => Promise<string | undefined>;
}

export function registerReguasRoutes(app: FastifyInstance, deps: ReguasRouteDeps): void {
  app.post('/reguas/liberar-horario', async (req, reply) => {
    let appointmentId = extrairAppointmentId(req.body);
    // Fica na resposta e no log: diz, no dia seguinte, por qual caminho o id chegou.
    let origem: 'corpo' | 'contato' = 'corpo';

    if (!appointmentId && deps.buscarAgendamentoDoContato) {
      const contactId = extrairContactId(req.body);
      if (contactId) {
        try {
          appointmentId = await deps.buscarAgendamentoDoContato(contactId);
          origem = 'contato';
        } catch (err) {
          // Não derruba o pedido: cai no 400 abaixo, que já conta o que chegou.
          logger.warn({ err, contactId }, 'não deu para buscar o agendamento no contato do GHL');
        }
      }
    }

    if (!appointmentId) {
      const chaves = chavesRecebidas(req.body);
      logger.warn({ chaves }, 'pedido de liberação sem id de agendamento');
      return reply.status(400).send({
        error: 'invalid',
        message: 'appointmentId não chegou no corpo nem foi encontrado no contato',
        chavesRecebidas: chaves,
      });
    }

    if (!deps.liberarHorarioAtivo) {
      logger.warn(
        { appointmentId, origem },
        'liberação de horário pedida com LIBERAR_HORARIO_ATIVO desligado: agenda não foi tocada',
      );
      return reply.status(200).send({ status: 'simulado', appointmentId, origem });
    }

    const result = await deps.clinicorp.cancelAppointment(appointmentId);

    // Confere o que de fato aconteceu com o agendamento. É a resposta para a pergunta que ninguém
    // conseguiu responder sem cancelar a consulta de alguém: se o registro continua na listagem,
    // o cancelamento não pegou; se saiu, a vaga está livre e a baixa foi lógica (campo `Deleted`).
    // A conferência nunca derruba a liberação — se ela falhar, o horário já foi solto do mesmo
    // jeito e o que se perde é só o diagnóstico.
    let aindaNaAgenda: boolean | undefined;
    try {
      const hoje = new Date();
      const agenda = await deps.clinicorp.listAppointmentsByDate(
        isoDate(hoje, 0),
        isoDate(hoje, JANELA_CONFERENCIA_DIAS),
      );
      aindaNaAgenda = agenda.some((a) => String(a.id) === appointmentId);
    } catch (err) {
      logger.warn({ err, appointmentId }, 'não deu para conferir a agenda depois do cancelamento');
    }

    logger.info(
      { appointmentId, origem, released: result.released, aindaNaAgenda, resposta: result.resposta },
      aindaNaAgenda === true
        ? 'ATENÇÃO: o agendamento continua na agenda depois do cancelamento'
        : 'horário liberado na agenda',
    );

    return reply.status(200).send({
      status: 'liberado',
      appointmentId,
      origem,
      released: result.released,
      ...(aindaNaAgenda === undefined ? {} : { aindaNaAgenda }),
    });
  });
}
