import { ExternalApiError } from '../../lib/errors';
import { withRetry, type RetryOptions } from '../../lib/retry';
import type {
  ClinicorpConfig,
  ClinicorpClient,
  CreateAppointmentInput,
  AppointmentResult,
  AvailabilityQuery,
  AvailableSlot,
  Professional,
  Birthday,
  Specialty,
} from './types';

export class HttpClinicorpClient implements ClinicorpClient {
  private readonly authHeader: string;

  constructor(
    private readonly config: ClinicorpConfig,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly retryOpts: RetryOptions = {},
  ) {
    this.authHeader = 'Basic ' + Buffer.from(`${config.user}:${config.token}`).toString('base64');
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const url = new URL(`${this.config.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    options: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    return withRetry(async () => {
      const url = this.buildUrl(path, options.query);

      const headers: Record<string, string> = {
        Authorization: this.authHeader,
        Accept: 'application/json',
      };

      if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      const res = await this.fetchFn(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      if (!res.ok) {
        throw new ExternalApiError(
          `Clinicorp ${method} ${path} -> ${res.status}`,
          res.status,
        );
      }

      return res.json() as Promise<T>;
    }, this.retryOpts);
  }

  async createAppointment(input: CreateAppointmentInput): Promise<AppointmentResult> {
    const body: Record<string, unknown> = {
      PatientName: input.patient.name,
      MobilePhone: input.patient.phone,
      fromTime: input.fromTime,
      toTime: input.toTime,
      date: input.date,
      Clinic_BusinessId: this.config.businessId,
    };

    if (input.scheduleToId !== undefined) {
      // Chair-based booking: send ScheduleTo* and omit Dentist_PersonId to avoid conflict
      body.ScheduleToId = input.scheduleToId;
      body.ScheduleToType = input.scheduleToType ?? 'CHAIR';
    } else {
      // Professional-based booking (default): send Dentist_PersonId only
      body.Dentist_PersonId = input.dentistPersonId;
    }

    if (input.patient.email !== undefined) {
      body.Email = input.patient.email;
    }

    if (input.patient.personId !== undefined) {
      body.Patient_PersonId = input.patient.personId;
    }

    if (input.procedures !== undefined) {
      body.Procedures = input.procedures;
    }

    if (input.categoryDescription !== undefined) {
      body.CategoryDescription = input.categoryDescription;
    }

    if (input.categoryColor !== undefined) {
      body.CategoryColor = input.categoryColor;
    }

    const response = await this.request<
      { id?: number; Deleted?: string } | Array<{ id?: number; Deleted?: string }>
    >(
      'POST',
      '/appointment/create_appointment_by_api',
      { body },
    );

    // Real API returns a single object; be defensive and also accept an array
    const result = Array.isArray(response) ? response[0] : response;

    if (!result || result.id == null || result.Deleted === 'X') {
      throw new ExternalApiError('Clinicorp não confirmou criação', 502);
    }

    return {
      appointmentId: String(result.id),
      status: 'confirmed',
    };
  }

  async cancelAppointment(appointmentId: string): Promise<{ released: boolean }> {
    await this.request<unknown>('POST', '/appointment/cancel_appointment', {
      body: {
        subscriber_id: this.config.subscriberId,
        id: appointmentId,
      },
    });

    return { released: true };
  }

  async listProfessionals(): Promise<Professional[]> {
    return this.request<Professional[]>('GET', '/professional/list_all_professionals', {
      query: { subscriber_id: this.config.subscriberId },
    });
  }

  async listBirthdays(): Promise<Birthday[]> {
    const raw = await this.request<Array<{
      PatientId: number;
      Name: string;
      BirthDate: string;
      Age: number;
      Email?: string;
      MobilePhone?: string;
    }>>('GET', '/patient/birthdays', {
      query: { subscriber_id: this.config.subscriberId },
    });

    return raw.map((r) => {
      const b: Birthday = {
        patientId: r.PatientId,
        name: r.Name,
        birthDate: r.BirthDate,
        age: r.Age,
      };
      if (r.Email) b.email = r.Email;
      if (r.MobilePhone) b.mobilePhone = r.MobilePhone;
      return b;
    });
  }

  async listSpecialties(): Promise<Specialty[]> {
    const raw = await this.request<Array<{
      id: number;
      Description: string;
      Type: string;
      Active: string;
    }>>('GET', '/procedures/list_specialties', {
      query: { subscriber_id: this.config.subscriberId },
    });

    return raw.map((r) => ({
      id: r.id,
      description: r.Description,
      type: r.Type,
      active: r.Active === 'X',
    }));
  }

  async getAvailability(query: AvailabilityQuery): Promise<AvailableSlot[]> {
    // O endpoint de disponibilidade exige o "código de acesso" do Agendamento Online da Clinicorp.
    // O VALOR vem de `config.accessCode` e o NOME do parâmetro de `config.accessCodeParam`
    // (default confirmado: 'code_link', ex: 60903 ou o slug do link de agendamento).
    // A API ignora professionalId — filtramos client-side quando informado.
    const accessParam = this.config.accessCodeParam ?? 'code_link';

    const raw = await this.request<Array<{
      From: string;
      To: string;
      DayWeek: number;
      BusinessId: number;
      ProfessionalId: number;
    }>>('GET', '/appointment/get_avaliable_times_calendar', {
      query: {
        subscriber_id: this.config.subscriberId,
        date: query.date,
        ...(this.config.accessCode !== undefined ? { [accessParam]: this.config.accessCode } : {}),
      },
    });

    const slots: AvailableSlot[] = raw.map((r) => ({
      from: r.From,
      to: r.To,
      dayWeek: r.DayWeek,
      businessId: r.BusinessId,
      professionalId: r.ProfessionalId,
    }));

    if (query.professionalId !== undefined) {
      return slots.filter((s) => s.professionalId === query.professionalId);
    }

    return slots;
  }
}
