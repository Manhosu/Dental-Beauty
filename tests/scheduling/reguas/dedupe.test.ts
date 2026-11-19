import { describe, it, expect, vi } from 'vitest';
import {
  createMemorySentRegistry,
  createRedisSentRegistry,
  sentKey,
  withDedupe,
  type DedupeRedis,
} from '../../../src/scheduling/reguas/dedupe';
import type { ReguaPayload } from '../../../src/scheduling/reguas/dispatcher';

const HOJE = (): string => '2026-08-13';

const payload = (over: Partial<ReguaPayload> = {}): ReguaPayload => ({
  type: 'aniversario',
  phone: '(21) 99999-8888',
  name: 'Ana',
  ...over,
});

describe('sentKey', () => {
  it('normaliza o telefone e separa por régua e dia', () => {
    expect(sentKey(payload(), '2026-08-13')).toBe('regua:sent:aniversario:2026-08-13:21999998888');
  });

  it('réguas diferentes para o mesmo paciente não colidem', () => {
    expect(sentKey(payload({ type: 'nps' }), '2026-08-13')).not.toBe(
      sentKey(payload({ type: 'no_show' }), '2026-08-13'),
    );
  });
});

describe('createRedisSentRegistry', () => {
  it('usa SET NX EX e traduz OK/null em true/false', async () => {
    const redis: DedupeRedis = {
      set: vi.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null),
      del: vi.fn().mockResolvedValue(1),
    };
    const registry = createRedisSentRegistry(redis);

    expect(await registry.claim('k', 60)).toBe(true);
    expect(await registry.claim('k', 60)).toBe(false);
    expect(redis.set).toHaveBeenCalledWith('k', '1', 'EX', 60, 'NX');

    await registry.release('k');
    expect(redis.del).toHaveBeenCalledWith('k');
  });
});

describe('createMemorySentRegistry', () => {
  it('a primeira reserva vence e a segunda falha', async () => {
    const registry = createMemorySentRegistry();
    expect(await registry.claim('k', 60)).toBe(true);
    expect(await registry.claim('k', 60)).toBe(false);
  });

  it('libera a reserva ao release', async () => {
    const registry = createMemorySentRegistry();
    await registry.claim('k', 60);
    await registry.release('k');
    expect(await registry.claim('k', 60)).toBe(true);
  });
});

describe('withDedupe', () => {
  it('envia na primeira vez e ignora a repetição do mesmo dia', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const guarded = withDedupe(dispatch, createMemorySentRegistry(), HOJE);

    await guarded(payload());
    await guarded(payload());

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('pacientes diferentes passam normalmente', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const guarded = withDedupe(dispatch, createMemorySentRegistry(), HOJE);

    await guarded(payload({ phone: '21999998888' }));
    await guarded(payload({ phone: '21777776666' }));

    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('no dia seguinte o mesmo paciente pode receber de novo', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    let dia = '2026-08-13';
    const guarded = withDedupe(dispatch, createMemorySentRegistry(), () => dia);

    await guarded(payload());
    dia = '2026-08-14';
    await guarded(payload());

    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('falha no envio libera a reserva para nova tentativa', async () => {
    const dispatch = vi
      .fn()
      .mockRejectedValueOnce(new Error('webhook fora do ar'))
      .mockResolvedValue(undefined);
    const guarded = withDedupe(dispatch, createMemorySentRegistry(), HOJE);

    await expect(guarded(payload())).rejects.toThrow('webhook fora do ar');
    await guarded(payload());

    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});
