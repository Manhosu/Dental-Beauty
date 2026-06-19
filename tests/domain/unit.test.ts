import { describe, it, expect } from 'vitest';
import { unitFromProfessionalName } from '../../src/domain/unit';

describe('unitFromProfessionalName', () => {
  it('returns Ipanema when name contains "Ipanema" (mixed case)', () => {
    expect(unitFromProfessionalName('Fábio - Odontopediatria - Ipanema')).toBe('Ipanema');
  });

  it('returns Recreio when name has no unit marker (default)', () => {
    expect(unitFromProfessionalName('Adriana - Ortodontia')).toBe('Recreio');
  });

  it('is case-insensitive (IPANEMA → Ipanema)', () => {
    expect(unitFromProfessionalName('DR. FÁBIO - IPANEMA')).toBe('Ipanema');
  });

  it('is case-insensitive (ipanema lowercase → Ipanema)', () => {
    expect(unitFromProfessionalName('Alinne - lentes ipanema')).toBe('Ipanema');
  });

  it('returns Recreio for empty string', () => {
    expect(unitFromProfessionalName('')).toBe('Recreio');
  });

  it('returns Recreio for unrelated name', () => {
    expect(unitFromProfessionalName('Dr. Carlos - Implante')).toBe('Recreio');
  });
});
