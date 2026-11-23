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
    expect(res.json()).toEqual({ status: 'simulado', appointmentId: 'agd-1', origem: 'corpo' });
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
      origem: 'corpo',
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
    expect(res.json()).toEqual({
      status: 'liberado',
      appointmentId: 'agd-7',
      origem: 'corpo',
      released: true,
    });
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

  // ── O corpo que o GHL manda de verdade ───────────────────────────────────────────────────────
  // A ação de webhook do workflow não interpola campo personalizado nos "Dados personalizados":
  // o chip aparece montado na tela e a chave não chega no corpo (execuções de 22 e 23/11). Daí a
  // rota procurar o id onde ele possa estar e, em último caso, buscar no contato.

  it('acha o id do agendamento aninhado em customData', async () => {
    const clinicorp = makeClinicorp();
    const app = buildServer({ reguas: { clinicorp, liberarHorarioAtivo: false } });

    const res = await app.inject({
      method: 'POST',
      url: '/reguas/liberar-horario',
      payload: { contact_id: 'ct-1', customData: { appointmentId: 'agd-9' } },
    });

    expect(res.json()).toEqual({ status: 'simulado', appointmentId: 'agd-9', origem: 'corpo' });
  });

  it('acha o id quando a chave vem com o nome do campo do GHL, não com o nosso', async () => {
    const clinicorp = makeClinicorp();
    const app = buildServer({ reguas: { clinicorp, liberarHorarioAtivo: false } });

    const res = await app.inject({
      method: 'POST',
      url: '/reguas/liberar-horario',
      payload: { contact_id: 'ct-1', rgua__agendamento: 'agd-11' },
    });

    expect(res.json()).toMatchObject({ appointmentId: 'agd-11', origem: 'corpo' });
  });

  it('ignora o appointmentId vazio do chip e usa o campo que vem nos dados padrão', async () => {
    // É o corpo exato da régua que está no ar: a ação ainda tem o par `appointmentId` montado com
    // o chip, que o GHL não resolve, e ao lado vêm os dados padrão com o campo do contato.
    const clinicorp = makeClinicorp();
    const buscarAgendamentoDoContato = vi.fn();
    const app = buildServer({
      reguas: { clinicorp, liberarHorarioAtivo: false, buscarAgendamentoDoContato },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/reguas/liberar-horario',
      payload: { appointmentId: '', contact_id: 'ct-1', rgua__agendamento: 'agd-padrao' },
    });

    expect(res.json()).toMatchObject({ appointmentId: 'agd-padrao', origem: 'corpo' });
    // Achou no corpo, então nem precisou da chamada extra ao GHL.
    expect(buscarAgendamentoDoContato).not.toHaveBeenCalled();
  });

  it('busca o agendamento no contato quando o corpo não traz a chave', async () => {
    const clinicorp = makeClinicorp();
    const buscarAgendamentoDoContato = vi.fn().mockResolvedValue('agd-do-contato');
    const app = buildServer({
      reguas: { clinicorp, liberarHorarioAtivo: false, buscarAgendamentoDoContato },
    });

    // Corpo sem nada de agendamento — o que o GHL manda hoje.
    const res = await app.inject({
      method: 'POST',
      url: '/reguas/liberar-horario',
      payload: { contact_id: 'ct-42', first_name: 'Enzo' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'simulado',
      appointmentId: 'agd-do-contato',
      origem: 'contato',
    });
    expect(buscarAgendamentoDoContato).toHaveBeenCalledWith('ct-42');
  });

  it('prefere o id do corpo e não vai buscar no contato de graça', async () => {
    const clinicorp = makeClinicorp();
    const buscarAgendamentoDoContato = vi.fn().mockResolvedValue('agd-do-contato');
    const app = buildServer({
      reguas: { clinicorp, liberarHorarioAtivo: false, buscarAgendamentoDoContato },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/reguas/liberar-horario',
      payload: { contact_id: 'ct-42', appointmentId: 'agd-do-corpo' },
    });

    expect(res.json()).toMatchObject({ appointmentId: 'agd-do-corpo', origem: 'corpo' });
    expect(buscarAgendamentoDoContato).not.toHaveBeenCalled();
  });

  it('a falha da busca no contato não derruba o processo, só recusa o pedido', async () => {
    const clinicorp = makeClinicorp();
    const buscarAgendamentoDoContato = vi.fn().mockRejectedValue(new Error('GHL fora do ar'));
    const app = buildServer({
      reguas: { clinicorp, liberarHorarioAtivo: true, buscarAgendamentoDoContato },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/reguas/liberar-horario',
      payload: { contact_id: 'ct-42' },
    });

    expect(res.statusCode).toBe(400);
    expect(clinicorp.cancelAppointment).not.toHaveBeenCalled();
  });

  it('a recusa diz quais chaves chegaram, para o registro de execução ser diagnosticável', async () => {
    const clinicorp = makeClinicorp();
    const app = buildServer({ reguas: { clinicorp, liberarHorarioAtivo: true } });

    const res = await app.inject({
      method: 'POST',
      url: '/reguas/liberar-horario',
      payload: { contact_id: 'ct-1', first_name: 'Enzo' },
    });

    expect(res.statusCode).toBe(400);
    // Nome de chave e nada de valor: esta resposta aparece no painel e o corpo carrega dado de
    // paciente.
    expect(res.json().chavesRecebidas).toEqual(['contact_id', 'first_name']);
    expect(JSON.stringify(res.json())).not.toContain('Enzo');
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
