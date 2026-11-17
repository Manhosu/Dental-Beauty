import { describe, it, expect, vi } from 'vitest';
import {
  runAniversariantes,
  runNoShow,
  runLembreteHoje,
  runPostProcedure,
  runNps,
  runInactivity,
  runPosCirurgia,
  intervalMonthsForCategory,
  isProcedimentoCirurgico,
  temTextoDeRetorno,
  procedimentoDoAtendimento,
  runConfirmacao,
  antecedenciaEmDias,
  diasAntesDaConfirmacao,
} from '../../../src/scheduling/reguas/jobs';
import {
  CONFIRMACAO_DIAS_ANTES,
  isoDate,
  monthsAgoIso,
  runDailyReguas,
} from '../../../src/scheduling/reguas/cronEngine';
import {
  createMemoryVisitCounter,
  visitaPedePesquisa,
} from '../../../src/scheduling/reguas/visitCounter';
import { createHttpDispatcher } from '../../../src/scheduling/reguas/dispatcher';
import type { ClinicorpClient } from '../../../src/integrations/clinicorp/types';

const CHECKOUT_ID = 999;

function fakeClinicorp(over: Partial<ClinicorpClient> = {}): ClinicorpClient {
  return {
    getAvailability: vi.fn(),
    createAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
    listProfessionals: vi.fn(),
    listAppointmentsByDate: vi.fn().mockResolvedValue([]),
    listAppointmentStatuses: vi
      .fn()
      .mockResolvedValue([{ id: CHECKOUT_ID, type: 'CHECKOUT', description: '4-Atendido', active: true }]),
    listBirthdays: vi.fn().mockResolvedValue([]),
    listSpecialties: vi.fn(),
    findPatientByPhone: vi.fn(),
    ...over,
  } as unknown as ClinicorpClient;
}

