import { describe, it, expect, vi } from 'vitest';
import { buildServer } from '../../src/http/server';

function makeClinicorp(released = true): { cancelAppointment: ReturnType<typeof vi.fn> } {
  return { cancelAppointment: vi.fn().mockResolvedValue({ released }) };
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
    expect(res.json()).toEqual({ status: 'liberado', appointmentId: 'agd-7', released: true });
    expect(clinicorp.cancelAppointment).toHaveBeenCalledWith('agd-7');
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
