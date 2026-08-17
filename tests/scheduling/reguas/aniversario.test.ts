import { describe, it, expect, vi } from 'vitest';
import {
  isBirthdayToday,
  parseDayMonth,
  runAniversariantes,
} from '../../../src/scheduling/reguas/jobs';
import type { ClinicorpClient } from '../../../src/integrations/clinicorp/types';

const HOJE = new Date('2026-08-17T12:00:00.000Z'); // 17 de agosto

function clinicorpCom(birthdays: unknown[]): ClinicorpClient {
  return { listBirthdays: vi.fn().mockResolvedValue(birthdays) } as unknown as ClinicorpClient;
}

describe('parseDayMonth', () => {
  it('lê ISO com e sem hora', () => {
    expect(parseDayMonth('1990-08-17')).toEqual({ day: 17, month: 8 });
    expect(parseDayMonth('1990-08-17T00:00:00.000Z')).toEqual({ day: 17, month: 8 });
  });

  it('lê DD/MM/AAAA', () => {
    expect(parseDayMonth('17/08/1990')).toEqual({ day: 17, month: 8 });
    expect(parseDayMonth('7/8/1990')).toEqual({ day: 7, month: 8 });
  });

  it('devolve null em formato desconhecido', () => {
    expect(parseDayMonth('17 de agosto')).toBeNull();
    expect(parseDayMonth('')).toBeNull();
  });
});

describe('isBirthdayToday', () => {
  it('true quando dia e mês batem, em qualquer ano', () => {
    expect(isBirthdayToday('1990-08-17', HOJE)).toBe(true);
    expect(isBirthdayToday('17/08/1955', HOJE)).toBe(true);
  });

  it('false para outro dia ou outro mês', () => {
    expect(isBirthdayToday('1990-08-18', HOJE)).toBe(false);
    expect(isBirthdayToday('1990-07-17', HOJE)).toBe(false);
  });

  it('data ilegível não dispara (não enviar na dúvida)', () => {
    expect(isBirthdayToday('sem data', HOJE)).toBe(false);
  });
});

describe('runAniversariantes — trava de data', () => {
  it('envia SÓ para quem faz aniversário hoje, mesmo se a API devolver o mês inteiro', async () => {
    const clinicorp = clinicorpCom([
      { patientId: 1, name: 'Ana', birthDate: '1990-08-17', age: 36, mobilePhone: '5521999990001' },
      { patientId: 2, name: 'Bruno', birthDate: '1985-08-18', age: 41, mobilePhone: '5521999990002' },
      { patientId: 3, name: 'Carla', birthDate: '1979-08-02', age: 47, mobilePhone: '5521999990003' },
      { patientId: 4, name: 'Davi', birthDate: '2000-07-17', age: 26, mobilePhone: '5521999990004' },
    ]);
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runAniversariantes(clinicorp, dispatch, HOJE);

    expect(sent).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana' }));
  });

  it('não envia quando a data é ilegível', async () => {
    const clinicorp = clinicorpCom([
      { patientId: 1, name: 'Sem Data', birthDate: '??', age: 30, mobilePhone: '5521999990001' },
    ]);
    const dispatch = vi.fn().mockResolvedValue(undefined);

    expect(await runAniversariantes(clinicorp, dispatch, HOJE)).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('continua separando a trilha infantil pela idade', async () => {
    const clinicorp = clinicorpCom([
      { patientId: 1, name: 'Pedrinho', birthDate: '2018-08-17', age: 8, mobilePhone: '5521999990001' },
    ]);
    const dispatch = vi.fn().mockResolvedValue(undefined);

    await runAniversariantes(clinicorp, dispatch, HOJE);

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ track: 'infantil' }));
  });
});