describe('réguas — jobs', () => {
  it('aniversariantes: 1 disparo por paciente com telefone, pula quem não tem', async () => {
    const clinicorp = fakeClinicorp({
      listBirthdays: vi.fn().mockResolvedValue([
        { patientId: 1, name: 'Ana', birthDate: '1996-06-26', age: 30, mobilePhone: '5521999' },
        { patientId: 2, name: 'Sem Fone', birthDate: '1986-06-26', age: 40 },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runAniversariantes(clinicorp, dispatch, new Date('2026-06-26T12:00:00.000Z'));

    expect(sent).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'aniversario', phone: '5521999', name: 'Ana' });
  });

  it('no-show: confirma cada agendamento com telefone na data informada', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '10', patientName: 'Bruno', mobilePhone: '5521888', date: '2026-06-27T03:00:00.000Z', fromTime: '9:00', toTime: '9:30', professionalName: 'Adriana - Recreio', unit: 'Recreio' },
        { id: '11', patientName: 'NoFone', date: 'x', fromTime: '10:00', toTime: '10:30' },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runNoShow(clinicorp, dispatch, '2026-06-27');

    expect(sent).toBe(1);
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('2026-06-27');
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'no_show', phone: '5521888', appointmentId: '10', professionalName: 'Adriana - Recreio', unit: 'Recreio' }),
    );
  });

  it('pós-procedimento: só dispara ATENDIDO (CHECKOUT) no bucket de meses certo, pula faltou/sem fone', async () => {
    const appts = [
      { id: '1', patientName: 'Atend6m', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Limpeza' },
      { id: '2', patientName: 'Faltou', mobilePhone: '5522', date: 'x', fromTime: '9', toTime: '10', statusId: 111, categoryDescription: 'Limpeza' },
      { id: '3', patientName: 'Protese12m', mobilePhone: '5533', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Prótese retorno laboratório' },
      { id: '4', patientName: 'SemFone', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Limpeza' },
    ];
    const clinicorp = fakeClinicorp({ listAppointmentsByDate: vi.fn().mockResolvedValue(appts) });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runPostProcedure(clinicorp, dispatch, (m) => `d-${m}`);

    expect(sent).toBe(2); // Limpeza no bucket 6m + Prótese no bucket 12m
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('d-3');
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('d-6');
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('d-12');
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pos_procedimento', phone: '5511', procedure: 'Limpeza' }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pos_procedimento', phone: '5533' }),
    );
  });

  it('pós-procedimento: não dispara se o status CHECKOUT não existir (evita falso-positivo)', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentStatuses: vi.fn().mockResolvedValue([]),
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'X', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Limpeza' },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runPostProcedure(clinicorp, dispatch, (m) => `d-${m}`);

    expect(sent).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('NPS: dispara só para ATENDIDOS (CHECKOUT) com telefone na data', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Ana', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID },
        { id: '2', patientName: 'Faltou', mobilePhone: '5522', date: 'x', fromTime: '9', toTime: '10', statusId: 111 },
        { id: '3', patientName: 'SemFone', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runNps(clinicorp, dispatch, '2026-06-28');

    expect(sent).toBe(1);
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('2026-06-28');
    expect(dispatch).toHaveBeenCalledWith({ type: 'nps', phone: '5511', name: 'Ana' });
  });

  it('lembrete da manhã: avisa todo mundo da agenda de hoje, com tipo próprio', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Ana', mobilePhone: '5511', date: '2026-06-29', fromTime: '9:00', toTime: '10' },
        { id: '2', patientName: 'SemFone', date: '2026-06-29', fromTime: '14:00', toTime: '15' },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runLembreteHoje(clinicorp, dispatch, '2026-06-29');

    expect(sent).toBe(1);
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('2026-06-29');
    // Tipo próprio: é o que separa o texto "sua consulta é hoje" do texto de 96h antes.
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'lembrete_hoje', phone: '5511', fromTime: '9:00' }),
    );
  });

  it('lembrete da manhã: não filtra por status — quem ainda não veio não tem CHECKOUT', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Ana', mobilePhone: '5511', date: 'x', fromTime: '9:00', toTime: '10', statusId: 111 },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    expect(await runLembreteHoje(clinicorp, dispatch, '2026-06-29')).toBe(1);
  });

  it('pesquisa de satisfação: sai na 1ª vinda e só volta na 4ª', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Ana', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const counter = createMemoryVisitCounter();

    const enviados: number[] = [];
    for (let vinda = 1; vinda <= 5; vinda++) {
      enviados.push(await runNps(clinicorp, dispatch, '2026-06-28', counter));
    }

    expect(enviados).toEqual([1, 0, 0, 1, 0]);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('pesquisa de satisfação: sem contador, mantém o envio a cada consulta (caminho legado)', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Ana', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    expect(await runNps(clinicorp, dispatch, '2026-06-28')).toBe(1);
    expect(await runNps(clinicorp, dispatch, '2026-06-28')).toBe(1);
  });

  it('pesquisa de satisfação: a contagem é por paciente, não global', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Ana', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID },
        { id: '2', patientName: 'Bia', mobilePhone: '5522', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID },
        { id: '3', patientName: 'Caio', mobilePhone: '5533', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    // Todo mundo na 1ª vinda: os três recebem.
    expect(await runNps(clinicorp, dispatch, '2026-06-28', createMemoryVisitCounter())).toBe(3);
  });

  it('visitaPedePesquisa: 1ª, 4ª, 7ª — e nunca com total zerado', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => visitaPedePesquisa(n))).toEqual([
      true, false, false, true, false, false, true,
    ]);
    expect(visitaPedePesquisa(0)).toBe(false);
  });

  it('inatividade: dispara para ATENDIDO há 6/12m que NÃO voltou; exclui quem retornou', async () => {
    const naDataAlvo = [
      { id: '1', patientName: 'Sumiu', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID },
      { id: '2', patientName: 'Voltou', mobilePhone: '5522', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID },
      { id: '3', patientName: 'Faltou', mobilePhone: '5533', date: 'x', fromTime: '9', toTime: '10', statusId: 111 },
    ];
    const desdeEntao = [
      { id: '9', patientName: 'Voltou', mobilePhone: '5522', date: 'y', fromTime: '9', toTime: '10' },
    ];
    const listAppointmentsByDate = vi.fn().mockImplementation((_from: string, to?: string) =>
      Promise.resolve(to ? desdeEntao : naDataAlvo),
    );
    const clinicorp = fakeClinicorp({ listAppointmentsByDate });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runInactivity(clinicorp, dispatch, (m) => `2026-01-0${m === 6 ? 1 : 2}`, '2026-07-19');

    // 'Sumiu' em cada bucket (6m e 12m); 'Voltou' excluído; 'Faltou' não é CHECKOUT.
    expect(sent).toBe(2);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'inatividade', phone: '5511', name: 'Sumiu', months: 6 }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'inatividade', phone: '5511', months: 12 }),
    );
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ phone: '5522' }));
  });

  it('inatividade: não dispara se o status CHECKOUT não existir', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentStatuses: vi.fn().mockResolvedValue([]),
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'X', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    expect(await runInactivity(clinicorp, dispatch, (m) => `d-${m}`, '2026-07-19')).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('intervalMonthsForCategory: Periodontia 3m, Prótese/Coroa/Implante 12m, demais 6m', () => {
    expect(intervalMonthsForCategory('Tratamento Periodontal')).toBe(3);
    expect(intervalMonthsForCategory('Prótese retorno laboratório')).toBe(12);
    expect(intervalMonthsForCategory('Coroa')).toBe(12);
    expect(intervalMonthsForCategory('Implante unitário')).toBe(12);
    expect(intervalMonthsForCategory('Limpeza')).toBe(6);
    expect(intervalMonthsForCategory(undefined)).toBe(6);
  });

  // As categorias abaixo saíram da agenda real (13/10–13/11/2026, 309 agendamentos). Metade do
  // movimento é "Consulta", que não diz o que foi feito e por isso não pode virar convite de
  // retorno. Sem o filtro, o default de 6 meses mandava todos eles para o GHL descartar.
  it('temTextoDeRetorno: só as categorias que têm ramo no workflow', () => {
    expect(temTextoDeRetorno('Limpeza')).toBe(true);
    expect(temTextoDeRetorno('Clareamento')).toBe(true);
    expect(temTextoDeRetorno('Prótese retorno laboratório')).toBe(true);
    expect(temTextoDeRetorno('Instalação de aparelho(ortodontia)')).toBe(true);
    expect(temTextoDeRetorno('PROTESE')).toBe(true); // sem acento e em caixa alta

    expect(temTextoDeRetorno('Consulta')).toBe(false);
    expect(temTextoDeRetorno('Avaliação Recreio')).toBe(false);
    expect(temTextoDeRetorno('Escaneamento')).toBe(false);
    expect(temTextoDeRetorno('Revisão')).toBe(false);
    expect(temTextoDeRetorno('Emergência')).toBe(false);
    expect(temTextoDeRetorno('Planejamento inicial')).toBe(false);
    expect(temTextoDeRetorno('AGENDAMENTO  PENDENTE DE CONFIRMAÇÃO')).toBe(false);
    expect(temTextoDeRetorno(undefined)).toBe(false);
    expect(temTextoDeRetorno('')).toBe(false);
  });

  // Regra da cliente em 17/11/2026: confirmar cedo existe para liberar a vaga a tempo de chamar
  // outro paciente. Quem marcou em cima da hora já foi confirmado pelo próprio agendamento.
  it('antecedenciaEmDias: conta dias de calendário, ignorando a hora da marcação', () => {
    expect(antecedenciaEmDias('2026-11-10T23:50:00Z', '2026-11-17T09:00:00Z')).toBe(7);
    expect(antecedenciaEmDias('2026-11-15T00:10:00Z', '2026-11-17T09:00:00Z')).toBe(2);
    expect(antecedenciaEmDias('2026-11-17T08:00:00Z', '2026-11-17T09:00:00Z')).toBe(0);
    expect(antecedenciaEmDias(undefined, '2026-11-17')).toBeUndefined();
    expect(antecedenciaEmDias('nao-e-data', '2026-11-17')).toBeUndefined();
  });

  it('diasAntesDaConfirmacao: D-4 para quem marcou cedo, D-2 no meio, nada em cima da hora', () => {
    expect(diasAntesDaConfirmacao(30)).toBe(4);
    expect(diasAntesDaConfirmacao(6)).toBe(4);
    expect(diasAntesDaConfirmacao(5)).toBe(2);
    expect(diasAntesDaConfirmacao(3)).toBe(2);
    expect(diasAntesDaConfirmacao(2)).toBeNull();
    expect(diasAntesDaConfirmacao(0)).toBeNull();
    // Sem CreateDate na agenda, mantém o comportamento anterior à regra.
    expect(diasAntesDaConfirmacao(undefined)).toBe(4);
  });

  it('runConfirmacao: cada paciente recebe o SIM na janela certa, e só uma vez', async () => {
    const porData: Record<string, unknown[]> = {
      // Janela D-4: só quem marcou com 6+ dias de antecedência confirma aqui.
      'd-4': [
        { id: '1', patientName: 'Marcou com um mes', mobilePhone: '5511', date: '2026-11-21T09:00:00Z', fromTime: '9', toTime: '10', createdAt: '2026-10-21T09:00:00Z' },
        { id: '2', patientName: 'Marcou 5 dias antes', mobilePhone: '5522', date: '2026-11-21T09:00:00Z', fromTime: '9', toTime: '10', createdAt: '2026-11-16T09:00:00Z' },
      ],
      // Janela D-2: a vez de quem marcou de 5 a 3 dias antes.
      'd-2': [
        { id: '2', patientName: 'Marcou 5 dias antes', mobilePhone: '5522', date: '2026-11-19T09:00:00Z', fromTime: '9', toTime: '10', createdAt: '2026-11-14T09:00:00Z' },
        { id: '3', patientName: 'Marcou ontem', mobilePhone: '5533', date: '2026-11-19T09:00:00Z', fromTime: '9', toTime: '10', createdAt: '2026-11-18T09:00:00Z' },
      ],
    };
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockImplementation(async (d: string) => porData[d] ?? []),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runConfirmacao(clinicorp, dispatch, (dias) => `d-${dias}`);

    expect(sent).toBe(2);
    const nomes = dispatch.mock.calls.map((c) => (c[0] as { name: string }).name);
    expect(nomes).toEqual(['Marcou com um mes', 'Marcou 5 dias antes']);
    // "Marcou ontem" não recebe nada: o agendamento já serviu de confirmação.
    expect(nomes).not.toContain('Marcou ontem');
  });

  it('runConfirmacao: sem CreateDate, confirma no D-4 como antes da regra', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockImplementation(async (d: string) =>
        d === 'd-4'
          ? [{ id: '1', patientName: 'Sem data de criacao', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10' }]
          : [],
      ),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runConfirmacao(clinicorp, dispatch, (dias) => `d-${dias}`);

    expect(sent).toBe(1);
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({ type: 'no_show', phone: '5511' });
  });

  it('procedimentoDoAtendimento: o procedimento do orçamento ganha da categoria da agenda', () => {
    // Caso real de 07/11/2026: categoria "Consulta", mas o agendamento está ligado ao orçamento.
    expect(
      procedimentoDoAtendimento({
        procedures: '22 - Tratamento endodôntico 1 canal / 22 - Tratamento endodôntico 1 canal',
        categoryDescription: 'Consulta',
      }),
    ).toContain('canal');

    expect(procedimentoDoAtendimento({ categoryDescription: 'Limpeza' })).toBe('Limpeza');
    expect(procedimentoDoAtendimento({ procedures: '   ', categoryDescription: 'Limpeza' })).toBe('Limpeza');
    expect(procedimentoDoAtendimento({})).toBeUndefined();
  });

  it('runPostProcedure: usa o procedimento do orçamento mesmo quando a categoria é "Consulta"', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Fez canal', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Consulta', procedures: '22 - Tratamento endodôntico 1 canal' },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runPostProcedure(clinicorp, dispatch, (m) => `d-${m}`);

    expect(sent).toBe(1);
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
      procedure: '22 - Tratamento endodôntico 1 canal',
    });
  });

  it('runPostProcedure: não manda para o GHL quem a agenda registrou como "Consulta"', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Quem fez limpeza', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Limpeza' },
        { id: '2', patientName: 'Quem so consultou', mobilePhone: '5522', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Consulta' },
        { id: '3', patientName: 'Quem foi avaliado', mobilePhone: '5533', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Avaliação Recreio' },
        { id: '4', patientName: 'Escaneado', mobilePhone: '5544', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Escaneamento' },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runPostProcedure(clinicorp, dispatch, (m) => `d-${m}`);

    expect(sent).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({ phone: '5511', procedure: 'Limpeza' });
  });

  it('isProcedimentoCirurgico: pega cirurgia, extração e canal nas variações da agenda', () => {
    expect(isProcedimentoCirurgico('Cirurgia')).toBe(true);
    expect(isProcedimentoCirurgico('CIRURGIA DE SISO')).toBe(true);
    expect(isProcedimentoCirurgico('Exodontia')).toBe(true);
    expect(isProcedimentoCirurgico('Extração de dente')).toBe(true);
    expect(isProcedimentoCirurgico('Extrações múltiplas')).toBe(true);
    expect(isProcedimentoCirurgico('Canal')).toBe(true);
    expect(isProcedimentoCirurgico('Endodontia')).toBe(true);
    expect(isProcedimentoCirurgico('Frenectomia')).toBe(true);
  });

  it('isProcedimentoCirurgico: não pega procedimento de rotina nem implante', () => {
    expect(isProcedimentoCirurgico('Limpeza')).toBe(false);
    expect(isProcedimentoCirurgico('Clareamento')).toBe(false);
    expect(isProcedimentoCirurgico('Ortodontia infantil')).toBe(false);
    // Implante fica de fora de propósito: a categoria cobre também as etapas protéticas.
    expect(isProcedimentoCirurgico('Implante unitário')).toBe(false);
    expect(isProcedimentoCirurgico(undefined)).toBe(false);
    expect(isProcedimentoCirurgico('')).toBe(false);
  });

  it('pós-cirurgia: dispara só para quem compareceu e fez procedimento cirúrgico', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Ana', mobilePhone: '5521111', statusId: CHECKOUT_ID, categoryDescription: 'Canal', unit: 'Recreio' },
        { id: '2', patientName: 'Bruno', mobilePhone: '5521222', statusId: CHECKOUT_ID, categoryDescription: 'Limpeza' },
        { id: '3', patientName: 'Faltou', mobilePhone: '5521333', statusId: 1, categoryDescription: 'Cirurgia' },
        { id: '4', patientName: 'SemFone', statusId: CHECKOUT_ID, categoryDescription: 'Exodontia' },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const sent = await runPosCirurgia(clinicorp, dispatch, '2026-11-10');

    expect(sent).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'pos_cirurgia',
      phone: '5521111',
      name: 'Ana',
      procedure: 'Canal',
      unit: 'Recreio',
    });
  });

  it('pós-cirurgia: não dispara se a Clinicorp não expõe o status de atendido', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentStatuses: vi.fn().mockResolvedValue([]),
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Ana', mobilePhone: '5521111', statusId: CHECKOUT_ID, categoryDescription: 'Canal' },
      ]),
    });
    const dispatch = vi.fn().mockResolvedValue(undefined);

    expect(await runPosCirurgia(clinicorp, dispatch, '2026-11-10')).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('réguas — cronEngine', () => {
  it('isoDate desloca dias em UTC', () => {
    expect(isoDate(new Date('2026-06-26T10:00:00.000Z'), 0)).toBe('2026-06-26');
    expect(isoDate(new Date('2026-06-26T10:00:00.000Z'), 1)).toBe('2026-06-27');
  });

  it('monthsAgoIso recua meses em UTC (aritmética de calendário)', () => {
    expect(monthsAgoIso(new Date('2026-06-29T12:00:00.000Z'), 6)).toBe('2025-12-29');
    expect(monthsAgoIso(new Date('2026-06-29T12:00:00.000Z'), 12)).toBe('2025-06-29');
  });

  it('runDailyReguas roda aniversário + confirmação (96h antes) quando ambos configurados', async () => {
    const clinicorp = fakeClinicorp({
      listBirthdays: vi.fn().mockResolvedValue([{ patientId: 1, name: 'Ana', birthDate: '1996-06-26', age: 30, mobilePhone: '5521999' }]),
      listAppointmentsByDate: vi.fn().mockResolvedValue([{ id: '10', patientName: 'B', mobilePhone: '5521888', date: 'x', fromTime: '9:00', toTime: '9:30' }]),
    });
    const aniversario = vi.fn().mockResolvedValue(undefined);
    const noShow = vi.fn().mockResolvedValue(undefined);

    const res = await runDailyReguas(clinicorp, { aniversario, noShow }, new Date('2026-06-26T12:00:00.000Z'));

    expect(res).toEqual({ aniversario: 1, noShow: 1, posProcedimento: 0, nps: 0, inatividade: 0, posCirurgia: 0 });
    // 96h = 4 dias à frente (mudança do cliente em 12/11/2026; antes era o dia seguinte).
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('2026-06-30');
    expect(CONFIRMACAO_DIAS_ANTES).toBe(4);
  });

  it('o lembrete da manhã não sai na rodada diária: ele tem rodada própria às 7h30', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([{ id: '10', patientName: 'B', mobilePhone: '5521888', date: 'x', fromTime: '9:00', toTime: '9:30' }]),
    });
    const aniversario = vi.fn().mockResolvedValue(undefined);
    const lembreteHoje = vi.fn().mockResolvedValue(undefined);

    await runDailyReguas(clinicorp, { aniversario, lembreteHoje }, new Date('2026-06-26T12:00:00.000Z'));

    expect(lembreteHoje).not.toHaveBeenCalled();
  });

  it('runDailyReguas pula no-show e pós-procedimento quando não há dispatcher', async () => {
    const clinicorp = fakeClinicorp({ listBirthdays: vi.fn().mockResolvedValue([]) });
    const aniversario = vi.fn().mockResolvedValue(undefined);

    const res = await runDailyReguas(clinicorp, { aniversario }, new Date('2026-06-26T12:00:00.000Z'));

    expect(res).toEqual({ aniversario: 0, noShow: 0, posProcedimento: 0, nps: 0, inatividade: 0, posCirurgia: 0 });
    expect(clinicorp.listAppointmentsByDate).not.toHaveBeenCalled();
  });

  it('runDailyReguas roda pós-procedimento quando o dispatcher existe', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Atend', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID, categoryDescription: 'Limpeza' },
      ]),
    });
    const aniversario = vi.fn().mockResolvedValue(undefined);
    const posProcedimento = vi.fn().mockResolvedValue(undefined);

    const res = await runDailyReguas(clinicorp, { aniversario, posProcedimento }, new Date('2026-06-29T12:00:00.000Z'));

    // Limpeza = 6 meses → dispara 1x (apenas no bucket de 6m); 3m e 12m não casam.
    expect(res).toEqual({ aniversario: 0, noShow: 0, posProcedimento: 1, nps: 0, inatividade: 0, posCirurgia: 0 });
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('2025-12-29'); // 6 meses antes
  });

  it('runDailyReguas roda NPS (T-1) quando o dispatcher existe', async () => {
    const clinicorp = fakeClinicorp({
      listAppointmentsByDate: vi.fn().mockResolvedValue([
        { id: '1', patientName: 'Atend', mobilePhone: '5511', date: 'x', fromTime: '9', toTime: '10', statusId: CHECKOUT_ID },
        { id: '2', patientName: 'Faltou', mobilePhone: '5522', date: 'x', fromTime: '9', toTime: '10', statusId: 111 },
      ]),
    });
    const aniversario = vi.fn().mockResolvedValue(undefined);
    const nps = vi.fn().mockResolvedValue(undefined);

    const res = await runDailyReguas(clinicorp, { aniversario, nps }, new Date('2026-06-29T12:00:00.000Z'));

    expect(res).toEqual({ aniversario: 0, noShow: 0, posProcedimento: 0, nps: 1, inatividade: 0, posCirurgia: 0 });
    expect(clinicorp.listAppointmentsByDate).toHaveBeenCalledWith('2026-06-28'); // ontem (T-1)
    expect(nps).toHaveBeenCalledWith(expect.objectContaining({ type: 'nps', phone: '5511' }));
  });
});

