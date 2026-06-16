export interface ClinicorpConfig {
  baseUrl: string;
  user: string;
  token: string;
  subscriberId: string;
  businessId: number;
  accessCode?: string;
  accessCodeParam?: string; // nome do parâmetro do código de acesso (default 'access_code')
}

export interface CreateAppointmentInput {
  patient: { name: string; phone: string; email?: string; personId?: number };
  date: string;        // ISO 8601, ex '2026-07-01T13:00:00.000Z'
  fromTime: string;    // 'HH:mm'
  toTime: string;      // 'HH:mm'
  dentistPersonId: number;
  scheduleToId: number;
  scheduleToType?: 'CHAIR';
  procedures?: string;
  categoryDescription?: string;
  categoryColor?: string;
}

export interface AppointmentResult {
  appointmentId: string;
  status: 'confirmed';
}

export interface AvailabilityQuery {
  date: string;            // 'YYYY-MM-DD'
  professionalId?: number;
}

export interface Professional { id: number; name: string; cpf: string }

export interface Birthday {
  patientId: number;
  name: string;
  birthDate: string;
  age: number;
  email?: string;
  mobilePhone?: string;
}

export interface Specialty {
  id: number;
  description: string;
  type: string;
  active: boolean;
}

export interface ClinicorpClient {
  getAvailability(query: AvailabilityQuery): Promise<unknown[]>;
  createAppointment(input: CreateAppointmentInput): Promise<AppointmentResult>;
  cancelAppointment(appointmentId: string): Promise<{ released: boolean }>;
  listProfessionals(): Promise<Professional[]>;
  listBirthdays(): Promise<Birthday[]>;
  listSpecialties(): Promise<Specialty[]>;
}
