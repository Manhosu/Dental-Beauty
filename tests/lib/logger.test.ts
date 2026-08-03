import { describe, it, expect } from 'vitest';
import { maskSensitive } from '../../src/lib/logger';

describe('maskSensitive', () => {
  it('mascara telefone preservando finais', () => {
    expect(maskSensitive('21997552032')).toBe('*******2032');
  });
  it('mascara CPF', () => {
    expect(maskSensitive('123.456.789-00')).toContain('***');
  });
  it('mascara campos sensíveis em objeto', () => {
    const out = maskSensitive({ nome: 'Maria Silva', telefone: '21999998888', idade: 30 }) as Record<string, unknown>;
    expect(out.nome).not.toBe('Maria Silva');
    expect(out.telefone).toBe('*******8888');
    expect(out.idade).toBe(30);
  });
});
