import { describe, it, expect, vi } from 'vitest';
import { buildGhlBody, createGhlDispatcher } from '../../../src/scheduling/reguas/ghlDispatcher';
import type { ReguaPayload } from '../../../src/scheduling/reguas/dispatcher';

const URL_HOOK = 'https://services.leadconnectorhq.com/hooks/abc/webhook-trigger/xyz';

describe('buildGhlBody', () => {
  it('normaliza telefone e separa o primeiro nome (que é o usado nos textos)', () => {
    const body = buildGhlBody({ type: 'aniversario', phone: '+55 (21) 99999-8888', name: 'Ana Maria Souza' });
    expect(body.phone).toBe('5521999998888');
    expect(body.name).toBe('Ana Maria Souza');
    expect(body.first_name).toBe('Ana');
    expect(body.track).toBe('adulto');
  });

  it('trilha infantil carrega o nome da criança', () => {
    const body = buildGhlBody({
      type: 'aniversario', phone: '5521999', name: 'Pedrinho', track: 'infantil', childName: 'Pedrinho',
    });
    expect(body.track).toBe('infantil');
    expect(body.nome_crianca).toBe('Pedrinho');
  });

  it('no-show leva data, hora, profissional e unidade para o texto do lembrete', () => {
    const body = buildGhlBody({
      type: 'no_show', phone: '5521999', name: 'Bruno', appointmentId: '10',
      date: '2026-08-21', fromTime: '09:00', professionalName: 'Dra. Adriana', unit: 'Recreio',
    });
    expect(body).toMatchObject({
      tipo: 'no_show', appointment_id: '10', data: '2026-08-21',
      hora: '09:00', profissional: 'Dra. Adriana', unidade: 'Recreio',
    });
    expect(body.observacoes).toContain('Lembrete de consulta');
  });

  it('pós-procedimento leva o procedimento; inatividade leva os meses', () => {
    expect(buildGhlBody({ type: 'pos_procedimento', phone: '1', procedure: 'Limpeza' })).toMatchObject({
      procedimento: 'Limpeza',
      observacoes: 'Retorno recomendado (Limpeza)',
    });
    expect(buildGhlBody({ type: 'inatividade', phone: '1', months: 12 })).toMatchObject({
      meses: 12,
      observacoes: 'Reengajamento: sem consulta há 12 meses',
    });
  });

  it('não inclui chaves vazias', () => {
    const body = buildGhlBody({ type: 'nps', phone: '5521999', name: 'Ana' });
    expect(body).not.toHaveProperty('nome_crianca');
    expect(body).not.toHaveProperty('observacoes');
    expect(body).not.toHaveProperty('meses');
  });
});

describe('createGhlDispatcher', () => {
  const payload: ReguaPayload = { type: 'aniversario', phone: '5521999998888', name: 'Ana' };

  it('faz POST JSON na URL do inbound webhook', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    await createGhlDispatcher({ url: URL_HOOK }, fetchFn as unknown as typeof fetch)(payload);

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(URL_HOOK);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toMatchObject({ phone: '5521999998888', first_name: 'Ana' });
  });

  it('erro HTTP propaga (a trava de dedupe libera a reserva para retentar)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('erro', { status: 500 }));
    const dispatch = createGhlDispatcher({ url: URL_HOOK }, fetchFn as unknown as typeof fetch);

    await expect(dispatch(payload)).rejects.toThrow(/500/);
  });
});
