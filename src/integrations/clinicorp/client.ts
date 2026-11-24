import { ExternalApiError } from '../../lib/errors';
import { withRetry, type RetryOptions } from '../../lib/retry';
import { unitFromProfessionalName } from '../../domain/unit';
import type {
  ClinicorpConfig,
  ClinicorpClient,
  CreateAppointmentInput,
  AppointmentResult,
  AvailabilityQuery,
  AvailableSlot,
  Professional,
  Appointment,
  Birthday,
  Specialty,
  Patient,
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

  async findPatientByPhone(phone: string): Promise<Patient | null> {
    const digits = phone.replace(/\D/g, '');
    const response = await this.request<unknown>('GET', '/patient/get', {
      query: { subscriber_id: this.config.subscriberId, Phone: digits },
    });

    if (!Array.isArray(response) || response.length === 0) {
      return null;
    }

    type RawPatient = {
      PatientId: number;
      Name: string;
      Phone?: string;
      Email?: string;
      Status?: string;
      BirthDate?: string;
    };
    const candidatos = response as RawPatient[];

    // Um telefone pode ter mais de uma ficha, e a Clinicorp devolve as EXCLUÍDAS junto, às vezes
    // primeiro. Mandar o Patient_PersonId de uma ficha DELETED faz create_appointment_by_api
    // responder 400 — foi o que derrubou o primeiro agendamento de teste em 18/11/2026. Então só
    // vale uma ficha ativa; se todas estiverem excluídas, melhor não resolver paciente nenhum e
    // deixar a Clinicorp criar uma ficha nova.
    const raw = candidatos.find((p) => p.Status !== 'DELETED');
    if (!raw) {
      return null;
    }

    return {
      id: raw.PatientId,
      name: raw.Name,
      phone: raw.Phone,
      email: raw.Email,
      status: raw.Status,
      ...(raw.BirthDate ? { birthDate: raw.BirthDate } : {}),
    };
  }

  /**
   * Ficha pelo id. O mesmo `/patient/get` da busca por telefone, mas com `PatientId`: aí a
   * Clinicorp devolve **um objeto**, não uma lista, então não há como pegar a ficha errada.
   *
   * Existe por causa da anamnese infantil: o telefone do agendamento de uma criança é o do
   * responsável, e buscar por ele traria a data de nascimento do adulto.
   */
  async getPatientById(patientId: number): Promise<import('./types').Patient | null> {
    type RawPatient = {
      PatientId?: number;
      Name?: string;
      Phone?: string;
      Email?: string;
      Status?: string;
      BirthDate?: string;
    };

    const raw = await this.request<RawPatient>('GET', '/patient/get', {
      query: { subscriber_id: this.config.subscriberId, PatientId: String(patientId) },
    });

    if (!raw || raw.PatientId === undefined) return null;

    return {
      id: raw.PatientId,
      name: raw.Name ?? '',
      phone: raw.Phone,
      email: raw.Email,
      status: raw.Status,
      ...(raw.BirthDate ? { birthDate: raw.BirthDate } : {}),
    };
  }

  async createAppointment(input: CreateAppointmentInput): Promise<AppointmentResult> {
    // Auto-resolve existing patient by phone to avoid PatientNameAlreadyExists conflict
    let resolvedPersonId = input.patient.personId;
    if (resolvedPersonId === undefined && input.patient.phone) {
      const found = await this.findPatientByPhone(input.patient.phone);
      if (found !== null) {
        resolvedPersonId = found.id;
      }
    }

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

    if (resolvedPersonId !== undefined) {
      body.Patient_PersonId = resolvedPersonId;
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

    type CreateResponse = { id?: number; Deleted?: string; PatientNameAlreadyExists?: boolean };
    const response = await this.request<CreateResponse | CreateResponse[]>(
      'POST',
      '/appointment/create_appointment_by_api',
      { body },
    );

    // Real API returns a single object; be defensive and also accept an array
    const result = Array.isArray(response) ? response[0] : response;

    // Guarda da Clinicorp: nome de paciente já cadastrado exige Patient_PersonId.
    // Sinaliza ao chamador para resolver o paciente (buscar/criar) antes de reagendar.
    if (result?.PatientNameAlreadyExists === true) {
      throw new ExternalApiError(
        'Paciente com este nome já existe na Clinicorp — informe patient.personId',
        409,
      );
    }

    if (!result || result.id == null || result.Deleted === 'X') {
      throw new ExternalApiError('Clinicorp não confirmou criação', 502);
    }

    return {
      appointmentId: String(result.id),
      status: 'confirmed',
    };
  }

  /**
   * Cancela um agendamento e libera o horário.
   *
   * **Não existe status "Cancelado"** no vocabulário desta conta (`/appointment/status_list`
   * devolve só Confirmado, Em espera, Em atendimento, Atendido, Atrasado, Ligar, Prótese pendente
   * e Faltou). Este endpoint é o único caminho para soltar a vaga.
   *
   * O registro **não some do Clinicorp**: os agendamentos trazem um campo `Deleted`, e
   * `/appointment/list` só devolve os que estão com ele vazio — em 421 agendamentos de 7 semanas,
   * todos vinham `Deleted: ""`. Ou seja, é baixa lógica: a listagem passa a ignorar o registro,
   * mas ele continua gravado. É o que a clínica pediu ("não excluir, para ficar registrado que não
   * houve retorno").
   *
   * A resposta crua volta junto para quem chamar poder registrar o que a Clinicorp respondeu na
   * primeira execução real — é a única forma de confirmar o comportamento sem cancelar a consulta
   * de alguém só para testar.
   */
  async cancelAppointment(appointmentId: string): Promise<{ released: boolean; resposta: unknown }> {
    const resposta = await this.request<unknown>('POST', '/appointment/cancel_appointment', {
      body: {
        subscriber_id: this.config.subscriberId,
        id: appointmentId,
      },
    });

    return { released: true, resposta };
  }

  async listProfessionals(): Promise<Professional[]> {
    const raw = await this.request<Array<{ id: number; name: string; cpf: string }>>(
      'GET',
      '/professional/list_all_professionals',
      { query: { subscriber_id: this.config.subscriberId } },
    );
    return raw.map((r) => ({
      id: r.id,
      name: r.name,
      cpf: r.cpf,
      unit: unitFromProfessionalName(r.name),
    }));
  }

  async listAppointmentsByDate(from: string, to?: string): Promise<Appointment[]> {
    // GET /appointment/list exige subscriber_id + from/to (YYYY-MM-DD). `to` default = `from` (um dia).
    const raw = await this.request<Array<{
      id: number;
      PatientName?: string;
      MobilePhone?: string;
      Email?: string;
      Dentist_PersonId?: number;
      date: string;
      fromTime: string;
      toTime: string;
      Procedures?: string;
      CategoryDescription?: string;
      StatusId?: number;
      Deleted?: string;
      CreateDate?: string;
      Patient_PersonId?: number;
    }>>('GET', '/appointment/list', {
      query: { subscriber_id: this.config.subscriberId, from, to: to ?? from },
    });

    // Enriquece com nome/unidade do profissional (mesmo padrão de getAvailability).
    const professionals = await this.listProfessionals();
    const profMap = new Map<number, { name: string; unit: import('./types').ClinicUnit }>(
      professionals.map((p) => [p.id, { name: p.name, unit: p.unit }]),
    );

    return raw
      .filter((r) => r.Deleted !== 'X') // descarta agendamentos cancelados/excluídos
      .map((r) => {
        const prof = r.Dentist_PersonId !== undefined ? profMap.get(r.Dentist_PersonId) : undefined;
        const appt: Appointment = {
          id: String(r.id),
          patientName: r.PatientName ?? '',
          date: r.date,
          fromTime: r.fromTime,
          toTime: r.toTime,
        };
        if (r.MobilePhone) appt.mobilePhone = r.MobilePhone;
        if (r.Email) appt.email = r.Email;
        if (r.Dentist_PersonId !== undefined) appt.dentistPersonId = r.Dentist_PersonId;
        if (prof !== undefined) {
          appt.professionalName = prof.name;
          appt.unit = prof.unit;
        }
        if (r.Procedures) appt.procedures = r.Procedures;
        if (r.CategoryDescription) appt.categoryDescription = r.CategoryDescription;
        if (r.StatusId !== undefined) appt.statusId = r.StatusId;
        if (r.CreateDate) appt.createdAt = r.CreateDate;
        if (r.Patient_PersonId !== undefined) appt.patientId = r.Patient_PersonId;
        return appt;
      });
  }

  async listAppointmentStatuses(): Promise<import('./types').AppointmentStatus[]> {
    const response = await this.request<{ list: Array<{
      id: number;
      Type: string;
      Description: string;
      Active?: string;
    }> }>('GET', '/appointment/status_list', {
      query: { subscriber_id: this.config.subscriberId },
    });

    return (response.list ?? []).map((r) => ({
      id: r.id,
      type: r.Type,
      description: r.Description,
      active: r.Active === 'X',
    }));
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
    // Call order: 1) GET availability, 2) GET professionals (for enrichment).
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

    // Enrich slots with professionalName and unit derived from the professionals list.
    const professionals = await this.listProfessionals();
    const profMap = new Map<number, { name: string; unit: import('./types').ClinicUnit }>(
      professionals.map((p) => [p.id, { name: p.name, unit: p.unit }]),
    );

    const slots: AvailableSlot[] = raw.map((r) => {
      const prof = profMap.get(r.ProfessionalId);
      return {
        from: r.From,
        to: r.To,
        dayWeek: r.DayWeek,
        businessId: r.BusinessId,
        professionalId: r.ProfessionalId,
        ...(prof !== undefined ? { professionalName: prof.name, unit: prof.unit } : {}),
      };
    });

    if (query.professionalId !== undefined) {
      return slots.filter((s) => s.professionalId === query.professionalId);
    }

    return slots;
  }
}
