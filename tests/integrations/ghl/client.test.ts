import { describe, it, expect, vi } from 'vitest';
import { GoHighLevelCrmClient } from '../../../src/integrations/ghl/client';
import { ExternalApiError } from '../../../src/lib/errors';

const cfg = {
  baseUrl: 'https://services.leadconnectorhq.com',
  locationId: 'LOC123',
  token: 'pit-abc',
};

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('GoHighLevelCrmClient', () => {
  it('upsertContact envia locationId + phone e devolve o id do contato', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ contact: { id: 'C1' } }));
    const client = new GoHighLevelCrmClient(cfg, fetchFn as unknown as typeof fetch);

    const id = await client.upsertContact('5521999998888', 'Ana');

    expect(id).toBe('C1');
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://services.leadconnectorhq.com/contacts/upsert');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer pit-abc',
      Version: '2021-07-28',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      locationId: 'LOC123',
      phone: '5521999998888',
      name: 'Ana',
    });
  });

  it('omite o name quando não informado (não sobrescreve paciente já cadastrado)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ contact: { id: 'C1' } }));
    const client = new GoHighLevelCrmClient(cfg, fetchFn as unknown as typeof fetch);

    await client.upsertContact('5521999998888');

    expect(JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      locationId: 'LOC123',
      phone: '5521999998888',
    });
  });

  it('aceita o id no formato alternativo (raiz da resposta)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ id: 'C9' }));
    const client = new GoHighLevelCrmClient(cfg, fetchFn as unknown as typeof fetch);

    expect(await client.upsertContact('5521999')).toBe('C9');
  });

  it('falha explicitamente quando a resposta não traz id', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ contact: {} }));
    const client = new GoHighLevelCrmClient(cfg, fetchFn as unknown as typeof fetch);

    await expect(client.upsertContact('5521999')).rejects.toThrow(/não devolveu o id/);
  });

  it('addNote posta no contato certo', async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({}));
    const client = new GoHighLevelCrmClient(cfg, fetchFn as unknown as typeof fetch);

    await client.addNote('C1', '[Ligação Sonax] encerrada');

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://services.leadconnectorhq.com/contacts/C1/notes');
    expect(JSON.parse(init.body as string)).toEqual({ body: '[Ligação Sonax] encerrada' });
  });

  it('upsertContactWithNote faz upsert e depois anexa a nota, nessa ordem', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(ok({ contact: { id: 'C7' } }))
      .mockResolvedValueOnce(ok({}));
    const client = new GoHighLevelCrmClient(cfg, fetchFn as unknown as typeof fetch);

    await client.upsertContactWithNote('5521999', 'nota da ligação');

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[0][0]).toContain('/contacts/upsert');
    expect(fetchFn.mock.calls[1][0]).toContain('/contacts/C7/notes');
  });

  it('propaga erro da API como ExternalApiError com o status', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('nope', { status: 401 }));
    const client = new GoHighLevelCrmClient(cfg, fetchFn as unknown as typeof fetch);

    await expect(client.upsertContact('5521999')).rejects.toBeInstanceOf(ExternalApiError);
  });
});
