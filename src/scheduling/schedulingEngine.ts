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
      const reason = err instanceof Error ? err.message : String(err);
      logger.error({ err: reason, slotId: req.slotId }, 'falha ao agendar');
      return { status: 'failed', reason };
    } finally {
      const released = await this.lock.release(handle);
      if (!released) {
        logger.warn({ slotId: req.slotId }, 'lock release no-op (expirado ou ja liberado)');
      }
    }
  }
}