describe('réguas — dispatcher', () => {
  it('faz POST com headers (id/token/flow) e body {nome, numero}', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const dispatch = createHttpDispatcher(
      { url: 'https://flow.example/hook', accountId: 'acc', token: 'tok', flow: 'fl' },
      fetchFn,
    );

    await dispatch({ type: 'aniversario', phone: '+55 21 99999-8888', name: 'Ana' });

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://flow.example/hook');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ id: 'acc', token: 'tok', flow: 'fl', 'Content-Type': 'application/json' });
    // numero normalizado (só dígitos) + variáveis do template aprovado na Meta
    expect(JSON.parse(init.body as string)).toEqual({
      nome: 'Ana',
      numero: '5521999998888',
      tipo: 'aniversario',
      track: 'adulto',
      var1: 'Ana',
    });
  });

  it('trilha infantil manda track + var2 (nome da criança) para o template certo', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const dispatch = createHttpDispatcher(
      { url: 'https://flow.example/hook', accountId: 'acc', token: 'tok', flow: 'fl' },
      fetchFn,
    );

    await dispatch({
      type: 'aniversario',
      phone: '5521999998888',
      name: 'Joãozinho',
      track: 'infantil',
      childName: 'Joãozinho',
    });

    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      track: 'infantil',
      var1: 'Joãozinho',
      var2: 'Joãozinho',
    });
  });
});
