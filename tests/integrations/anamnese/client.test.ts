import { describe, it, expect, vi } from 'vitest';
import {
  HttpAnamneseClient,
  especialidadeDoAtendimento,
  ESPECIALIDADE_PADRAO,
} from '../../../src/integrations/anamnese/client';
import { ExternalApiError } from '../../../src/lib/errors';

const config = { baseUrl: 'https://odontobi.test', secret: 'segredo-de-teste' };

function respostaOk(over: Record<string, unknown> = {}): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 'daf0f285-5517-4976-bfb8-79ff587600ab',
      link: 'https://odontobi.pages.dev/anamnese?t=abc',
      especialidade: 'implante',
      expira_em: '2026-12-17T14:38:49+00:00',
      reaproveitado: false,
      respondido: false,
      respondido_em: null,
      no_clinicorp: false,
      ...over,
    }),
  } as unknown as Response;
}

describe('HttpAnamneseClient', () => {
  it('cria o link mandando o segredo no header e o PatientId no corpo', async () => {
    const fetchFn = vi.fn().mockResolvedValue(respostaOk());
    const client = new HttpAnamneseClient(config, fetchFn as unknown as typeof fetch);

    const link = await client.criarLink({
      especialidade: 'implante',
      clinicorpPatientId: '5192245887762432',
      nome: 'Maria de Souza',
    });

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://odontobi.test/api/v1/anamnese/externo/links');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-anamnese-secret']).toBe('segredo-de-teste');
    expect(JSON.parse(init.body as string)).toEqual({
      especialidade: 'implante',
      clinicorp_patient_id: '5192245887762432',
      nome: 'Maria de Souza',
    });
    expect(link.id).toBe('daf0f285-5517-4976-bfb8-79ff587600ab');
    expect(link.respondido).toBe(false);
  });

  it('omite os campos opcionais que não vieram', async () => {
    const fetchFn = vi.fn().mockResolvedValue(respostaOk());
    const client = new HttpAnamneseClient(config, fetchFn as unknown as typeof fetch);

    await client.criarLink({ especialidade: 'clinico_geral', nome: 'Joao' });

    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      especialidade: 'clinico_geral',
      nome: 'Joao',
    });
  });

  it('consulta o link e lê que o paciente já respondeu', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(respostaOk({ respondido: true, respondido_em: '2026-11-19T10:00:00Z' }));
    const client = new HttpAnamneseClient(config, fetchFn as unknown as typeof fetch);

    const link = await client.consultarLink('daf0f285-5517-4976-bfb8-79ff587600ab');

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://odontobi.test/api/v1/anamnese/externo/links/daf0f285-5517-4976-bfb8-79ff587600ab',
    );
    expect(init.method).toBe('GET');
    expect(link.respondido).toBe(true);
    expect(link.respondidoEm).toBe('2026-11-19T10:00:00Z');
  });

  it('não repete a chamada em 401: segredo errado não melhora tentando de novo', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 401, json: async () => ({}) } as unknown as Response);
    const client = new HttpAnamneseClient(config, fetchFn as unknown as typeof fetch);

    await expect(client.criarLink({ especialidade: 'lentes', nome: 'X' })).rejects.toBeInstanceOf(
      ExternalApiError,
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('o erro não carrega o segredo nem o corpo da resposta', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, json: async () => ({}) } as unknown as Response);
    const client = new HttpAnamneseClient(config, fetchFn as unknown as typeof fetch);

    await expect(
      client.criarLink({ especialidade: 'lentes', nome: 'X' }),
    ).rejects.toThrowError(/Anamnese POST .* -> 400/);
    await expect(
      client.criarLink({ especialidade: 'lentes', nome: 'X' }),
    ).rejects.not.toThrowError(/segredo-de-teste/);
  });
});

describe('especialidadeDoAtendimento', () => {
  it('criança vai para odontopediatria, mesmo quando o procedimento é ortopedia', () => {
    expect(especialidadeDoAtendimento({ infantil: true, procedimento: 'Ortopedia' })).toBe(
      'odontopediatria',
    );
    expect(especialidadeDoAtendimento({ infantil: true })).toBe('odontopediatria');
  });

  it('casa os radicais de cada formulário', () => {
    expect(especialidadeDoAtendimento({ procedimento: 'Instalação de aparelho(ortodontia)' })).toBe('ortodontia');
    expect(especialidadeDoAtendimento({ procedimento: 'Invisalign' })).toBe('ortodontia');
    expect(especialidadeDoAtendimento({ procedimento: 'Implantodontia' })).toBe('implante');
    expect(especialidadeDoAtendimento({ procedimento: 'Prótese retorno laboratório' })).toBe('protese');
    expect(especialidadeDoAtendimento({ procedimento: 'Coroa' })).toBe('protese');
    expect(especialidadeDoAtendimento({ procedimento: 'Lentes de contato dental' })).toBe('lentes');
    expect(especialidadeDoAtendimento({ procedimento: 'Faceta' })).toBe('lentes');
    expect(especialidadeDoAtendimento({ procedimento: '22 - Tratamento endodôntico 1 canal' })).toBe('endodontia');
  });

  it('cai no clínico geral quando a agenda não diz nada útil', () => {
    expect(especialidadeDoAtendimento({ procedimento: 'Consulta' })).toBe(ESPECIALIDADE_PADRAO);
    expect(especialidadeDoAtendimento({ procedimento: 'Avaliação Recreio' })).toBe(ESPECIALIDADE_PADRAO);
    expect(especialidadeDoAtendimento({})).toBe(ESPECIALIDADE_PADRAO);
    expect(especialidadeDoAtendimento({ procedimento: '   ' })).toBe(ESPECIALIDADE_PADRAO);
  });
});
