import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startReguas } from '../../../src/scheduling/reguas/cronEngine';
import type { ClinicorpClient } from '../../../src/integrations/clinicorp/types';

function fakeClinicorp(): ClinicorpClient {
  return {
    getAvailability: vi.fn(),
    createAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
    listProfessionals: vi.fn(),
    listAppointmentsByDate: vi.fn().mockResolvedValue([]),
    listAppointmentStatuses: vi.fn().mockResolvedValue([]),
    listBirthdays: vi.fn().mockResolvedValue([{ patientId: 1, name: 'Ana', birthDate: '1990-08-13', age: 30, mobilePhone: '5521999' }]),
    listSpecialties: vi.fn(),
    findPatientByPhone: vi.fn(),
    getPatientById: vi.fn().mockResolvedValue(null),
  } as unknown as ClinicorpClient;
}

/** Espera as promises pendentes do boot resolverem (o catch-up é disparado sem await). */
const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

describe('startReguas — catch-up de boot', () => {
  beforeEach(() => {
    // setImmediate fica real de propósito: é o que o `flush()` usa para esperar o catch-up,
    // que roda fora do relógio virtual.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('roda no boot quando o serviço sobe DEPOIS do horário alvo', async () => {
    // 15:00 UTC — o alvo (12h UTC) já passou hoje. É o caso do Render reiniciando à tarde.
    vi.setSystemTime(new Date('2026-08-13T15:00:00.000Z'));
    const aniversario = vi.fn().mockResolvedValue(undefined);

    const stop = startReguas({ clinicorp: fakeClinicorp(), dispatchers: { aniversario } });
    await flush();
    stop();

    expect(aniversario).toHaveBeenCalledTimes(1);
  });

  it('NÃO roda no boot quando o serviço sobe ANTES do horário alvo', async () => {
    vi.setSystemTime(new Date('2026-08-13T08:00:00.000Z'));
    const aniversario = vi.fn().mockResolvedValue(undefined);

    const stop = startReguas({ clinicorp: fakeClinicorp(), dispatchers: { aniversario } });
    await flush();
    stop();

    expect(aniversario).not.toHaveBeenCalled();
  });

  it('o claim impede execução dupla: um segundo boot no mesmo dia não reenvia', async () => {
    vi.setSystemTime(new Date('2026-08-13T15:00:00.000Z'));
    const aniversario = vi.fn().mockResolvedValue(undefined);
    const jaRodou = new Set<string>();
    const claimDailyRun = async (dateIso: string): Promise<boolean> => {
      if (jaRodou.has(dateIso)) return false;
      jaRodou.add(dateIso);
      return true;
    };

    const stop1 = startReguas({ clinicorp: fakeClinicorp(), dispatchers: { aniversario }, claimDailyRun });
    await flush();
    stop1();

    const stop2 = startReguas({ clinicorp: fakeClinicorp(), dispatchers: { aniversario }, claimDailyRun });
    await flush();
    stop2();

    expect(aniversario).toHaveBeenCalledTimes(1);
  });

  it('uma falha na rotina não derruba o processo nem impede o próximo agendamento', async () => {
    vi.setSystemTime(new Date('2026-08-13T15:00:00.000Z'));
    const aniversario = vi.fn().mockRejectedValue(new Error('webhook fora do ar'));

    const stop = startReguas({ clinicorp: fakeClinicorp(), dispatchers: { aniversario } });
    await expect(flush()).resolves.toBeUndefined();
    stop();

    expect(aniversario).toHaveBeenCalled();
  });

  it('stop() cancela o timer agendado', async () => {
    vi.setSystemTime(new Date('2026-08-13T08:00:00.000Z'));
    const aniversario = vi.fn().mockResolvedValue(undefined);

    const stop = startReguas({ clinicorp: fakeClinicorp(), dispatchers: { aniversario } });
    stop();
    await vi.advanceTimersByTimeAsync(6 * 3_600_000); // passa das 12h UTC

    expect(aniversario).not.toHaveBeenCalled();
  });
});
