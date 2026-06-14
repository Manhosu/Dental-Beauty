export interface AvailabilitySlot {
  slotId: string;
  professionalId: string;
  unitId: string;
  specialty: string;
  startsAt: string; // ISO 8601
}

export interface AvailabilityQuery {
  specialty: string;
  professionalId?: string;
  unitId?: string;
  from?: string;
  to?: string;
}

export interface CreateAppointmentInput {
  slotId: string;
  patient: { name: string; phone: string };
  specialty: string;
}

export interface AppointmentResult {
  appointmentId: string;
  status: 'confirmed';
}

export interface ClinicorpClient {
  getAvailability(query: AvailabilityQuery): Promise<AvailabilitySlot[]>;
  createAppointment(input: CreateAppointmentInput): Promise<AppointmentResult>;
  cancelAppointment(appointmentId: string): Promise<{ released: boolean }>;
}
