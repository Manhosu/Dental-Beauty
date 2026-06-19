import { describe, it, expect, vi } from 'vitest';
import { HttpClinicorpClient } from '../../../src/integrations/clinicorp/client';
import type { ClinicorpConfig } from '../../../src/integrations/clinicorp/types';
import { ExternalApiError } from '../../../src/lib/errors';

const config: ClinicorpConfig = {
  baseUrl: 'https://api.clinicorp.com/rest/v1',
  user: 'testuser',
  token: 'testtoken',
  subscriberId: 'sub123',
  businessId: 111111111111,
};

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HttpClinicorpClient', () => {
  describe('findPatientByPhone', () => {
    it('returns mapped Patient when API returns a non-empty array', async () => {
      const rawPatient = [
        {
          PatientId: 6693556813430784,
          Name: 'EDNO DA SILVA',
          Email: 'edmo@gmail.com',
          Phone: '21996160653',
          Status: 'ACTIVE',
          BirthDate: '1953-06-16T03:00:00.000Z',
        },
      ];
      const fetchFn = vi.fn().mockResolvedValue(makeResponse(rawPatient));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.findPatientByPhone('(21) 99616-0653');

      expect(result).toEqual({
        id: 6693556813430784,
        name: 'EDNO DA SILVA',
        phone: '21996160653',
        email: 'edmo@gmail.com',
        status: 'ACTIVE',
      });

      const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/patient/get');
      expect(url).toContain('subscriber_id=sub123');
      // Phone digits only (no formatting characters)
      expect(url).toContain('Phone=21996160653');
      // Must NOT have raw formatted phone
      expect(url).not.toContain('(21)');
    });

    it('returns null when API response is an empty array []', async () => {
      const fetchFn = vi.fn().mockResolvedValue(makeResponse([]));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.findPatientByPhone('21996160653');

      expect(result).toBeNull();
    });

    it('returns null when API response is an empty object {}', async () => {
      const fetchFn = vi.fn().mockResolvedValue(makeResponse({}));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.findPatientByPhone('21996160653');

      expect(result).toBeNull();
    });
  });

  describe('createAppointment', () => {
    it('professional booking: sends Dentist_PersonId, omits ScheduleToId/ScheduleToType, maps single-object response', async () => {
      const realResponse = {
        PatientName: 'João da Silva',
        fromTime: '10:00',
        toTime: '11:00',
        date: '2025-04-12T03:00:00.000Z',
        Clinic_BusinessId: 111111111111,
        Dentist_PersonId: 222222222222,
        Deleted: '',
        Patient_PersonId: 6572892430008321,
        id: 6670720980484097,
      };
      // First call: lookup by phone → not found; Second call: create appointment
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(makeResponse([]))
        .mockResolvedValueOnce(makeResponse(realResponse));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.createAppointment({
        patient: { name: 'João da Silva', phone: '(11) 91234-5678', email: 'email@dominio.com' },
        date: '2025-04-12T03:00:00.000Z',
        fromTime: '10:00',
        toTime: '11:00',
        dentistPersonId: 222222222222,
        procedures: 'Limpeza, Obturação',
        // scheduleToId intentionally omitted → professional booking
      });

      expect(result).toEqual({ appointmentId: '6670720980484097', status: 'confirmed' });

      // fetch called twice: once for lookup, once for create
      expect(fetchFn).toHaveBeenCalledTimes(2);
      const [url, init] = fetchFn.mock.calls[1] as [string, RequestInit];

      // Correct URL
      expect(url).toBe('https://api.clinicorp.com/rest/v1/appointment/create_appointment_by_api');

      // Basic auth header: base64('testuser:testtoken')
      const expectedAuth = 'Basic ' + Buffer.from('testuser:testtoken').toString('base64');
      expect((init.headers as Record<string, string>)['Authorization']).toBe(expectedAuth);

      // Body includes required fields from config and input
      const body = JSON.parse(init.body as string);
      expect(body.Clinic_BusinessId).toBe(111111111111);
      expect(body.Dentist_PersonId).toBe(222222222222);
      expect(body.PatientName).toBe('João da Silva');
      expect(body.MobilePhone).toBe('(11) 91234-5678');
      expect(body.Email).toBe('email@dominio.com');
      expect(body.Procedures).toBe('Limpeza, Obturação');

      // Must NOT send ScheduleToId / ScheduleToType for professional booking
      expect(body).not.toHaveProperty('ScheduleToId');
      expect(body).not.toHaveProperty('ScheduleToType');
    });

    it('chair booking: sends ScheduleToId and ScheduleToType, omits Dentist_PersonId', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(makeResponse([]))
        .mockResolvedValueOnce(makeResponse({ id: 9999, Deleted: '' }));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.createAppointment({
        patient: { name: 'Ana', phone: '21999990000' },
        date: '2026-07-01T13:00:00.000Z',
        fromTime: '13:00',
        toTime: '14:00',
        dentistPersonId: 222,
        scheduleToId: 123,
        scheduleToType: 'CHAIR',
      });

      expect(result).toEqual({ appointmentId: '9999', status: 'confirmed' });

      const [, init] = fetchFn.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(init.body as string);

      expect(body.ScheduleToId).toBe(123);
      expect(body.ScheduleToType).toBe('CHAIR');
      // Must NOT send Dentist_PersonId for chair booking
      expect(body).not.toHaveProperty('Dentist_PersonId');
    });

    it('chair booking defaults ScheduleToType to CHAIR when not provided', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(makeResponse([]))
        .mockResolvedValueOnce(makeResponse({ id: 8888, Deleted: '' }));
      const client = new HttpClinicorpClient(config, fetchFn);

      await client.createAppointment({
        patient: { name: 'Ana', phone: '21999990000' },
        date: '2026-07-01T13:00:00.000Z',
        fromTime: '13:00',
        toTime: '14:00',
        dentistPersonId: 222,
        scheduleToId: 456,
        // scheduleToType omitted — should default to 'CHAIR'
      });

      const [, init] = fetchFn.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.ScheduleToType).toBe('CHAIR');
    });

    it('throws ExternalApiError on HTTP 400', async () => {
      // First call: lookup → not found; Second call: create → 400
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(makeResponse([]))
        .mockResolvedValueOnce(makeResponse({ error: 'invalid' }, 400))
        .mockResolvedValueOnce(makeResponse([]))
        .mockResolvedValueOnce(makeResponse({ error: 'invalid' }, 400));
      const client = new HttpClinicorpClient(config, fetchFn);

      await expect(
        client.createAppointment({
          patient: { name: 'Test', phone: '11999999999' },
          date: '2026-07-01T13:00:00.000Z',
          fromTime: '13:00',
          toTime: '14:00',
          dentistPersonId: 1,
        }),
      ).rejects.toBeInstanceOf(ExternalApiError);

      const err = await client
        .createAppointment({
          patient: { name: 'Test', phone: '11999999999' },
          date: '2026-07-01T13:00:00.000Z',
          fromTime: '13:00',
          toTime: '14:00',
          dentistPersonId: 1,
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(ExternalApiError);
      expect((err as ExternalApiError).status).toBe(400);
    });

    it('throws ExternalApiError 502 when response has no id (empty object)', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(makeResponse([]))
        .mockResolvedValueOnce(makeResponse({}));
      const client = new HttpClinicorpClient(config, fetchFn);

      const err = await client
        .createAppointment({
          patient: { name: 'Test', phone: '11999999999' },
          date: '2026-07-01T13:00:00.000Z',
          fromTime: '13:00',
          toTime: '14:00',
          dentistPersonId: 1,
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(ExternalApiError);
      expect((err as ExternalApiError).status).toBe(502);
    });

    it('throws ExternalApiError 502 when Deleted is X (cancelled/invalid)', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(makeResponse([]))
        .mockResolvedValueOnce(makeResponse({ id: 99, Deleted: 'X' }));
      const client = new HttpClinicorpClient(config, fetchFn);

      await expect(
        client.createAppointment({
          patient: { name: 'Test', phone: '11999999999' },
          date: '2026-07-01T13:00:00.000Z',
          fromTime: '13:00',
          toTime: '14:00',
          dentistPersonId: 1,
        }),
      ).rejects.toBeInstanceOf(ExternalApiError);
    });

    it('throws ExternalApiError 409 when PatientNameAlreadyExists', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(makeResponse([]))
        .mockResolvedValueOnce(makeResponse({ PatientNameAlreadyExists: true }));
      const client = new HttpClinicorpClient(config, fetchFn);

      const err = await client
        .createAppointment({
          patient: { name: 'Maria', phone: '11999999999' },
          date: '2026-07-01T13:00:00.000Z',
          fromTime: '13:00',
          toTime: '14:00',
          dentistPersonId: 1,
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(ExternalApiError);
      expect((err as ExternalApiError).status).toBe(409);
    });

    it('retries on 503 then succeeds (lookup + 503 + create success = 3 fetch calls)', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(makeResponse([]))                              // lookup miss
        .mockResolvedValueOnce(makeResponse({ error: 'unavailable' }, 503))  // create attempt 1 → 503
        .mockResolvedValueOnce(makeResponse({ id: 42, Deleted: '' }));        // create attempt 2 → success

      const client = new HttpClinicorpClient(config, fetchFn, {
        retries: 1,
        baseMs: 0,
        sleep: async () => {},
      });

      const result = await client.createAppointment({
        patient: { name: 'Test', phone: '11999999999' },
        date: '2026-07-01T13:00:00.000Z',
        fromTime: '13:00',
        toTime: '14:00',
        dentistPersonId: 1,
      });

      expect(result).toEqual({ appointmentId: '42', status: 'confirmed' });
      // 1 lookup + 2 create attempts (503 then success)
      expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    it('also accepts legacy array response shape defensively', async () => {
      // The API might theoretically return an array — be defensive
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(makeResponse([]))
        .mockResolvedValueOnce(makeResponse([{ id: 77, Deleted: '' }]));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.createAppointment({
        patient: { name: 'Test', phone: '11999999999' },
        date: '2026-07-01T13:00:00.000Z',
        fromTime: '13:00',
        toTime: '14:00',
        dentistPersonId: 1,
      });

      expect(result).toEqual({ appointmentId: '77', status: 'confirmed' });
    });

    it('auto-resolves existing patient by phone and sends Patient_PersonId', async () => {
      // First fetch: lookup by phone → found patient with id 555
      // Second fetch: create appointment → success
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(makeResponse([{ PatientId: 555, Name: 'Maria', Phone: '21999990000' }]))
        .mockResolvedValueOnce(makeResponse({ id: 999, Deleted: '' }));

      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.createAppointment({
        patient: { name: 'Maria', phone: '21999990000' },
        date: '2026-07-01T13:00:00.000Z',
        fromTime: '13:00',
        toTime: '14:00',
        dentistPersonId: 1,
        // no personId provided — should be auto-resolved
      });

      expect(result).toEqual({ appointmentId: '999', status: 'confirmed' });

      // Verify the create body includes the resolved Patient_PersonId
      const [, createInit] = fetchFn.mock.calls[1] as [string, RequestInit];
      const createBody = JSON.parse(createInit.body as string);
      expect(createBody.Patient_PersonId).toBe(555);
    });

    it('new patient (lookup returns []) proceeds by name without Patient_PersonId', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(makeResponse([]))
        .mockResolvedValueOnce(makeResponse({ id: 1000, Deleted: '' }));

      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.createAppointment({
        patient: { name: 'Novo Paciente', phone: '11988887777' },
        date: '2026-07-01T13:00:00.000Z',
        fromTime: '13:00',
        toTime: '14:00',
        dentistPersonId: 1,
      });

      expect(result).toEqual({ appointmentId: '1000', status: 'confirmed' });

      const [, createInit] = fetchFn.mock.calls[1] as [string, RequestInit];
      const createBody = JSON.parse(createInit.body as string);
      expect(createBody).not.toHaveProperty('Patient_PersonId');
    });

    it('skips lookup when personId is already provided in input', async () => {
      // Only ONE fetch call: the create (lookup is skipped)
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(makeResponse({ id: 2000, Deleted: '' }));

      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.createAppointment({
        patient: { name: 'Paciente Conhecido', phone: '11988887777', personId: 777 },
        date: '2026-07-01T13:00:00.000Z',
        fromTime: '13:00',
        toTime: '14:00',
        dentistPersonId: 1,
      });

      expect(result).toEqual({ appointmentId: '2000', status: 'confirmed' });
      // Only 1 call (no lookup)
      expect(fetchFn).toHaveBeenCalledTimes(1);

      const [, createInit] = fetchFn.mock.calls[0] as [string, RequestInit];
      const createBody = JSON.parse(createInit.body as string);
      expect(createBody.Patient_PersonId).toBe(777);
    });
  });

  describe('cancelAppointment', () => {
    it('sends POST with subscriber_id and appointment id, returns released: true', async () => {
      const fetchFn = vi.fn().mockResolvedValue(makeResponse({ ok: true }));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.cancelAppointment('987654321');

      expect(result).toEqual({ released: true });
      const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.clinicorp.com/rest/v1/appointment/cancel_appointment');
      const body = JSON.parse(init.body as string);
      expect(body.subscriber_id).toBe('sub123');
      expect(body.id).toBe('987654321');
    });
  });

  describe('listProfessionals', () => {
    it('parses professional list from API and derives unit from name', async () => {
      const rawProfessionals = [
        { id: 1, name: 'Dr. Silva - Recreio', cpf: '123.456.789-00' },
        { id: 2, name: 'Alinne - Lentes Ipanema', cpf: '987.654.321-00' },
      ];
      const fetchFn = vi.fn().mockResolvedValue(makeResponse(rawProfessionals));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.listProfessionals();

      expect(result).toEqual([
        { id: 1, name: 'Dr. Silva - Recreio', cpf: '123.456.789-00', unit: 'Recreio' },
        { id: 2, name: 'Alinne - Lentes Ipanema', cpf: '987.654.321-00', unit: 'Ipanema' },
      ]);
      const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/professional/list_all_professionals');
      expect(url).toContain('subscriber_id=sub123');
    });
  });

  describe('listBirthdays', () => {
    it('maps raw API fields to Birthday shape and includes subscriber_id in URL', async () => {
      const raw = [
        {
          PatientId: 6693556813430784,
          Name: 'EDNO DA SILVA',
          BirthDate: '1953-06-16T03:00:00.000Z',
          Age: 73,
          Email: 'edmo@gmail.com',
          MobilePhone: '(21) 99616-0653',
        },
      ];
      const fetchFn = vi.fn().mockResolvedValue(makeResponse(raw));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.listBirthdays();

      expect(result).toEqual([
        {
          patientId: 6693556813430784,
          name: 'EDNO DA SILVA',
          birthDate: '1953-06-16T03:00:00.000Z',
          age: 73,
          email: 'edmo@gmail.com',
          mobilePhone: '(21) 99616-0653',
        },
      ]);

      const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/patient/birthdays');
      expect(url).toContain('subscriber_id=sub123');
    });

    it('omits email and mobilePhone when absent/falsy', async () => {
      const raw = [
        {
          PatientId: 123,
          Name: 'SEM EMAIL',
          BirthDate: '2000-01-01T00:00:00.000Z',
          Age: 26,
        },
      ];
      const fetchFn = vi.fn().mockResolvedValue(makeResponse(raw));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.listBirthdays();

      expect(result[0]).not.toHaveProperty('email');
      expect(result[0]).not.toHaveProperty('mobilePhone');
    });
  });

  describe('listSpecialties', () => {
    it('maps raw API fields and converts Active: X to active: true', async () => {
      const raw = [
        {
          id: 5302587564752897,
          Description: 'Avaliação Implante',
          Type: 'EXPERTISE',
          Active: 'X',
          Language: 'pt-br',
        },
        {
          id: 111,
          Description: 'Inativa',
          Type: 'OTHER',
          Active: '',
          Language: 'pt-br',
        },
      ];
      const fetchFn = vi.fn().mockResolvedValue(makeResponse(raw));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.listSpecialties();

      expect(result).toEqual([
        { id: 5302587564752897, description: 'Avaliação Implante', type: 'EXPERTISE', active: true },
        { id: 111, description: 'Inativa', type: 'OTHER', active: false },
      ]);

      const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/procedures/list_specialties');
      expect(url).toContain('subscriber_id=sub123');
    });
  });

  describe('getAvailability', () => {
    // NOTE: getAvailability makes TWO fetch calls:
    //   1st: GET /appointment/get_avaliable_times_calendar (availability)
    //   2nd: GET /professional/list_all_professionals (professionals, for enrichment)
    // Tests use mockResolvedValueOnce twice so each call gets the correct response.

    it('calls correct URL with subscriber_id and date, maps raw API shape to AvailableSlot', async () => {
      const rawData = [
        { From: '11:00', To: '12:00', DayWeek: 4, BusinessId: 6247357829611520, ProfessionalId: 42 },
      ];
      // 1st call: availability; 2nd call: professionals (empty → no enrichment)
      const fetchFn = vi.fn()
        .mockResolvedValueOnce(makeResponse(rawData))
        .mockResolvedValueOnce(makeResponse([]));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.getAvailability({ date: '2026-07-01' });

      expect(result).toEqual([
        { from: '11:00', to: '12:00', dayWeek: 4, businessId: 6247357829611520, professionalId: 42 },
      ]);
      const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/appointment/get_avaliable_times_calendar');
      expect(url).toContain('subscriber_id=sub123');
      expect(url).toContain('date=2026-07-01');
    });

    it('maps single-digit hour from API (e.g. "8:00") without modification', async () => {
      const rawData = [
        { From: '8:00', To: '9:00', DayWeek: 1, BusinessId: 100, ProfessionalId: 7 },
      ];
      // 1st call: availability; 2nd call: professionals (empty)
      const fetchFn = vi.fn()
        .mockResolvedValueOnce(makeResponse(rawData))
        .mockResolvedValueOnce(makeResponse([]));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.getAvailability({ date: '2026-07-01' });

      expect(result[0].from).toBe('8:00');
      expect(result[0].to).toBe('9:00');
    });

    it('filters by professionalId client-side when provided', async () => {
      const rawData = [
        { From: '09:00', To: '10:00', DayWeek: 2, BusinessId: 100, ProfessionalId: 42 },
        { From: '10:00', To: '11:00', DayWeek: 2, BusinessId: 100, ProfessionalId: 99 },
        { From: '11:00', To: '12:00', DayWeek: 2, BusinessId: 100, ProfessionalId: 42 },
      ];
      // 1st call: availability; 2nd call: professionals (empty)
      const fetchFn = vi.fn()
        .mockResolvedValueOnce(makeResponse(rawData))
        .mockResolvedValueOnce(makeResponse([]));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.getAvailability({ date: '2026-07-01', professionalId: 42 });

      expect(result).toHaveLength(2);
      expect(result.every((s) => s.professionalId === 42)).toBe(true);
    });

    it('includes the access code under the configured param name when set', async () => {
      // 1st call: availability (empty); 2nd call: professionals (empty)
      const fetchFn = vi.fn()
        .mockResolvedValueOnce(makeResponse([]))
        .mockResolvedValueOnce(makeResponse([]));
      const client = new HttpClinicorpClient(
        { ...config, accessCode: 'ABC123', accessCodeParam: 'codigo' },
        fetchFn,
      );

      await client.getAvailability({ date: '2026-07-01' });

      const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('codigo=ABC123');
    });

    it('defaults the access code param name to code_link', async () => {
      // 1st call: availability (empty); 2nd call: professionals (empty)
      const fetchFn = vi.fn()
        .mockResolvedValueOnce(makeResponse([]))
        .mockResolvedValueOnce(makeResponse([]));
      const client = new HttpClinicorpClient({ ...config, accessCode: '60903' }, fetchFn);

      await client.getAvailability({ date: '2026-07-01' });

      const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('code_link=60903');
    });

    it('includes access code under code_link when accessCode is set without custom param', async () => {
      // 1st call: availability (empty); 2nd call: professionals (empty)
      const fetchFn = vi.fn()
        .mockResolvedValueOnce(makeResponse([]))
        .mockResolvedValueOnce(makeResponse([]));
      const client = new HttpClinicorpClient({ ...config, accessCode: '60903' }, fetchFn);

      await client.getAvailability({ date: '2026-07-01' });

      const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('code_link=60903');
      expect(url).not.toContain('access_code');
    });

    it('enriches slots with professionalName and unit from the professionals list', async () => {
      const availabilityRaw = [
        { From: '10:00', To: '11:00', DayWeek: 1, BusinessId: 1, ProfessionalId: 42 },
      ];
      const professionalsRaw = [
        { id: 42, name: 'Alinne - Lentes Ipanema', cpf: 'x' },
      ];
      // Call order: 1st availability, 2nd professionals
      const fetchFn = vi.fn()
        .mockResolvedValueOnce(makeResponse(availabilityRaw))
        .mockResolvedValueOnce(makeResponse(professionalsRaw));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.getAvailability({ date: '2026-07-01' });

      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe('Ipanema');
      expect(result[0].professionalName).toBe('Alinne - Lentes Ipanema');
      expect(result[0].professionalId).toBe(42);
    });

    it('leaves unit and professionalName undefined when professional not found in list', async () => {
      const availabilityRaw = [
        { From: '10:00', To: '11:00', DayWeek: 1, BusinessId: 1, ProfessionalId: 99 },
      ];
      // 1st call: availability; 2nd call: professionals (different id — no match)
      const fetchFn = vi.fn()
        .mockResolvedValueOnce(makeResponse(availabilityRaw))
        .mockResolvedValueOnce(makeResponse([{ id: 42, name: 'Outro Pro', cpf: 'y' }]));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.getAvailability({ date: '2026-07-01' });

      expect(result[0].unit).toBeUndefined();
      expect(result[0].professionalName).toBeUndefined();
    });
  });
});
