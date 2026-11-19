import { describe, it, expect, vi } from 'vitest';
import { buildServer } from '../../src/http/server';

function makeClinicorp(agendaDepois: Array<{ id: string }> = []): {
  cancelAppointment: ReturnType<typeof vi.fn>;
  listAppointmentsByDate: ReturnType<typeof vi.fn>;
} {
  return {
    cancelAppointment: vi.fn().mockResolvedValue({ released: true, resposta: { ok: true } }),
    listAppointmentsByDate: vi.fn().mockResolvedValue(agendaDepois),
  };
}

describe('POST /reguas/liberar-horario', () => {
  it('não toca na agenda enquanto a liberação está desligada', async () => {
    const clinicorp = makeClinicorp();
    const app = buildServer({ reguas: { clinicorp, liberarHorarioAtivo: false } });

    const res = await app.inject({
      method: 'POST',
      url: '/reguas/liberar-horario',
      payload: { appointmentId: 'agd-1' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'simulado', appointmentId: 'agd-1' });
    // O ponto do interruptor: responder OK para o workflow sem cancelar nada de verdade.
    expect(clinicorp.cancelAppointment).not.toHaveBeenCalled();
  });

  it('cancela na Clinicorp quando a liberação está ligada', async () => {
    const clinicorp = makeClinicorp();
    const app = buildServer({ reguas: { clinicorp, liberarHorarioAtivo: true } });

    const res = await app.inject({
      method: 'POST',
      url: '/reguas/liberar-horario',
      payload: { appointmentId: 'agd-7' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'liberado',
      appointmentId: 'agd-7',
      released: true,
      aindaNaAgenda: false,
    });
    expect(clinicorp.cancelAppointment).toHaveBeenCalledWith('agd-7');
  });

  it('avisa quando o agendamento continua na agenda depois do cancelamento', async () => {
    // O caso que a clínica precisa descobrir sem cancelar a consulta de ninguém para testar.
    const clinicorp = makeClinicorp([{ id: 'agd-7' }]);
    const app = buildServer({ reguas: { clinicorp, liberarHorarioAtivo: true } });

    const res = await app.inject({
      method: 'POST',
      url: '/reguas/liberar-horario',
      payload: { appointmentId: 'agd-7' },
    });

    expect(res.json()).toMatchObject({ status: 'liberado', aindaNaAgenda: true });
  });

  it('a falha da conferência não derruba a liberação, que já aconteceu', async () => {
    const clinicorp = makeClinicorp();
    clinicorp.listAppointmentsByDate.mockRejectedValue(new Error('Clinicorp fora do ar'));
    const app = buildServer({ reguas: { clinicorp, liberarHorarioAtivo: true } });

    const res = await app.inject({
      method: 'POST',
      url: '/reguas/liberar-horario',
      payload: { appointmentId: 'agd-7' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'liberado', appointmentId: 'agd-7', released: true });
  });

  it('recusa o pedido sem id de agendamento', async () => {
    const clinicorp = makeClinicorp();
    const app = buildServer({ reguas: { clinicorp, liberarHorarioAtivo: true } });

    const res = await app.inject({
      method: 'POST',
      url: '/reguas/liberar-horario',
      payload: { appointmentId: '' },
    });

    expect(res.statusCode).toBe(400);
    expect(clinicorp.cancelAppointment).not.toHaveBeenCalled();
  });

  it('não existe quando a dependência não é passada', async () => {
    const app = buildServer({});

    const res = await app.inject({
      method: 'POST',
      url: '/reguas/liberar-horario',
      payload: { appointmentId: 'agd-1' },
    });

    expect(res.statusCode).toBe(404);
  });
});
