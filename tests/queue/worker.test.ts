import { describe, it, expect, vi } from 'vitest';
import { processInbound } from '../../src/queue/worker';
import { NumberRegistry } from '../../src/domain/numberRegistry';

const registry = new NumberRegistry([{ number: '5521981217082', role: 'lead' }]);

describe('processInbound', () => {
  it('roteia a mensagem para o papel do número de destino', async () => {
    const handler = vi.fn(async () => {});
    await processInbound(
      { eventId: 'e1', from: '5521999998888', to: '5521981217082', type: 'text', text: 'oi' },
      { registry, onRole: { lead: handler, reception: vi.fn(), dispatch: vi.fn(), quote: vi.fn() } },
    );
    expect(handler).toHaveBeenCalledOnce();
  });

  it('ignora número desconhecido sem lançar', async () => {
    await expect(
      processInbound(
        { eventId: 'e2', from: 'x', to: '5511000000000', type: 'text', text: 'oi' },
        { registry, onRole: { lead: vi.fn(), reception: vi.fn(), dispatch: vi.fn(), quote: vi.fn() } },
      ),
    ).resolves.toBeUndefined();
  });
});
