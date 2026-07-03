import { describe, it, expect, vi } from 'vitest';
import {
  runAniversariantes,
  runNoShow,
  runPostProcedure,
  runNps,
  intervalMonthsForCategory,
} from '../../../src/scheduling/reguas/jobs';
import { isoDate, monthsAgoIso, runDailyReguas } from '../../../src/scheduling/reguas/cronEngine';
import { createHttpDispatcher } from '../../../src/scheduling/reguas/dispatcher';
import type { ClinicorpClient } from '../../../src/integrations/clinicorp/types';

const CHECKOUT_ID = 999;

function fakeClinicorp(over: Partial<ClinicorpClient> = {}): ClinicorpClient {
  return {
    getAvailability: vi.fn(),
    createAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
    listProfessionals: vi.fn(),
    listAppointmentsByDate: vi.fn().mockResolvedValue([]),
    listAppointmentStatuses: vi
      .fn()
      .mockResolvedValue([{ id: CHECKOUT_ID, type: 'CHECKOUT', description: '4-Atendido', active: true }]),
    listBirthdays: vi.fn().mockResolvedValue([]),
    listSpecialties: vi.fn(),
    findPatientByPhone: vi.fn(),
    ...over,
  } as unknown as ClinicorpClient;
}

describe('réguas — jobs', () => {
  it('aniversariantes: 1 disparo por paciente com telefone, pula quem não tem', async () => {
    const clinicorp = fakeClinicorp({
      listBirthdays: vi.fn().mockResolvedValue([
        { patientId: 1, name: 'Ana', birthDate: 'x', age: 30, mobilePhone: '5521999' },
        { patientId: 2, name: 'Sem Fone', birthDate: 'x', age: 40 },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runAniversariantes(clinicorp, dispatch);

    expect(sent).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'aniversario', phone: '5521999', name: 'Ana' });
  });

  it('no-show: confirma cada agendamento com telefone na data informada', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '10', patientName: 'Bruno', mobilePhone: '5521888', date: '2026-06-27T03:00:00.000Z', fromTime: '9:00', toTime: '9:30', professionalName: 'Adriana - Recreio', unit: 'Recreio' },
        { id: '11', patientName: 'NoFone', date: 'x', fromTime: '10:00', toTime: '10:30' },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runNoShow(clinicorp, dispatch, '2026-06-27');

    expect(sent).toBe(1);
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('2026-06-27');
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'no_show', phone: '5521888', appointmentId: '10', professionalName: 'Adriana - Recreio', unit: 'Recreio' }),
    );
  });

  it('pós-procedimento: só dispara ATENDIDO (CHECKOUT) no bucket de meses certo, pula faltou/sem fone', async () => {
    const appts = [
      { id: '1', patientName: 'Atend6m', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Limpeza' },
      { id: '2', patientName: 'Faltou', mobilePhone: '5522', date: 'x', fromTime: '9', toTime: '10', statusId: 111, categoryDescription: 'Limpeza' },
      { id: '3', patientName: 'Protese12m', mobilePhone: '5533', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Prótese retorno laboratório' },
      { id: '4', patientName: 'SemFone', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Limpeza' },
    ];
    const clinicorp = fakeClinicorp({ listAppointmentsByDate: vi.fn().mockResolvedValue(appts) });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runPostProcedure(clinicorp, dispatch, (m) => `d-${m}`);

    expect(sent).toBe(2); // Limpeza no bucket 6m + Prótese no bucket 12m
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('d-3');
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('d-6');
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('d-12');
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pos_procedimento', phone: '5511', procedure: 'Limpeza' }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pos_procedimento', phone: '5533' }),
    );
  });

  it('pós-procedimento: não dispara se o status CHECKOUT não existir (evita falso-positivo)', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentStatuses: vi.fn().mockResolvedValue([]),
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'X', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Limpeza' },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runPostProcedure(clinicorp, dispatch, (m) => `d-${m}`);

    expect(sent).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('NPS: dispara só para ATENDIDOS (CHECKOUT) com telefone na data', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Ana', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID },
        { id: '2', patientName: 'Faltou', mobilePhone: '5522', date: 'x', fromTime: '9', toTime: '10', statusId: 111 },
        { id: '3', patientName: 'SemFone', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runNps(clinicorp, dispatch, '2026-06-28');

    expect(sent).toBe(1);
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('2026-06-28');
    expect(dispatch).toHaveBeenCalledWith({ type: 'nps', phone: '5511', name: 'Ana' });
  });

  it('intervalMonthsForCategory: Periodontia 3m, Prótese/Coroa 12m, demais 6m', () => {
    expect(intervalMonthsForCategory('Tratamento Periodontal')).toBe(3);
    expect(intervalMonthsForCategory('Prótese retorno laboratório')).toBe(12);
    expect(intervalMonthsForCategory('Coroa')).toBe(12);
    expect(intervalMonthsForCategory('Limpeza')).toBe(6);
    expect(intervalMonthsForCategory(undefined)).toBe(6);
  });
});

