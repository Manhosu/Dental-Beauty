import { describe, it, expect, vi } from 'vitest';
import { HttpChatbotifyClient } from '../../../src/integrations/chatbotify/client';
import { ExternalApiError } from '../../../src/lib/errors';

function makeFakeFetch(status: number, body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

const config = { baseUrl: 'https://chatbotify.example.com', token: 'tok-test' };

describe('HttpChatbotifyClient.sendMessage', () => {
  it('POSTs to /messages with Bearer auth and JSON body, maps id to messageId', async () => {
    const fakeFetch = makeFakeFetch(200, { id: 'm1' });
    const client = new HttpChatbotifyClient(config, fakeFetch);

    const result = await client.sendMessage({ to: '+5511999999999', from: '+5511888888888', text: 'Olá' });

    expect(result).toEqual({ messageId: 'm1' });
    expect(fakeFetch).toHaveBeenCalledOnce();
    const [url, init] = (fakeFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://chatbotify.example.com/messages');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-test');
    const sentBody = JSON.parse(init.body as string) as { to: string; text: string };
    expect(sentBody.to).toBe('+5511999999999');
    expect(sentBody.text).toBe('Olá');
  });

  it('maps messageId field when response has messageId instead of id', async () => {
    const fakeFetch = makeFakeFetch(200, { messageId: 'msg-99' });
    const client = new HttpChatbotifyClient(config, fakeFetch);

    const result = await client.sendMessage({ to: '+5511999999999', from: '+5511888888888', text: 'Hi' });

    expect(result).toEqual({ messageId: 'msg-99' });
  });

  it('throws ExternalApiError on HTTP 401', async () => {
    const fakeFetch = makeFakeFetch(401, { error: 'unauthorized' });
    const client = new HttpChatbotifyClient(config, fakeFetch);

    await expect(
      client.sendMessage({ to: '+5511999999999', from: '+5511888888888', text: 'Hi' }),
    ).rejects.toBeInstanceOf(ExternalApiError);
  });
});

describe('HttpChatbotifyClient.suppressBot', () => {
  it('POSTs to /bot/suppress with conversationId', async () => {
    const fakeFetch = makeFakeFetch(200, {});
    const client = new HttpChatbotifyClient(config, fakeFetch);

    await client.suppressBot('conv-42');

    expect(fakeFetch).toHaveBeenCalledOnce();
    const [url, init] = (fakeFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://chatbotify.example.com/bot/suppress');
    const sentBody = JSON.parse(init.body as string) as { conversationId: string };
    expect(sentBody.conversationId).toBe('conv-42');
  });
});
