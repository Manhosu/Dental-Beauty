import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
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

const liberarHorarioSchema = z.object({
  /** Id do agendamento na Clinicorp, gravado no contato pelo campo "Régua - Agendamento". */
  appointmentId: z.string().min(1),
});

export interface ReguasRouteDeps {
  clinicorp: Pick<ClinicorpClient, 'cancelAppointment'>;
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
}

export function registerReguasRoutes(app: FastifyInstance, deps: ReguasRouteDeps): void {
  app.post('/reguas/liberar-horario', async (req, reply) => {
    const parsed = liberarHorarioSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid', issues: parsed.error.issues });
    }

    const { appointmentId } = parsed.data;

    if (!deps.liberarHorarioAtivo) {
      logger.warn(
        { appointmentId },
        'liberação de horário pedida com LIBERAR_HORARIO_ATIVO desligado: agenda não foi tocada',
      );
      return reply.status(200).send({ status: 'simulado', appointmentId });
    }

    const result = await deps.clinicorp.cancelAppointment(appointmentId);
    logger.info({ appointmentId, released: result.released }, 'horário liberado na agenda');
    return reply.status(200).send({ status: 'liberado', appointmentId, released: result.released });
  });
}
