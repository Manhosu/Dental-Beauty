import { describe, it, expect, vi } from 'vitest';
import { SchedulingEngine } from '../../src/scheduling/schedulingEngine';
import type { ClinicorpClient } from '../../src/integrations/clinicorp/types';
import type { SlotLock, LockHandle } from '../../src/scheduling/lock';

function fakeLock(acquire: boolean) {
  const handle: LockHandle = { key: 'k', token: 't' };
  return {
    acquire: vi.fn(async () => (acquire ? handle : null)),
    release: vi.fn(async () => true),
  } as unknown as SlotLock;
}

function fakeClient(over: Partial<ClinicorpClient> = {}): ClinicorpClient {
  return {
    getAvailability: vi.fn(async (): Promise<unknown[]> => []),
    createAppointment: vi.fn(async () => ({ appointmentId: 'a1', status: 'confirmed' as const })),
    cancelAppointment: vi.fn(async () => ({ released: true })),
    listProfessionals: vi.fn(async () => []),
    ...over,
  };
}

const bookReq = {
  slotId: 's1',
  professionalId: 'p1',
  specialty: 'implante',
  patient: { name: 'Maria', phone: '5521999998888' },
  date: '2026-07-01T13:00:00.000Z',
  fromTime: '13:00',
  toTime: '14:00',
  dentistPersonId: 222,
  scheduleToId: 333,
};

describe('SchedulingEngine.book', () => {
  it('confirma quando lock é obtido e Clinicorp responde sucesso', async () => {
    const lock = fakeLock(true);
    const client = fakeClient();
    const engine = new SchedulingEngine(client, lock, 30_000);
    const res = await engine.book(bookReq);
    expect(res.status).toBe('confirmed');
    expect((res as Extract<typeof res, { status: 'confirmed' }>).appointmentId).toBe('a1');
    expect(lock.release).toHaveBeenCalledOnce();
  });

  it('retorna slot_taken quando o lock não é obtido (concorrência)', async () => {
    const lock = fakeLock(false);
    const client = fakeClient();
    const engine = new SchedulingEngine(client, lock, 30_000);
    const res = await engine.book(bookReq);
    expect(res.status).toBe('slot_taken');
    expect(client.createAppointment).not.toHaveBeenCalled();
  });

  it('libera o lock e retorna failed se a Clinicorp falhar', async () => {
    const lock = fakeLock(true);
    const client = fakeClient({
      createAppointment: vi.fn(async () => {
        throw new Error('clinicorp down');
      }),
    });
    const engine = new SchedulingEngine(client, lock, 30_000);
    const res = await engine.book(bookReq);
    expect(res.status).toBe('failed');
    expect(lock.release).toHaveBeenCalledOnce();
  });
});
