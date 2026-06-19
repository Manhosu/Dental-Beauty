import { describe, it, expect, vi } from 'vitest';
import { buildServer } from '../../src/http/server';
import type { SchedulingEngine, BookResult } from '../../src/scheduling/schedulingEngine';
import type { ClinicorpClient, Birthday, Specialty, Professional } from '../../src/integrations/clinicorp/types';

// No-op InboundDeps
const noopInbound = {
  enqueue: async () => {},
  idempotency: {
    alreadyProcessed: async () => false as const,
    markProcessed: async () => {},
  },
};

function makeFakeEngine(): SchedulingEngine {
  return {
    book: vi.fn().mockResolvedValue({ status: 'confirmed', appointmentId: 'x' } as BookResult),
  } as unknown as SchedulingEngine;
}

function makeFakeClinicorp(overrides: Partial<ClinicorpClient> = {}): ClinicorpClient {
  return {
    getAvailability: vi.fn().mockResolvedValue([]),
    createAppointment: vi.fn(),
    cancelAppointment: vi.fn().mockResolvedValue({ released: true }),
    listProfessionals: vi.fn().mockResolvedValue([]),
    listBirthdays: vi.fn().mockResolvedValue([]),
    listSpecialties: vi.fn().mockResolvedValue([]),
    findPatientByPhone: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as ClinicorpClient;
}

describe('GET /pacientes/aniversariantes', () => {
  it('returns 200 with aniversariantes array from clinicorp', async () => {
    const birthday: Birthday = {
      patientId: 123,
      name: 'Maria Silva',
      birthDate: '1990-06-16T03:00:00.000Z',
      age: 36,
      email: 'maria@example.com',
      mobilePhone: '(21) 99999-0000',
    };
    const fakeClinicorp = makeFakeClinicorp({
      listBirthdays: vi.fn().mockResolvedValue([birthday]),
    });
    const app = buildServer(noopInbound, { engine: makeFakeEngine(), clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'GET',
      url: '/pacientes/aniversariantes',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ aniversariantes: [birthday] });
    expect(fakeClinicorp.listBirthdays).toHaveBeenCalledOnce();
    await app.close();
  });

  it('returns 200 with empty array when no birthdays', async () => {
    const fakeClinicorp = makeFakeClinicorp();
    const app = buildServer(noopInbound, { engine: makeFakeEngine(), clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'GET',
      url: '/pacientes/aniversariantes',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ aniversariantes: [] });
    await app.close();
  });
});

describe('GET /catalogo/especialidades', () => {
  it('returns 200 with especialidades array from clinicorp', async () => {
    const specialty: Specialty = {
      id: 5302587564752897,
      description: 'Avaliação Implante',
      type: 'EXPERTISE',
      active: true,
    };
    const fakeClinicorp = makeFakeClinicorp({
      listSpecialties: vi.fn().mockResolvedValue([specialty]),
    });
    const app = buildServer(noopInbound, { engine: makeFakeEngine(), clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'GET',
      url: '/catalogo/especialidades',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ especialidades: [specialty] });
    expect(fakeClinicorp.listSpecialties).toHaveBeenCalledOnce();
    await app.close();
  });

  it('returns 200 with empty array when no specialties', async () => {
    const fakeClinicorp = makeFakeClinicorp();
    const app = buildServer(noopInbound, { engine: makeFakeEngine(), clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'GET',
      url: '/catalogo/especialidades',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ especialidades: [] });
    await app.close();
  });
});

describe('GET /catalogo/profissionais', () => {
  it('returns 200 with profissionais array from clinicorp', async () => {
    const professional: Professional = { id: 1, name: 'Dr. Silva', cpf: '123.456.789-00' };
    const fakeClinicorp = makeFakeClinicorp({
      listProfessionals: vi.fn().mockResolvedValue([professional]),
    });
    const app = buildServer(noopInbound, { engine: makeFakeEngine(), clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'GET',
      url: '/catalogo/profissionais',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ profissionais: [professional] });
    expect(fakeClinicorp.listProfessionals).toHaveBeenCalledOnce();
    await app.close();
  });

  it('returns 200 with empty array when no professionals', async () => {
    const fakeClinicorp = makeFakeClinicorp();
    const app = buildServer(noopInbound, { engine: makeFakeEngine(), clinicorp: fakeClinicorp });

    const res = await app.inject({
      method: 'GET',
      url: '/catalogo/profissionais',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ profissionais: [] });
    await app.close();
  });
});
