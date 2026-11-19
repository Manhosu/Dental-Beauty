import { describe, expect, it, vi } from 'vitest';
import {
  createMemoryVisitCounter,
  createRedisVisitCounter,
  visitKey,
  visitaPedePesquisa,
  NPS_A_CADA_N_VISITAS,
  VISITAS_TTL_SECONDS,
} from '../../../src/scheduling/reguas/visitCounter';

describe('visitKey', () => {
  it('normaliza o telefone: o mesmo paciente não pode virar duas contagens', () => {
    expect(visitKey('(21) 99999-8888')).toBe(visitKey('21999998888'));
    expect(visitKey('+55 21 99999-8888')).toBe('regua:visitas:5521999998888');
  });
});

describe('visitaPedePesquisa', () => {
  it('sai na 1ª vinda e depois a cada três', () => {
    const vindas = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(vindas.filter((n) => visitaPedePesquisa(n))).toEqual([1, 4, 7, 10]);
  });

  it('respeita um espaçamento diferente quando pedido', () => {
    expect([1, 2, 3, 4, 5].filter((n) => visitaPedePesquisa(n, 2))).toEqual([1, 3, 5]);
  });

  it('não pede pesquisa para quem não tem visita contada', () => {
    expect(visitaPedePesquisa(0)).toBe(false);
    expect(visitaPedePesquisa(-1)).toBe(false);
  });

  it('o padrão é a cada 3 vindas, como o cliente pediu', () => {
    expect(NPS_A_CADA_N_VISITAS).toBe(3);
  });
});

describe('createMemoryVisitCounter', () => {
  it('conta por paciente', async () => {
    const counter = createMemoryVisitCounter();

    expect(await counter.increment('5511')).toBe(1);
    expect(await counter.increment('5511')).toBe(2);
    expect(await counter.increment('5522')).toBe(1);
  });

  it('o mesmo telefone em formatos diferentes é o mesmo paciente', async () => {
    const counter = createMemoryVisitCounter();

    await counter.increment('21999998888');
    expect(await counter.increment('(21) 99999-8888')).toBe(2);
  });
});

describe('createRedisVisitCounter', () => {
  it('incrementa e renova a validade a cada visita', async () => {
    const incr = vi.fn(async (_key: string) => 4);
    const expire = vi.fn(async (_key: string, _ttl: number) => 1);
    const counter = createRedisVisitCounter({ incr, expire });

    expect(await counter.increment('5511')).toBe(4);
    expect(incr).toHaveBeenCalledWith('regua:visitas:5511');
    // Sem renovar, o paciente que some por um ano perderia a contagem e a pesquisa voltaria do zero.
    expect(expire).toHaveBeenCalledWith('regua:visitas:5511', VISITAS_TTL_SECONDS);
  });
});
