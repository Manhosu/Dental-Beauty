import pino from 'pino';

const SENSITIVE_KEYS = new Set(['nome', 'name', 'telefone', 'phone', 'cpf', 'email']);

function maskString(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 8) {
    // telefone/CPF: preserva os 4 últimos dígitos
    const visible = value.slice(-4);
    return '*'.repeat(Math.max(0, value.length - 4)) + visible;
  }
  // nome ou texto curto: preserva inicial
  return value.length > 1 ? value[0] + '*'.repeat(value.length - 1) : '*';
}

export function maskSensitive(input: unknown): unknown {
  if (typeof input === 'string') return maskString(input);
  if (Array.isArray(input)) return input.map(maskSensitive);
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? maskSensitive(v) : v;
    }
    return out;
  }
  return input;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['*.telefone', '*.phone', '*.cpf', '*.nome', '*.name', '*.email'],
    censor: (value: unknown) => maskSensitive(value),
  },
});
