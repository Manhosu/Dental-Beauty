import type { ClinicorpClient } from '../integrations/clinicorp/types';
import type { SlotLock } from './lock';
import { logger } from '../lib/logger';

export interface BookRequest {
  slotId: string;
  professionalId: string;
  specialty: string;
  patient: { name: string; phone: string };
}

export type BookResult =
  | { status: 'confirmed'; appointmentId: string }
  | { status: 'slot_taken' }
  | { status: 'failed'; reason: string };

export class SchedulingEngine {
  constructor(
    private readonly client: ClinicorpClient,
    private readonly lock: SlotLock,
    private readonly lockTtlMs = 30_000,
  ) {}

  async book(req: BookRequest): Promise<BookResult> {
    const handle = await this.lock.acquire(req.professionalId, req.slotId, this.lockTtlMs);
    if (!handle) return { status: 'slot_taken' };

    try {
      const result = await this.client.createAppointment({
        slotId: req.slotId,
        specialty: req.specialty,
        patient: req.patient,
      });
      return { status: 'confirmed', appointmentId: result.appointmentId };
    } catch (err) {
      logger.error({ err: (err as Error).message, slotId: req.slotId }, 'falha ao agendar');
      return { status: 'failed', reason: (err as Error).message };
    } finally {
      await this.lock.release(handle);
    }
  }
}
