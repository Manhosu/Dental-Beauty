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
  describe('createAppointment', () => {
    it('sends Basic auth header and maps CREATED response', async () => {
      const fetchFn = vi.fn().mockResolvedValue(makeResponse([{ Status: 'CREATED', id: 987654321 }]));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.createAppointment({
        patient: { name: 'João da Silva', phone: '(11) 91234-5678', email: 'email@dominio.com' },
        date: '2025-04-12T03:00:00.000Z',
        fromTime: '10:00',
        toTime: '11:00',
        dentistPersonId: 222222222222,
        scheduleToId: 1234567890124,
        scheduleToType: 'CHAIR',
        procedures: 'Limpeza, Obturação',
      });

      expect(result).toEqual({ appointmentId: '987654321', status: 'confirmed' });

      expect(fetchFn).toHaveBeenCalledOnce();
      const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];

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
    });

    it('throws ExternalApiError on HTTP 400', async () => {
      const fetchFn = vi.fn().mockResolvedValue(makeResponse({ error: 'invalid' }, 400));
      const client = new HttpClinicorpClient(config, fetchFn);

      await expect(
        client.createAppointment({
          patient: { name: 'Test', phone: '11999999999' },
          date: '2026-07-01T13:00:00.000Z',
          fromTime: '13:00',
          toTime: '14:00',
          dentistPersonId: 1,
          scheduleToId: 2,
        }),
      ).rejects.toBeInstanceOf(ExternalApiError);

      const err = await client
        .createAppointment({
          patient: { name: 'Test', phone: '11999999999' },
          date: '2026-07-01T13:00:00.000Z',
          fromTime: '13:00',
          toTime: '14:00',
          dentistPersonId: 1,
          scheduleToId: 2,
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(ExternalApiError);
      expect((err as ExternalApiError).status).toBe(400);
    });

    it('throws ExternalApiError when response array is empty', async () => {
      const fetchFn = vi.fn().mockResolvedValue(makeResponse([]));
      const client = new HttpClinicorpClient(config, fetchFn);

      await expect(
        client.createAppointment({
          patient: { name: 'Test', phone: '11999999999' },
          date: '2026-07-01T13:00:00.000Z',
          fromTime: '13:00',
          toTime: '14:00',
          dentistPersonId: 1,
          scheduleToId: 2,
        }),
      ).rejects.toBeInstanceOf(ExternalApiError);
    });

    it('throws ExternalApiError when status is not CREATED', async () => {
      const fetchFn = vi.fn().mockResolvedValue(makeResponse([{ Status: 'FAILED', id: 0 }]));
      const client = new HttpClinicorpClient(config, fetchFn);

      await expect(
        client.createAppointment({
          patient: { name: 'Test', phone: '11999999999' },
          date: '2026-07-01T13:00:00.000Z',
          fromTime: '13:00',
          toTime: '14:00',
          dentistPersonId: 1,
          scheduleToId: 2,
        }),
      ).rejects.toBeInstanceOf(ExternalApiError);
    });

    it('retries on 503 then succeeds (fetch called twice)', async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(makeResponse({ error: 'unavailable' }, 503))
        .mockResolvedValueOnce(makeResponse([{ Status: 'CREATED', id: 42 }]));

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
        scheduleToId: 2,
      });

      expect(result).toEqual({ appointmentId: '42', status: 'confirmed' });
      expect(fetchFn).toHaveBeenCalledTimes(2);
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
    it('parses professional list from API', async () => {
      const professionals = [
        { id: 1, name: 'Dr. Silva', cpf: '123.456.789-00' },
        { id: 2, name: 'Dr. Santos', cpf: '987.654.321-00' },
      ];
      const fetchFn = vi.fn().mockResolvedValue(makeResponse(professionals));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.listProfessionals();

      expect(result).toEqual(professionals);
      const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/professional/list_all_professionals');
      expect(url).toContain('subscriber_id=sub123');
    });
  });

  describe('getAvailability', () => {
    it('calls correct URL with subscriber_id and date, returns raw array', async () => {
      const rawData = [{ time: '10:00', available: true }, { time: '11:00', available: false }];
      const fetchFn = vi.fn().mockResolvedValue(makeResponse(rawData));
      const client = new HttpClinicorpClient(config, fetchFn);

      const result = await client.getAvailability({ date: '2026-07-01' });

      expect(result).toEqual(rawData);
      const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/appointment/get_avaliable_times_calendar');
      expect(url).toContain('subscriber_id=sub123');
      expect(url).toContain('date=2026-07-01');
    });

    it('includes professionalId in query when provided', async () => {
      const fetchFn = vi.fn().mockResolvedValue(makeResponse([]));
      const client = new HttpClinicorpClient(config, fetchFn);

      await client.getAvailability({ date: '2026-07-01', professionalId: 42 });

      const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('professionalId=42');
    });

    it('includes the access code under the configured param name when set', async () => {
      const fetchFn = vi.fn().mockResolvedValue(makeResponse([]));
      const client = new HttpClinicorpClient(
        { ...config, accessCode: 'ABC123', accessCodeParam: 'codigo' },
        fetchFn,
      );

      await client.getAvailability({ date: '2026-07-01' });

      const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('codigo=ABC123');
    });

    it('defaults the access code param name to access_code', async () => {
      const fetchFn = vi.fn().mockResolvedValue(makeResponse([]));
      const client = new HttpClinicorpClient({ ...config, accessCode: 'XYZ' }, fetchFn);

      await client.getAvailability({ date: '2026-07-01' });

      const [url] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('access_code=XYZ');
    });
  });
});
