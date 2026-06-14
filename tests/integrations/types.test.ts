import { describe, it, expect } from 'vitest';
import type { ClinicorpClient, AvailabilitySlot } from '../../src/integrations/clinicorp/types';

const fake: ClinicorpClient = {
  async getAvailability() {
    const slot: AvailabilitySlot = {
      slotId: 's1',
      professionalId: 'p1',
      unitId: 'u1',
      specialty: 'implante',
      startsAt: '2026-07-01T13:00:00Z',
    };
    return [slot];
  },
  async createAppointment() {
    return { appointmentId: 'a1', status: 'confirmed' };
  },
  async cancelAppointment() {
    return { released: true };
  },
};

describe('ClinicorpClient contract', () => {
  it('fake implementa a interface e retorna slots', async () => {
    const slots = await fake.getAvailability({ specialty: 'implante' });
    expect(slots[0].slotId).toBe('s1');
  });
});
