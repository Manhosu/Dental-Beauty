import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SchedulingEngine } from '../../scheduling/schedulingEngine';
import type { ClinicorpClient } from '../../integrations/clinicorp/types';

const patientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  personId: z.number().int().optional(),
});

const bookBodySchema = z.object({
  slotId: z.string().min(1),
  professionalId: z.string().min(1),
  specialty: z.string().min(1),
  patient: patientSchema,
  date: z.string().min(1),
  fromTime: z.string().min(1),
  toTime: z.string().min(1),
  dentistPersonId: z.number().int(),
  // Opcional: createAppointment usa dentistPersonId OU scheduleToId (booking por dentista não exige scheduleToId).
  scheduleToId: z.number().int().optional(),
  scheduleToType: z.literal('CHAIR').optional(),
  procedures: z.string().optional(),
  categoryDescription: z.string().optional(),
  categoryColor: z.string().optional(),
});

const cancelBodySchema = z.object({
  appointmentId: z.string().min(1),
});

const disponibilidadeQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  professionalId: z.coerce.number().int().optional(),
});

export interface AgendamentoDeps {
  engine: SchedulingEngine;
  clinicorp: ClinicorpClient;
}

export function registerAgendamentoRoutes(app: FastifyInstance, deps: AgendamentoDeps): void {
  app.post('/agendamento/book', async (req, reply) => {
    const parsed = bookBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid', issues: parsed.error.issues });
    }

    const result = await deps.engine.book(parsed.data);

    if (result.status === 'confirmed') {
      return reply.status(201).send({ status: 'confirmed', appointmentId: result.appointmentId });
    }
    if (result.status === 'slot_taken') {
      return reply.status(409).send({ status: 'slot_taken' });
    }
    // failed
    return reply.status(502).send({ status: 'failed', reason: result.reason });
  });

  app.post('/agendamento/cancelar', async (req, reply) => {
    const parsed = cancelBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid', issues: parsed.error.issues });
    }

    const { appointmentId } = parsed.data;
    const result = await deps.clinicorp.cancelAppointment(appointmentId);

    return reply.status(200).send({ status: 'cancelled', released: result.released });
  });

  app.get('/agendamento/disponibilidade', async (req, reply) => {
    const parsed = disponibilidadeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid', issues: parsed.error.issues });
    }

    const { date, professionalId } = parsed.data;
    const slots = await deps.clinicorp.getAvailability({ date, professionalId });

    return reply.status(200).send({ date, slots });
  });
}
