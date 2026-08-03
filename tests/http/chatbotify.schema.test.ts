import { describe, it, expect } from 'vitest';
import { inboundMessageSchema } from '../../src/http/webhooks/chatbotify.schema';

describe('inboundMessageSchema', () => {
  it('aceita mensagem de texto válida', () => {
    const r = inboundMessageSchema.safeParse({
      eventId: 'evt_1',
      from: '5521999998888',
      to: '5521981217082',
      type: 'text',
      text: 'quero agendar implante',
    });
    expect(r.success).toBe(true);
  });
  it('rejeita payload sem eventId', () => {
    const r = inboundMessageSchema.safeParse({ from: 'x', to: 'y', type: 'text', text: 'oi' });
    expect(r.success).toBe(false);
  });
  it('aceita mensagem de áudio com url', () => {
    const r = inboundMessageSchema.safeParse({
      eventId: 'evt_2',
      from: '5521999998888',
      to: '5521981217082',
      type: 'audio',
      mediaUrl: 'https://cdn.example/a.ogg',
    });
    expect(r.success).toBe(true);
  });
});
