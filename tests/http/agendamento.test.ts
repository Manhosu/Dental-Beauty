import { describe, it, expect, vi } from 'vitest';
import { buildServer } from '../../src/http/server';
import type { SchedulingEngine, BookResult } from '../../src/scheduling/schedulingEngine';
import type { ClinicorpClient, AvailableSlot } from '../../src/integrations/clinicorp/types';

// No-op InboundDeps so we can call buildServer with one arg style
const noopInbound = {
  enqueue: async () => {},
  idempotency: {
    alreadyProcessed: async () => false as const,
    markProcessed: async () => {},
  },
};

// Minimal valid book payload
const validBookPayload = {
  slotId: 'slot-1',
  professionalId: 'prof-1',
  specialty: 'Ortodontia',
  patient: { name: 'João Silva', phone: '11999999999' },
  date: '2026-07-01',
  fromTime: '09:00',
  toTime: '09:30',
  dentistPersonId: 42,
  scheduleToId: 10,
};

function makeFakeEngine(result: BookResult): SchedulingEngine {
  return {
    book: vi.fn().mockResolvedValue(result),
  } as unknown as SchedulingEngine;
}

function makeFakeClinicorp(slots: AvailableSlot[] = []): ClinicorpClient {
  return {
    getAvailability: vi.fn().mockResolvedValue(slots),
    createAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
    listProfessionals: vi.fn().mockResolvedValue([]),
    listBirthdays: vi.fn().mockResolvedValue([]),
    listSpecialties: vi.fn().mockResolvedValue([]),
    findPatientByPhone: vi.fn().mockResolvedValue(null),
  } as unknown as ClinicorpClient;
}

describe('POST /agendamento/book', () => {
  it('returns 201 with confirmed when engine returns confirmed', async () => {
    const fakeEngine = makeFakeEngine({ status: 'confirmed', appointmentId: 'appt-abc' });
    const fakeClinicorp = makeFakeClinicorp();
    const app = buildServer(noopInbound, { engine: fakeEngine, clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'POST',
      url: '/agendamento/book',
      payload: validBookPayload,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ status: 'confirmed', appointmentId: 'appt-abc' });
    await app.close();
  });

  it('accepts a valid body without scheduleToId (booking by dentist)', async () => {
    const fakeEngine = makeFakeEngine({ status: 'confirmed', appointmentId: 'appt-no-chair' });
    const fakeClinicorp = makeFakeClinicorp();
    const app = buildServer(noopInbound, { engine: fakeEngine, clinicorp: fakeClinicorp });

    const { scheduleToId, ...payloadWithoutScheduleToId } = validBookPayload;
    const res = await app.inject({
      method: 'POST',
      url: '/agendamento/book',
      payload: payloadWithoutScheduleToId,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ status: 'confirmed', appointmentId: 'appt-no-chair' });
    await app.close();
  });

  it('accepts flat fields (formato do Chatbotify) e normaliza patient/dentistPersonId/slotId', async () => {
    const fakeEngine = makeFakeEngine({ status: 'confirmed', appointmentId: 'appt-flat' });
    const fakeClinicorp = makeFakeClinicorp();
    const app = buildServer(noopInbound, { engine: fakeEngine, clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'POST',
      url: '/agendamento/book',
      payload: {
        professionalId: '4848869307449344',
        name: 'Maria Teste',
        phone: '5521999998888',
        date: '2026-07-01',
        fromTime: '9:00',
        toTime: '9:30',
      },
    });

    expect(res.statusCode).toBe(201);
    const arg = (fakeEngine.book as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.patient).toEqual({ name: 'Maria Teste', phone: '5521999998888', email: undefined, personId: undefined });
    expect(arg.dentistPersonId).toBe(4848869307449344);
    expect(arg.slotId).toBe('2026-07-01-9:00-4848869307449344');
    expect(arg.specialty).toBe('Avaliação');
    await app.close();
  });

  it('returns 409 when engine returns slot_taken', async () => {
    const fakeEngine = makeFakeEngine({ status: 'slot_taken' });
    const fakeClinicorp = makeFakeClinicorp();
    const app = buildServer(noopInbound, { engine: fakeEngine, clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'POST',
      url: '/agendamento/book',
      payload: validBookPayload,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ status: 'slot_taken' });
    await app.close();
  });

  it('returns 502 when engine returns failed', async () => {
    const fakeEngine = makeFakeEngine({ status: 'failed', reason: 'API error' });
    const fakeClinicorp = makeFakeClinicorp();
    const app = buildServer(noopInbound, { engine: fakeEngine, clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'POST',
      url: '/agendamento/book',
      payload: validBookPayload,
    });

    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ status: 'failed', reason: 'API error' });
    await app.close();
  });

  it('returns 400 for invalid body (missing required fields)', async () => {
    const fakeEngine = makeFakeEngine({ status: 'confirmed', appointmentId: 'x' });
    const fakeClinicorp = makeFakeClinicorp();
    const app = buildServer(noopInbound, { engine: fakeEngine, clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'POST',
      url: '/agendamento/book',
      payload: { bad: true },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'invalid' });
    await app.close();
  });
});

