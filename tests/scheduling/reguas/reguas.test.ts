import { describe, it, expect, vi } from 'vitest';
import { runAniversariantes, runNoShow } from '../../../src/scheduling/reguas/jobs';
import { isoDate, runDailyReguas } from '../../../src/scheduling/reguas/cronEngine';
import { createHttpDispatcher } from '../../../src/scheduling/reguas/dispatcher';
import type { ClinicorpClient } from '../../../src/integrations/clinicorp/types';

function fakeClinicorp(over: Partial<ClinicorpClient> = {}): ClinicorpClient {
  return {
    getAvailability: vi.fn(),
    createAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
    listProfessionals: vi.fn(),
    listAppointmentsByDate: vi.fn().mockResolvedValue([]),
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
});

describe('réguas — cronEngine', () => {
  it('isoDate desloca dias em UTC', () => {
    expect(isoDate(new Date('2026-06-26T10:00:00.000Z'), 0)).toBe('2026-06-26');
    expect(isoDate(new Date('2026-06-26T10:00:00.000Z'), 1)).toBe('2026-06-27');
  });

  it('runDailyReguas roda aniversário + no-show de amanhã (T-24h)', async () => {
    const clinicorp = fakeClinicorp({
      listBirthdays: vi.fn().mockResolvedValue([{ patientId: 1, name: 'Ana', birthDate: 'x', age: 30, mobilePhone: '5521999' }]),
      listAppointmentsByDate: vi.fn().mockResolvedValue([{ id: '10', patientName: 'B', mobilePhone: '5521888', date: 'x', fromTime: '9:00', toTime: '9:30' }]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const res = await runDailyReguas(clinicorp, dispatch, new Date('2026-06-26T12:00:00.000Z'));

    expect(res).toEqual({ aniversario: 1, noShow: 1 });
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('2026-06-27');
  });
});

describe('réguas — dispatcher', () => {
  it('faz POST do payload na URL do fluxo', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const dispatch = createHttpDispatcher('https://flow.example/hook', fetchFn);

    await dispatch({ type: 'aniversario', phone: '5521999', name: 'Ana' });

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://flow.example/hook');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ type: 'aniversario', phone: '5521999', name: 'Ana' });
  });
});
