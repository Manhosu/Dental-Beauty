import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BUSINESS_HOURS,
  attendanceStatus,
  isBusinessHours,
  parseHhMm,
  parseWeekdays,
  type BusinessHoursConfig,
} from '../../src/domain/businessHours';

// 12:00 UTC = 09:00 BRT. Datas escolhidas: 2026-08-12 é uma quarta-feira.
const QUARTA = (hhmmUtc: string): Date => new Date(`2026-08-12T${hhmmUtc}:00.000Z`);
const SABADO = (hhmmUtc: string): Date => new Date(`2026-08-15T${hhmmUtc}:00.000Z`);

describe('parseHhMm', () => {
  it('converte HH:mm em minutos', () => {
    expect(parseHhMm('09:00')).toBe(540);
    expect(parseHhMm('18:30')).toBe(1110);
    expect(parseHhMm('0:05')).toBe(5);
  });

  it('rejeita formato inválido', () => {
    expect(() => parseHhMm('9h')).toThrow();
    expect(() => parseHhMm('25:00')).toThrow();
  });
});

describe('parseWeekdays', () => {
  it('usa o fallback quando vazio', () => {
    expect(parseWeekdays(undefined, [1, 2])).toEqual([1, 2]);
    expect(parseWeekdays('   ', [1, 2])).toEqual([1, 2]);
  });

  it('lê a lista e descarta valores inválidos', () => {
    expect(parseWeekdays('1,2,3,4,5', [0])).toEqual([1, 2, 3, 4, 5]);
    expect(parseWeekdays('1, 9, 6', [0])).toEqual([1, 6]);
  });
});

describe('isBusinessHours (default seg–sex 09:00–18:00 BRT)', () => {
  it('quarta às 09:00 BRT está DENTRO', () => {
    expect(isBusinessHours(QUARTA('12:00'), DEFAULT_BUSINESS_HOURS)).toBe(true);
  });

  it('quarta às 08:59 BRT está FORA', () => {
    expect(isBusinessHours(QUARTA('11:59'), DEFAULT_BUSINESS_HOURS)).toBe(false);
  });

  it('o fim do expediente é exclusivo: 18:00 BRT já é FORA', () => {
    expect(isBusinessHours(QUARTA('21:00'), DEFAULT_BUSINESS_HOURS)).toBe(false);
    expect(isBusinessHours(QUARTA('20:59'), DEFAULT_BUSINESS_HOURS)).toBe(true);
  });

  it('sábado está sempre FORA no default', () => {
    expect(isBusinessHours(SABADO('15:00'), DEFAULT_BUSINESS_HOURS)).toBe(false);
  });

  it('respeita dias configurados (sábado com expediente)', () => {
    const cfg: BusinessHoursConfig = { ...DEFAULT_BUSINESS_HOURS, days: [1, 2, 3, 4, 5, 6] };
    expect(isBusinessHours(SABADO('15:00'), cfg)).toBe(true);
  });

  it('a virada de dia pelo offset é considerada (22:00 BRT de quarta = 01:00 UTC de quinta)', () => {
    // 2026-08-13T01:00Z → 2026-08-12 22:00 BRT (quarta, fora do expediente)
    expect(isBusinessHours(new Date('2026-08-13T01:00:00.000Z'), DEFAULT_BUSINESS_HOURS)).toBe(false);
  });
});

describe('attendanceStatus', () => {
  it('dentro do horário → recepção', () => {
    expect(attendanceStatus(QUARTA('13:30'), DEFAULT_BUSINESS_HOURS)).toEqual({
      businessHours: true,
      attendant: 'recepcao',
      localTime: '10:30',
      weekday: 3,
      automationsAlwaysOn: true,
    });
  });

  it('fora do horário → IA', () => {
    const status = attendanceStatus(QUARTA('23:00'), DEFAULT_BUSINESS_HOURS);
    expect(status.businessHours).toBe(false);
    expect(status.attendant).toBe('ia');
    expect(status.localTime).toBe('20:00');
  });

  it('automações são sempre ativas, independente do horário', () => {
    expect(attendanceStatus(SABADO('04:00'), DEFAULT_BUSINESS_HOURS).automationsAlwaysOn).toBe(true);
  });
});
