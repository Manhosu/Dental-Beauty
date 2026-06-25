import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../src/http/server';
import { resetEnv } from '../../src/config/env';
import type { SchedulingEngine } from '../../src/scheduling/schedulingEngine';
import type { ClinicorpClient } from '../../src/integrations/clinicorp/types';

const noopInbound = {
  enqueue: async () => {},
  idempotency: {
    alreadyProcessed: async () => false as const,
    markProcessed: async () => {},
  },
};

const base = {
  NODE_ENV: 'test',
  PORT: '3000',
  REDIS_URL: 'redis://localhost:6379',
  CLINICORP_API_BASE: 'https://sistema.clinicorp.com',
  CLINICORP_API_USER: 'user',
  CLINICORP_API_TOKEN: 'token',
  CLINICORP_SUBSCRIBER_ID: 'oralmultiedentalbeauty',
  CLINICORP_BUSINESS_ID: '6247357829611520',
};

function makeFakeEngine(): SchedulingEngine {
  return { book: vi.fn() } as unknown as SchedulingEngine;
}

function makeFakeClinicorp(): ClinicorpClient {
  return {
    getAvailability: vi.fn().mockResolvedValue([]),
    createAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
    listProfessionals: vi.fn().mockResolvedValue([]),
    listBirthdays: vi.fn().mockResolvedValue([]),
    listSpecialties: vi.fn().mockResolvedValue([]),
    findPatientByPhone: vi.fn().mockResolvedValue(null),
  } as unknown as ClinicorpClient;
}

function buildApp() {
  return buildServer(noopInbound, { engine: makeFakeEngine(), clinicorp: makeFakeClinicorp() });
}

describe('X-Api-Key preHandler (API_KEY_SECRET set)', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, base, { API_KEY_SECRET: 'super-secret' });
    resetEnv();
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    resetEnv();
  });

  it('returns 401 on protected route without the header', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/agendamento/disponibilidade?date=2026-07-01',
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'unauthorized' });
    await app.close();
  });

  it('returns 401 on protected route with a wrong key', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/agendamento/disponibilidade?date=2026-07-01',
      headers: { 'x-api-key': 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('allows protected route with the correct key', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/agendamento/disponibilidade?date=2026-07-01',
      headers: { 'x-api-key': 'super-secret' },
    });
    expect(res.statusCode).not.toBe(401);
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('always allows /health without the key', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});

describe('X-Api-Key preHandler (API_KEY_SECRET unset)', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, base);
    delete process.env.API_KEY_SECRET;
    resetEnv();
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    resetEnv();
  });

  it('does not enforce the header (local/dev open)', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/agendamento/disponibilidade?date=2026-07-01',
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
