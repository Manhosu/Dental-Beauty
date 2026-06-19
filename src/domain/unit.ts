export type ClinicUnit = 'Ipanema' | 'Recreio';

// Deriva a unidade pelo nome do profissional (convenção: "... - Ipanema" / "... - Recreio").
// Padrão é Recreio (unidade principal) quando o nome não indica Ipanema.
export function unitFromProfessionalName(name: string): ClinicUnit {
  return /ipanema/i.test(name) ? 'Ipanema' : 'Recreio';
}
