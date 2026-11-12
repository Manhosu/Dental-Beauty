import { describe, expect, it, vi } from 'vitest';
import {
  buildCustomFields,
  createGhlTagDispatcher,
  tagForPayload,
  unidadeParaOpcaoGhl,
  diaParaTexto,
  horaParaTexto,
  type GhlReguaFieldIds,
} from '../../../src/scheduling/reguas/ghlTagDispatcher';
import type { ReguaPayload } from '../../../src/scheduling/reguas/dispatcher';
import type { GoHighLevelCrmClient } from '../../../src/integrations/ghl/client';

const fields: GhlReguaFieldIds = {
  trilha: 'id-trilha',
  nomeCrianca: 'id-crianca',
  ultimoProcedimento: 'id-procedimento',
  unidade: 'id-unidade',
  reguaDia: 'id-dia',
  reguaHora: 'id-hora',
};

type UpsertInput = Parameters<GoHighLevelCrmClient['upsertContactWithFields']>[0];

function fakeClient() {
  return {
    upsertContactWithFields: vi.fn(async (_input: UpsertInput) => 'contato-1'),
    addTags: vi.fn(async (_contactId: string, _tags: string[]) => {}),
  };
}

describe('tagForPayload', () => {
  it('usa uma tag por tipo de régua', () => {
    expect(tagForPayload({ type: 'aniversario', phone: '1' })).toBe('regua-aniversario');
    expect(tagForPayload({ type: 'no_show', phone: '1' })).toBe('regua-confirmacao');
    expect(tagForPayload({ type: 'pos_procedimento', phone: '1' })).toBe('regua-posprocedimento');
    expect(tagForPayload({ type: 'nps', phone: '1' })).toBe('regua-nps');
  });

  it('separa a confirmação de 96h do lembrete da manhã: são textos diferentes', () => {
    expect(tagForPayload({ type: 'no_show', phone: '1' })).toBe('regua-confirmacao');
    expect(tagForPayload({ type: 'lembrete_hoje', phone: '1' })).toBe('regua-lembrete-hoje');
  });

  it('separa reengajamento por faixa de meses', () => {
    expect(tagForPayload({ type: 'inatividade', phone: '1', months: 6 })).toBe(
      'regua-inatividade-6',
    );
    expect(tagForPayload({ type: 'inatividade', phone: '1', months: 12 })).toBe(
      'regua-inatividade-12',
    );
  });

  it('cai em 12 meses quando o job não informou a faixa', () => {
    expect(tagForPayload({ type: 'inatividade', phone: '1' })).toBe('regua-inatividade-12');
  });

  it('prefixa tudo com regua- para não colidir com as tags da consultoria', () => {
    const tipos: ReguaPayload['type'][] = [
      'aniversario',
      'no_show',
      'pos_procedimento',
      'nps',
      'inatividade',
    ];
    for (const type of tipos) {
      expect(tagForPayload({ type, phone: '1' })).toMatch(/^regua-/);
    }
  });
});

