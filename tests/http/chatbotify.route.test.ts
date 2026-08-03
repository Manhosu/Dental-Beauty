import { describe, it, expect, vi } from 'vitest';
import { handleInbound } from '../../src/http/webhooks/chatbotify.route';

function makeDeps() {
  const seen = new Set<string>();
  return {
    enqueue: vi.fn(async () => {}),
    idempotency: {
      alreadyProcessed: async (id: string) => seen.has(id),
      markProcessed: async (id: string) => void seen.add(id),
    },
  };
}

const msg = { eventId: 'e1', from: '5521999998888', to: '5521981217082', type: 'text', text: 'oi' };

describe('handleInbound', () => {
  it('enfileira mensagem válida', async () => {
    const deps = makeDeps();
    const res = await handleInbound(msg, deps);
    expect(res.status).toBe('enqueued');
    expect(deps.enqueue).toHaveBeenCalledOnce();
  });

  it('é idempotente: não enfileira o mesmo eventId duas vezes', async () => {
    const deps = makeDeps();
    await handleInbound(msg, deps);
    const res2 = await handleInbound(msg, deps);
    expect(res2.status).toBe('duplicate');
    expect(deps.enqueue).toHaveBeenCalledOnce();
  });

  it('rejeita payload inválido', async () => {
    const deps = makeDeps();
    const res = await handleInbound({ bad: true }, deps);
    expect(res.status).toBe('invalid');
    expect(deps.enqueue).not.toHaveBeenCalled();
  });
});
