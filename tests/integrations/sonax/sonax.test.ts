import { describe, it, expect, vi } from 'vitest';
import {
  sonaxQuerySchema,
  normalizeSonaxEvent,
  buildCallNote,
  handleSonaxCall,
  digits,
  type SonaxCrmPort,
} from '../../../src/integrations/sonax/sonax';

const base = {
  ID_CHAMADA: 'C1',
  NUMERO: '(21) 99999-8888',
};

describe('sonax — schema + normalização', () => {
  it('exige ID_CHAMADA e NUMERO', () => {
    expect(sonaxQuerySchema.safeParse({}).success).toBe(false);
    expect(sonaxQuerySchema.safeParse(base).success).toBe(true);
  });

  it('atendimento (sem DATA_FIM) → phase answered; telefone só dígitos', () => {
    const e = normalizeSonaxEvent(sonaxQuerySchema.parse({ ...base, STATUS_ATENDIMENTO: 'ATENDIDA' }));
    expect(e.phase).toBe('answered');
    expect(e.phone).toBe('21999998888');
    expect(e.answerStatus).toBe('ATENDIDA');
    expect(e.endedAt).toBeUndefined();
  });

  it('desligamento (com DATA_FIM) → phase ended; duração numérica e gravação', () => {
    const e = normalizeSonaxEvent(
      sonaxQuerySchema.parse({
        ...base,
        DATA_INICIO: '2026-07-20 10:00:00',
        DATA_FIM: '2026-07-20 10:03:20',
        DURACAO_CHAMADA: '200',
        URL_GRAVACAO: 'https://rec/abc.mp3',
      }),
    );
    expect(e.phase).toBe('ended');
    expect(e.durationSec).toBe(200);
    expect(e.recordingUrl).toBe('https://rec/abc.mp3');
  });

  it('ignora placeholders "<NUMERO>" e strings vazias', () => {
    const e = normalizeSonaxEvent(
      sonaxQuerySchema.parse({ ...base, URL_GRAVACAO: '', STATUS_CHAMADA: '<STATUS_CHAMADA>' }),
    );
    expect(e.recordingUrl).toBeUndefined();
    expect(e.callStatus).toBeUndefined();
  });

  it('digits limpa não-dígitos', () => {
    expect(digits('+55 (21) 9-8888')).toBe('5521 98888'.replace(/\D/g, ''));
  });

  it('buildCallNote inclui status, duração, gravação e id', () => {
    const e = normalizeSonaxEvent(
      sonaxQuerySchema.parse({ ...base, DATA_FIM: 'x', DURACAO_CHAMADA: '90', STATUS_ATENDIMENTO: 'ATENDIDA', URL_GRAVACAO: 'https://r/1' }),
    );
    const note = buildCallNote(e);
    expect(note).toContain('encerrada');
    expect(note).toContain('ATENDIDA');
    expect(note).toContain('90s');
    expect(note).toContain('https://r/1');
    expect(note).toContain('C1');
  });
});

describe('sonax — handler', () => {
  it('faz upsert do contato pelo telefone com a nota da ligação', async () => {
    const crm: SonaxCrmPort = {
      upsertContactWithNote: vi.fn().mockResolvedValue(undefined),
    };
    const e = normalizeSonaxEvent(sonaxQuerySchema.parse({ ...base, STATUS_ATENDIMENTO: 'ATENDIDA' }));
    const r = await handleSonaxCall(e, crm);

    expect(crm.upsertContactWithNote).toHaveBeenCalledWith('21999998888', expect.stringContaining('ATENDIDA'));
    expect(r).toEqual({ noted: true });
  });
});