describe('buildCustomFields', () => {
  it('grava a trilha na grafia das opcoes do GHL, com Adulto como padrão', () => {
    expect(buildCustomFields({ type: 'aniversario', phone: '1' }, fields)).toEqual([
      { id: 'id-trilha', field_value: 'Adulto' },
    ]);
  });

  it('grava o nome da criança quando a trilha é infantil', () => {
    const campos = buildCustomFields(
      { type: 'aniversario', phone: '1', track: 'infantil', childName: 'Ana' },
      fields,
    );
    expect(campos).toContainEqual({ id: 'id-trilha', field_value: 'Infantil' });
    expect(campos).toContainEqual({ id: 'id-crianca', field_value: 'Ana' });
  });

  it('não manda campo vazio quando o dado não veio da Clinicorp', () => {
    const campos = buildCustomFields({ type: 'pos_procedimento', phone: '1' }, fields);
    expect(campos.map((c) => c.id)).toEqual(['id-trilha']);
  });

  it('grava o procedimento para o workflow escolher o texto', () => {
    const campos = buildCustomFields(
      { type: 'pos_procedimento', phone: '1', procedure: 'Limpeza' },
      fields,
    );
    expect(campos).toContainEqual({ id: 'id-procedimento', field_value: 'Limpeza' });
  });

  it('normaliza a unidade para a grafia das opcoes do GHL', () => {
    expect(unidadeParaOpcaoGhl('DENTAL BEAUTY RECREIO')).toBe('Recreio');
    expect(unidadeParaOpcaoGhl('recreio')).toBe('Recreio');
    expect(unidadeParaOpcaoGhl('Dental Beauty Ipanema')).toBe('Ipanema');
    expect(unidadeParaOpcaoGhl('IPANEMA')).toBe('Ipanema');
  });

  it('não grava unidade quando não reconhece o nome, para não sujar o campo', () => {
    expect(unidadeParaOpcaoGhl('Barra da Tijuca')).toBeUndefined();
    expect(unidadeParaOpcaoGhl(undefined)).toBeUndefined();
    const campos = buildCustomFields(
      { type: 'nps', phone: '1', unit: 'Barra da Tijuca' },
      fields,
    );
    expect(campos.map((c) => c.id)).not.toContain('id-unidade');
  });

  it('formata dia e hora da consulta para o texto da confirmação', () => {
    expect(diaParaTexto('2026-11-12T03:00:00.000Z')).toBe('12/11');
    expect(diaParaTexto('2026-11-12')).toBe('12/11');
    expect(diaParaTexto('2026-01-05')).toBe('05/01');
    expect(horaParaTexto('9:00')).toBe('09:00');
    expect(horaParaTexto('14:30')).toBe('14:30');
    expect(horaParaTexto('9:00 - 9:30')).toBe('09:00');
  });

  it('não inventa dia nem hora quando o dado não veio ou veio quebrado', () => {
    expect(diaParaTexto(undefined)).toBeUndefined();
    expect(diaParaTexto('x')).toBeUndefined();
    expect(horaParaTexto(undefined)).toBeUndefined();
    expect(horaParaTexto('manhã')).toBeUndefined();
  });

  it('grava dia e hora na confirmação de consulta', () => {
    const campos = buildCustomFields(
      { type: 'no_show', phone: '1', date: '2026-11-12T03:00:00.000Z', fromTime: '9:00' },
      fields,
    );
    expect(campos).toContainEqual({ id: 'id-dia', field_value: '12/11' });
    expect(campos).toContainEqual({ id: 'id-hora', field_value: '09:00' });
  });

  it('grava dia e hora também no lembrete da manhã, que usa a hora no texto', () => {
    const campos = buildCustomFields(
      { type: 'lembrete_hoje', phone: '1', date: '2026-11-12', fromTime: '14:30' },
      fields,
    );
    expect(campos).toContainEqual({ id: 'id-dia', field_value: '12/11' });
    expect(campos).toContainEqual({ id: 'id-hora', field_value: '14:30' });
  });

  it('grava a unidade para a pesquisa escolher o link do Google certo', () => {
    const campos = buildCustomFields(
      { type: 'nps', phone: '1', unit: 'Dental Beauty Ipanema' },
      fields,
    );
    expect(campos).toContainEqual({ id: 'id-unidade', field_value: 'Ipanema' });
  });
});

describe('createGhlTagDispatcher', () => {
  it('faz upsert e depois marca a tag', async () => {
    const client = fakeClient();
    const dispatch = createGhlTagDispatcher({ client, fields });

    await dispatch({ type: 'aniversario', phone: '(21) 99999-8888', name: 'Maria Silva' });

    expect(client.upsertContactWithFields).toHaveBeenCalledWith({
      phone: '21999998888',
      name: 'Maria Silva',
      customFields: [{ id: 'id-trilha', field_value: 'Adulto' }],
    });
    expect(client.addTags).toHaveBeenCalledWith('contato-1', ['regua-aniversario']);
  });

  it('não manda tags no upsert, senão apagaria as tags da consultoria', async () => {
    const client = fakeClient();
    const dispatch = createGhlTagDispatcher({ client, fields });

    await dispatch({ type: 'nps', phone: '21999998888' });

    const corpo = client.upsertContactWithFields.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(corpo).not.toHaveProperty('tags');
  });

  it('omite o nome quando a Clinicorp não devolveu, para não sobrescrever o cadastro', async () => {
    const client = fakeClient();
    const dispatch = createGhlTagDispatcher({ client, fields });

    await dispatch({ type: 'nps', phone: '21999998888' });

    const corpo = client.upsertContactWithFields.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(corpo).not.toHaveProperty('name');
  });

  it('não marca a tag se o upsert falhar', async () => {
    const client = fakeClient();
    client.upsertContactWithFields.mockRejectedValueOnce(new Error('502'));
    const dispatch = createGhlTagDispatcher({ client, fields });

    await expect(dispatch({ type: 'aniversario', phone: '21999998888' })).rejects.toThrow('502');
    expect(client.addTags).not.toHaveBeenCalled();
  });
});
