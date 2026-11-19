import { describe, it, expect, vi } from 'vitest';
import {
  runAnamneseD2,
  runAnamneseD1,
  ehPrimeiraAvaliacao,
} from '../../../src/scheduling/reguas/anamneseJobs';
import { createMemoryAnamneseStore } from '../../../src/scheduling/reguas/anamneseStore';
import type { ClinicorpClient } from '../../../src/integrations/clinicorp/types';
import type { AnamneseClient, AnamneseLink } from '../../../src/integrations/anamnese/client';

function fakeClinicorp(appointments: unknown[]): ClinicorpClient {
  return {
    listAppointmentsByDate: vi.fn().mockResolvedValue(appointments),
  } as unknown as ClinicorpClient;
}

function link(over: Partial<AnamneseLink> = {}): AnamneseLink {
  return {
    id: 'link-1',
    link: 'https://odontobi.pages.dev/anamnese?t=abc',
    especialidade: 'clinico_geral',
    expiraEm: '2026-12-17T00:00:00Z',
    reaproveitado: false,
    respondido: false,
    respondidoEm: null,
    noClinicorp: true,
    ...over,
  };
}

function fakeAnamnese(over: Partial<AnamneseClient> = {}): AnamneseClient {
  return {
    criarLink: vi.fn().mockResolvedValue(link()),
    consultarLink: vi.fn().mockResolvedValue(link()),
    ...over,
  } as AnamneseClient;
}

describe('ehPrimeiraAvaliacao', () => {
  // Categorias reais da agenda (medidas em 13/11/2026).
  it('pega as avaliações e deixa de fora retorno, revisão e consulta', () => {
    expect(ehPrimeiraAvaliacao('Avaliação Recreio')).toBe(true);
    expect(ehPrimeiraAvaliacao('Avaliação Ipanema')).toBe(true);
    expect(ehPrimeiraAvaliacao('85 - Odontopediatria - Consulta de Avaliação Infantil')).toBe(true);

    expect(ehPrimeiraAvaliacao('Avaliação para paciente - retorno(COBRADA)')).toBe(false);
    expect(ehPrimeiraAvaliacao('Retorno Manutenção odontopediatria(COBRADA)')).toBe(false);
    expect(ehPrimeiraAvaliacao('Consulta')).toBe(false);
    expect(ehPrimeiraAvaliacao('Revisão')).toBe(false);
    expect(ehPrimeiraAvaliacao('Limpeza')).toBe(false);
    expect(ehPrimeiraAvaliacao(undefined)).toBe(false);
  });
});

describe('runAnamneseD2', () => {
  it('cria o link só para a primeira avaliação e manda com o PatientId', async () => {
    const clinicorp = fakeClinicorp([
      { id: 'a1', patientName: 'Maria', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', categoryDescription: 'Avaliação Recreio', patientId: 5192245887762432 },
      { id: 'a2', patientName: 'Joao', mobilePhone: '5522', date: 'x', fromTime: '9', toTime: '10', categoryDescription: 'Consulta' },
      { id: 'a3', patientName: 'SemFone', date: 'x', fromTime: '9', toTime: '10', categoryDescription: 'Avaliação Recreio' },
    ]);
    const anamnese = fakeAnamnese();
    const store = createMemoryAnamneseStore();
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runAnamneseD2(clinicorp, anamnese, store, dispatch, '2026-11-19');

    expect(sent).toBe(1);
    expect(anamnese.criarLink).toHaveBeenCalledWith({
      especialidade: 'clinico_geral',
      clinicorpPatientId: '5192245887762432',
      nome: 'Maria',
    });
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
      type: 'anamnese',
      phone: '5511',
      anamneseLink: 'https://odontobi.pages.dev/anamnese?t=abc',
    });
    // O id ficou guardado para o D-1 poder perguntar se respondeu.
    expect(await store.recuperar('a1')).toBe('link-1');
  });

  it('manda a criança para o formulário de odontopediatria, na trilha infantil', async () => {
    const clinicorp = fakeClinicorp([
      { id: 'a1', patientName: 'Pedro', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', procedures: '85 - Odontopediatria - Consulta de Avaliação Infantil' },
    ]);
    const anamnese = fakeAnamnese();
    const dispatch = vi.fn().mockResolvedValue(undefined);

    await runAnamneseD2(clinicorp, anamnese, createMemoryAnamneseStore(), dispatch, '2026-11-19');

    expect(anamnese.criarLink).toHaveBeenCalledWith(
      expect.objectContaining({ especialidade: 'odontopediatria' }),
    );
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({ track: 'infantil' });
  });

  it('não manda o link duas vezes para o mesmo agendamento', async () => {
    const appointments = [
      { id: 'a1', patientName: 'Maria', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', categoryDescription: 'Avaliação Recreio' },
    ];
    const anamnese = fakeAnamnese();
    const store = createMemoryAnamneseStore();
    const dispatch = vi.fn().mockResolvedValue(undefined);

    await runAnamneseD2(fakeClinicorp(appointments), anamnese, store, dispatch, '2026-11-19');
    await runAnamneseD2(fakeClinicorp(appointments), anamnese, store, dispatch, '2026-11-19');

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('um paciente que falha não derruba os outros da rodada', async () => {
    const clinicorp = fakeClinicorp([
      { id: 'a1', patientName: 'Quebra', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', categoryDescription: 'Avaliação Recreio' },
      { id: 'a2', patientName: 'Passa', mobilePhone: '5522', date: 'x', fromTime: '9', toTime: '10', categoryDescription: 'Avaliação Recreio' },
    ]);
    const anamnese = fakeAnamnese({
      criarLink: vi
        .fn()
        .mockRejectedValueOnce(new Error('502'))
        .mockResolvedValue(link({ id: 'link-2' })),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const store = createMemoryAnamneseStore();

    const sent = await runAnamneseD2(clinicorp, anamnese, store, dispatch, '2026-11-19');

    expect(sent).toBe(1);
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({ phone: '5522' });
    // O que falhou não ficou guardado, então a próxima execução tenta de novo.
    expect(await store.recuperar('a1')).toBeUndefined();
  });
});

describe('runAnamneseD1', () => {
  it('lembra só quem ainda não respondeu', async () => {
    const clinicorp = fakeClinicorp([
      { id: 'a1', patientName: 'Respondeu', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10' },
      { id: 'a2', patientName: 'Nao respondeu', mobilePhone: '5522', date: 'x', fromTime: '9', toTime: '10' },
      { id: 'a3', patientName: 'Sem ficha', mobilePhone: '5533', date: 'x', fromTime: '9', toTime: '10' },
    ]);
    const store = createMemoryAnamneseStore();
    await store.lembrar('a1', 'link-respondido');
    await store.lembrar('a2', 'link-pendente');

    const anamnese = fakeAnamnese({
      consultarLink: vi.fn().mockImplementation(async (id: string) =>
        link({ id, respondido: id === 'link-respondido' }),
      ),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runAnamneseD1(clinicorp, anamnese, store, dispatch, '2026-11-20');

    expect(sent).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
      type: 'anamnese_lembrete',
      phone: '5522',
    });
    // Quem nunca recebeu ficha não entra na consulta à API.
    expect(anamnese.consultarLink).toHaveBeenCalledTimes(2);
  });

  it('não manda nada quando ninguém tem ficha pendente', async () => {
    const clinicorp = fakeClinicorp([
      { id: 'a1', patientName: 'X', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10' },
    ]);
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runAnamneseD1(
      clinicorp,
      fakeAnamnese(),
      createMemoryAnamneseStore(),
      dispatch,
      '2026-11-20',
    );

    expect(sent).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