describe('POST /agendamento/cancelar', () => {
  it('returns 200 with status cancelled and released when appointmentId is valid', async () => {
    const fakeEngine = makeFakeEngine({ status: 'confirmed', appointmentId: 'x' });
    const fakeClinicorp = makeFakeClinicorp();
    (fakeClinicorp.cancelAppointment as ReturnType<typeof vi.fn>).mockResolvedValue({ released: true });
    const app = buildServer(noopInbound, { engine: fakeEngine, clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'POST',
      url: '/agendamento/cancelar',
      payload: { appointmentId: '123' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'cancelled', released: true });
    expect(fakeClinicorp.cancelAppointment).toHaveBeenCalledWith('123');
    await app.close();
  });

  it('returns 400 when appointmentId is missing', async () => {
    const fakeEngine = makeFakeEngine({ status: 'confirmed', appointmentId: 'x' });
    const fakeClinicorp = makeFakeClinicorp();
    const app = buildServer(noopInbound, { engine: fakeEngine, clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'POST',
      url: '/agendamento/cancelar',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'invalid' });
    await app.close();
  });
});

describe('GET /agendamento/disponibilidade', () => {
  it('returns 200 with slots from fakeClinicorp when date is valid', async () => {
    const fakeEngine = makeFakeEngine({ status: 'confirmed', appointmentId: 'x' });
    const mockSlots: AvailableSlot[] = [
      { from: '09:00', to: '10:00', dayWeek: 2, businessId: 6247357829611520, professionalId: 42 },
      { from: '10:00', to: '11:00', dayWeek: 2, businessId: 6247357829611520, professionalId: 42 },
    ];
    const fakeClinicorp = makeFakeClinicorp(mockSlots);
    const app = buildServer(noopInbound, { engine: fakeEngine, clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'GET',
      url: '/agendamento/disponibilidade?date=2026-07-01',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ date: '2026-07-01', slots: mockSlots });
    await app.close();
  });

  it('returns 400 when date query param is missing', async () => {
    const fakeEngine = makeFakeEngine({ status: 'confirmed', appointmentId: 'x' });
    const fakeClinicorp = makeFakeClinicorp();
    const app = buildServer(noopInbound, { engine: fakeEngine, clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'GET',
      url: '/agendamento/disponibilidade',
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when date format is invalid', async () => {
    const fakeEngine = makeFakeEngine({ status: 'confirmed', appointmentId: 'x' });
    const fakeClinicorp = makeFakeClinicorp();
    const app = buildServer(noopInbound, { engine: fakeEngine, clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'GET',
      url: '/agendamento/disponibilidade?date=01-07-2026',
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('passes professionalId to getAvailability when provided', async () => {
    const fakeEngine = makeFakeEngine({ status: 'confirmed', appointmentId: 'x' });
    const fakeClinicorp = makeFakeClinicorp([]);
    const app = buildServer(noopInbound, { engine: fakeEngine, clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'GET',
      url: '/agendamento/disponibilidade?date=2026-07-01&professionalId=99',
    });

    expect(res.statusCode).toBe(200);
    expect(fakeClinicorp.getAvailability).toHaveBeenCalledWith({ date: '2026-07-01', professionalId: 99 });
    await app.close();
  });
});
