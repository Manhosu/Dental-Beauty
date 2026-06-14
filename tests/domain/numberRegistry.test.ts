import { describe, it, expect } from 'vitest';
import { NumberRegistry, WhatsappRole } from '../../src/domain/numberRegistry';

const registry = new NumberRegistry([
  { number: '5521991282761', role: 'reception' },
  { number: '5521981217082', role: 'lead' },
  { number: '5521920002328', role: 'dispatch' },
  { number: '5521975520232', role: 'quote' },
]);

describe('NumberRegistry', () => {
  it('resolve papel por número (normalizando)', () => {
    expect(registry.roleFor('+55 (21) 98121-7082')).toBe<WhatsappRole>('lead');
  });
  it('resolve número por papel', () => {
    expect(registry.numberFor('dispatch')).toBe('5521920002328');
  });
  it('retorna undefined para número desconhecido', () => {
    expect(registry.roleFor('5511000000000')).toBeUndefined();
  });
});
