import { describe, it, expect, vi } from 'vitest';
import { buildServer } from '../../src/http/server';
import { AppError, ExternalApiError } from '../../src/lib/errors';
import type { SchedulingEngine } from '../../src/scheduling/schedulingEngine';
import type { ClinicorpClient } from '../../src/integrations/clinicorp/types';

function appThatFailsCancelWith(err: Error) {
  const clinicorp = {
    getAvailability: vi.fn().mockResolvedValue([]),
    createAppointment: vi.fn(),
    cancelAppointment: vi.fn().mockRejectedValue(err),
    listProfessionals: vi.fn().mockResolvedValue([]),
    listAppointmentsByDate: vi.fn().mockResolvedValue([]),
    listAppointmentStatuses: vi.fn().mockResolvedValue([]),
    listBirthdays: vi.fn().mockResolvedValue([]),
    listSpecialties: vi.fn().mockResolvedValue([]),
    findPatientByPhone: vi.fn().mockResolvedValue(null),
  } as unknown as ClinicorpClient;
  const engine = { book: vi.fn() } as unknown as SchedulingEngine;
  return buildServer({ scheduling: { engine, clinicorp } });
}

const cancelar = { method: 'POST' as const, url: '/agendamento/cancelar', payload: { appointmentId: '1' } };

describe('errorHandler — status HTTP por tipo de erro', () => {
  it('falha 5xx da Clinicorp vira 502 (upstream), não 400', async () => {
    const app = appThatFailsCancelWith(new ExternalApiError('Clinicorp fora do ar', 503));
    const res = await app.inject(cancelar);
    expect(res.statusCode).toBe(502);
    await app.close();
  });

  it('rate limit (429) da Clinicorp também vira 502', async () => {
    const app = appThatFailsCancelWith(new ExternalApiError('rate limit', 429));
    const res = await app.inject(cancelar);
    expect(res.statusCode).toBe(502);
    await app.close();
  });

  it('4xx informativo da Clinicorp passa adiante (409 paciente já existe)', async () => {
    const app = appThatFailsCancelWith(new ExternalApiError('paciente já existe', 409));
    const res = await app.inject(cancelar);
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it('AppError de domínio continua 400', async () => {
    const app = appThatFailsCancelWith(new AppError('entrada inválida'));
    const res = await app.inject(cancelar);
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('erro inesperado é 500', async () => {
    const app = appThatFailsCancelWith(new Error('boom'));
    const res = await app.inject(cancelar);
    expect(res.statusCode).toBe(500);
    await app.close();
  });
});