describe('réguas — cronEngine', () => {
  it('isoDate desloca dias em UTC', () => {
    expect(isoDate(new Date('2026-06-26T10:00:00.000Z'), 0)).toBe('2026-06-26');
    expect(isoDate(new Date('2026-06-26T10:00:00.000Z'), 1)).toBe('2026-06-27');
  });

  it('monthsAgoIso recua meses em UTC (aritmética de calendário)', () => {
    expect(monthsAgoIso(new Date('2026-06-29T12:00:00.000Z'), 6)).toBe('2025-12-29');
    expect(monthsAgoIso(new Date('2026-06-29T12:00:00.000Z'), 12)).toBe('2025-06-29');
  });

  it('runDailyReguas roda aniversário + no-show (T-24h) quando ambos configurados', async () => {
    const clinicorp = fakeClinicorp({
      listBirthdays: vi.fn().mockResolvedValue([{ patientId: 1, name: 'Ana', birthDate: 'x', age: 30, mobilePhone: '5521999' }]),
      listAppointmentsByDate: vi.fn().mockResolvedValue([{ id: '10', patientName: 'B', mobilePhone: '5521888', date: 'x', fromTime: '9:00', toTime: '9:30' }]),
    });
    const aniversario = vi.fn().mockResolvedValue(undefined);
    const noShow = vi.fn().mockResolvedValue(undefined);

    const res = await runDailyReguas(clinicorp, { aniversario, noShow }, new Date('2026-06-26T12:00:00.000Z'));

    expect(res).toEqual({ aniversario: 1, noShow: 1, posProcedimento: 0, nps: 0 });
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('2026-06-27');
  });

  it('runDailyReguas pula no-show e pós-procedimento quando não há dispatcher', async () => {
    const clinicorp = fakeClinicorp({ listBirthdays: vi.fn().mockResolvedValue([]) });
    const aniversario = vi.fn().mockResolvedValue(undefined);

    const res = await runDailyReguas(clinicorp, { aniversario }, new Date('2026-06-26T12:00:00.000Z'));

    expect(res).toEqual({ aniversario: 0, noShow: 0, posProcedimento: 0, nps: 0 });
    expect(clinicorp.listAppointmentsByDate).not.toHaveBeenCalled();
  });

  it('runDailyReguas roda pós-procedimento quando o dispatcher existe', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Atend', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Limpeza' },
      ]),
    });
    const aniversario = vi.fn().mockResolvedValue(undefined);
    const posProcedimento = vi.fn().mockResolvedValue(undefined);

    const res = await runDailyReguas(clinicorp, { aniversario, posProcedimento }, new Date('2026-06-29T12:00:00.000Z'));

    // Limpeza = 6 meses → dispara 1x (apenas no bucket de 6m); 3m e 12m não casam.
    expect(res).toEqual({ aniversario: 0, noShow: 0, posProcedimento: 1, nps: 0 });
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('2025-12-29'); // 6 meses antes
  });

  it('runDailyReguas roda NPS (T-1) quando o dispatcher existe', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Atend', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID },
        { id: '2', patientName: 'Faltou', mobilePhone: '5522', date: 'x', fromTime: '9', toTime: '10', statusId: 111 },
      ]),
    });
    const aniversario = vi.fn().mockResolvedValue(undefined);
    const nps = vi.fn().mockResolvedValue(undefined);

    const res = await runDailyReguas(clinicorp, { aniversario, nps }, new Date('2026-06-29T12:00:00.000Z'));

    expect(res).toEqual({ aniversario: 0, noShow: 0, posProcedimento: 0, nps: 1 });
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('2026-06-28'); // ontem (T-1)
    expect(nps).toHaveBeenCalledWith(expect.objectContaining({ type: 'nps', phone: '5511' }));
  });
});

describe('réguas — dispatcher', () => {
  it('faz POST com headers (id/token/flow) e body {nome, numero}', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const dispatch = createHttpDispatcher(
      { url: 'https://flow.example/hook', accountId: 'acc', token: 'tok', flow: 'fl' },
      fetchFn,
    );

    await dispatch({ type: 'aniversario', phone: '+55 21 99999-8888', name: 'Ana' });

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://flow.example/hook');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ id: 'acc', token: 'tok', flow: 'fl', 'Content-Type': 'application/json' });
    // numero normalizado (só dígitos)
    expect(JSON.parse(init.body as string)).toEqual({ nome: 'Ana', numero: '5521999998888' });
  });
});
