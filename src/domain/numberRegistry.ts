export type WhatsappRole = 'reception' | 'lead' | 'dispatch' | 'quote';

export interface NumberMapping {
  number: string; // E.164 só dígitos, ex: 5521991282761
  role: WhatsappRole;
}

function normalize(raw: string): string {
  return raw.replace(/\D/g, '');
}

export class NumberRegistry {
  private byNumber = new Map<string, WhatsappRole>();
  private byRole = new Map<WhatsappRole, string>();

  constructor(mappings: NumberMapping[]) {
    for (const m of mappings) {
      const n = normalize(m.number);
      this.byNumber.set(n, m.role);
      this.byRole.set(m.role, n);
    }
  }

  roleFor(number: string): WhatsappRole | undefined {
    return this.byNumber.get(normalize(number));
  }

  numberFor(role: WhatsappRole): string | undefined {
    return this.byRole.get(role);
  }
}
