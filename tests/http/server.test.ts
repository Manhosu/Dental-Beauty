import { describe, it, expect } from 'vitest';
import { buildServer } from '../../src/http/server';

describe('server', () => {
  it('GET /health responde 200', async () => {
    const app = buildServer({
      enqueue: async () => {},
      idempotency: { alreadyProcessed: async () => false, markProcessed: async () => {} },
    });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('POST /webhooks/chatbotify enfileira e responde 202', async () => {
    let enqueued = 0;
    const app = buildServer({
      enqueue: async () => void enqueued++,
      idempotency: { alreadyProcessed: async () => false, markProcessed: async () => {} },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/chatbotify',
      payload: { eventId: 'e1', from: 'a', to: 'b', type: 'text', text: 'oi' },
    });
    expect(res.statusCode).toBe(202);
    expect(enqueued).toBe(1);
    await app.close();
  });

  it('payload inválido responde 400', async () => {
    const app = buildServer({
      enqueue: async () => {},
      idempotency: { alreadyProcessed: async () => false, markProcessed: async () => {} },
    });
    const res = await app.inject({ method: 'POST', url: '/webhooks/chatbotify', payload: { bad: true } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
