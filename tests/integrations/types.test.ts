import { describe, it, expect } from 'vitest';
import type { ClinicorpClient, AvailableSlot } from '../../src/integrations/clinicorp/types';

const fakeSlot: AvailableSlot = {
  from: '10:00',
  to: '11:00',
  dayWeek: 3,
  businessId: 6247357829611520,
  professionalId: 42,
};

const fake: ClinicorpClient = {
  async getAvailability() {
    return [fakeSlot];
  },
  async createAppointment() {
    return { appointmentId: 'a1', status: 'confirmed' };
  },
  async cancelAppointment() {
    return { released: true };
  },
  async listProfessionals() {
    return [{ id: 1, name: 'Dr. Silva', cpf: '123.456.789-00' }];
  },
  async listBirthdays() {
    return [];
  },
  async listSpecialties() {
    return [];
  },
};

describe('ClinicorpClient contract', () => {
  it('fake implementa a interface e retorna disponibilidade como AvailableSlot[]', async () => {
    const slots = await fake.getAvailability({ date: '2026-07-01' });
    expect(Array.isArray(slots)).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toMatchObject({ from: '10:00', to: '11:00', dayWeek: 3, professionalId: 42 });
  });

  it('fake cria agendamento e retorna appointmentId confirmado', async () => {
    const result = await fake.createAppointment({
      patient: { name: 'Maria', phone: '5521999998888' },
      date: '2026-07-01T13:00:00.000Z',
      fromTime: '13:00',
      toTime: '14:00',
      dentistPersonId: 1,
      scheduleToId: 2,
    });
    expect(result.appointmentId).toBe('a1');
    expect(result.status).toBe('confirmed');
  });

  it('fake lista profissionais', async () => {
    const professionals = await fake.listProfessionals();
    expect(professionals[0].id).toBe(1);
    expect(professionals[0].name).toBe('Dr. Silva');
  });
});
