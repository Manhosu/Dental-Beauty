import { describe, it, expect, vi } from 'vitest';
import { buildServer } from '../../src/http/server';
import type { SonaxCrmPort } from '../../src/integrations/sonax/sonax';

const inbound = {
  enqueue: async () => {},
  idempotency: { alreadyProcessed: async () => false, markProcessed: async () => {} },
};

function crmMock(): SonaxCrmPort {
  return {
    upsertContactWithNote: vi.fn().mockResolvedValue(undefined),
  };
}

describe('GET /webhooks/sonax', () => {
  it('processa a ligação e responde 200 (token válido)', async () => {
    const crm = crmMock();
    const app = buildServer(inbound, undefined, { crm, token: 'segredo' });
    const res = await app.inject({
      method: 'GET',
      url: '/webhooks/sonax?ID_CHAMADA=C1&NUMERO=5521999&STATUS_ATENDIMENTO=ATENDIDA&token=segredo',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, phase: 'answered', noted: true });
    expect(crm.upsertContactWithNote).toHaveBeenCalledWith('5521999', expect.stringContaining('ATENDIDA'));
    await app.close();
  });

  it('token inválido responde 401', async () => {
    const app = buildServer(inbound, undefined, { crm: crmMock(), token: 'segredo' });
    const res = await app.inject({ method: 'GET', url: '/webhooks/sonax?ID_CHAMADA=C1&NUMERO=5521999&token=errado' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('faltando NUMERO responde 400', async () => {
    const app = buildServer(inbound, undefined, { crm: crmMock(), token: 'segredo' });
    const res = await app.inject({ method: 'GET', url: '/webhooks/sonax?ID_CHAMADA=C1&token=segredo' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('falha no CRM responde 200 ok:false (sem retry-storm)', async () => {
    const crm: SonaxCrmPort = {
      upsertContactWithNote: vi.fn().mockRejectedValue(new Error('crm down')),
    };
    const app = buildServer(inbound, undefined, { crm, token: 'segredo' });
    const res = await app.inject({ method: 'GET', url: '/webhooks/sonax?ID_CHAMADA=C1&NUMERO=5521999&token=segredo' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: false });
    await app.close();
  });
});
