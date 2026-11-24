import { describe, it, expect } from 'vitest';
import { buildServer } from '../../src/http/server';
import { DEFAULT_BUSINESS_HOURS } from '../../src/domain/businessHours';

describe('server', () => {
  it('GET /health responde 200', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('GET /atendimento/status diz que a recepção atende dentro do expediente', async () => {
    // 2026-08-12T13:00Z = quarta 10:00 BRT
    const app = buildServer({
      atendimento: { now: () => new Date('2026-08-12T13:00:00.000Z') },
    });
    const res = await app.inject({ method: 'GET', url: '/atendimento/status' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      businessHours: true,
      attendant: 'recepcao',
      localTime: '10:00',
      automationsAlwaysOn: true,
      horario: { inicio: '09:00', fim: '18:00', dias: DEFAULT_BUSINESS_HOURS.days },
    });
    await app.close();
  });

  it('GET /atendimento/status entrega a conversa para a IA fora do expediente', async () => {
    // 2026-08-12T23:00Z = quarta 20:00 BRT
    const app = buildServer({
      atendimento: { now: () => new Date('2026-08-12T23:00:00.000Z') },
    });
    const res = await app.inject({ method: 'GET', url: '/atendimento/status' });
    expect(res.json()).toMatchObject({ businessHours: false, attendant: 'ia' });
    await app.close();
  });

  it('respeita o horário comercial configurado', async () => {
    const app = buildServer({
      atendimento: {
        businessHours: { start: '08:00', end: '12:00', days: [6], tzOffsetHours: -3 },
        now: () => new Date('2026-08-15T13:00:00.000Z'), // sábado 10:00 BRT
      },
    });
    expect(res_businessHours(await app.inject({ method: 'GET', url: '/atendimento/status' }))).toBe(
      true,
    );
    await app.close();
  });

  it('sem deps de agendamento, as rotas da Clinicorp não existem', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/catalogo/profissionais' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

function res_businessHours(res: { json: () => unknown }): boolean {
  return (res.json() as { businessHours: boolean }).businessHours;
}
