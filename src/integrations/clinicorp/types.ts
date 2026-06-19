export interface ClinicorpConfig {
  baseUrl: string;
  user: string;
  token: string;
  subscriberId: string;
  businessId: number;
  accessCode?: string;
  accessCodeParam?: string; // nome do parâmetro do código de acesso (default 'code_link')
}

export interface CreateAppointmentInput {
  patient: { name: string; phone: string; email?: string; personId?: number };
  date: string;        // ISO 8601, ex '2026-07-01T13:00:00.000Z'
  fromTime: string;    // 'HH:mm'
  toTime: string;      // 'HH:mm'
  dentistPersonId: number;
  scheduleToId?: number;          // opcional — se informado, agenda por cadeira
  scheduleToType?: 'CHAIR';       // só faz sentido junto com scheduleToId
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

export interface AvailableSlot {
  from: string;          // 'H:mm' ou 'HH:mm' (mantém como veio da API, ex: '8:00')
  to: string;
  dayWeek: number;       // 0=Domingo..6=Sábado
  businessId: number;
  professionalId: number;
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

export interface Patient {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  status?: string;
}

export interface ClinicorpClient {
  getAvailability(query: AvailabilityQuery): Promise<AvailableSlot[]>;
  createAppointment(input: CreateAppointmentInput): Promise<AppointmentResult>;
  cancelAppointment(appointmentId: string): Promise<{ released: boolean }>;
  listProfessionals(): Promise<Professional[]>;
  listBirthdays(): Promise<Birthday[]>;
  listSpecialties(): Promise<Specialty[]>;
  findPatientByPhone(phone: string): Promise<Patient | null>;
}
