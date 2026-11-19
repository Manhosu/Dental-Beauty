/**
 * Horário comercial da clínica (decisão do cliente, 2026-08):
 * - DENTRO do horário → a RECEPÇÃO humana atende; a IA de conversa fica em silêncio.
 * - FORA do horário → a IA atende (triagem + agendamento).
 * - Réguas/follow-ups NÃO passam por aqui: rodam sempre (Cron-Engine), dia e noite.
 *
 * O Flow Builder do Chatbotify consulta `GET /atendimento/status` e usa o bloco
 * `Condição` + `Controle de Agente` para ligar/desligar o agente conforme a resposta.
 */

/** Dia da semana no padrão JS: 0=Domingo … 6=Sábado. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface BusinessHoursConfig {
  /** Início do expediente, 'HH:mm' (hora local da clínica). */
  start: string;
  /** Fim do expediente, 'HH:mm' (exclusivo: 18:00 significa que às 18:00 já é fora). */
  end: string;
  /** Dias com expediente da recepção. Default seg–sex. */
  days: Weekday[];
  /** Offset do fuso da clínica em horas. Brasil não tem mais horário de verão → BRT fixo -3. */
  tzOffsetHours: number;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  start: '09:00',
  end: '18:00',
  days: [1, 2, 3, 4, 5],
  tzOffsetHours: -3,
};

/** 'HH:mm' → minutos desde a meia-noite. Lança em formato inválido (falha cedo no boot). */
export function parseHhMm(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) throw new Error(`horário inválido (esperado HH:mm): ${value}`);
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) throw new Error(`horário fora do intervalo: ${value}`);
  return hours * 60 + minutes;
}

/** Lista '1,2,3,4,5' → dias da semana. Vazio/ausente cai no default. */
export function parseWeekdays(value: string | undefined, fallback: Weekday[]): Weekday[] {
  if (!value || !value.trim()) return fallback;
  const days = value
    .split(',')
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) as Weekday[];
  return days.length > 0 ? days : fallback;
}

/** Momento atual na hora local da clínica (aplica o offset sobre o UTC). */
function localParts(now: Date, tzOffsetHours: number): { weekday: Weekday; minutes: number } {
  const local = new Date(now.getTime() + tzOffsetHours * 3_600_000);
  return {
    weekday: local.getUTCDay() as Weekday,
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

/** `true` quando a recepção está de plantão (logo, a IA de conversa deve ficar calada). */
export function isBusinessHours(now: Date, cfg: BusinessHoursConfig): boolean {
  const { weekday, minutes } = localParts(now, cfg.tzOffsetHours);
  if (!cfg.days.includes(weekday)) return false;
  return minutes >= parseHhMm(cfg.start) && minutes < parseHhMm(cfg.end);
}

export interface AttendanceStatus {
  /** true = dentro do expediente da recepção. */
  businessHours: boolean;
  /** Quem deve responder a conversa agora. */
  attendant: 'recepcao' | 'ia';
  /** 'HH:mm' local da clínica — facilita conferir a config no painel. */
  localTime: string;
  weekday: Weekday;
  /** Réguas/follow-ups ignoram o horário — sempre ativos. Explícito para o Flow Builder. */
  automationsAlwaysOn: true;
}

/** Resposta do endpoint consumido pelo Flow Builder. */
export function attendanceStatus(now: Date, cfg: BusinessHoursConfig): AttendanceStatus {
  const { weekday, minutes } = localParts(now, cfg.tzOffsetHours);
  const businessHours = isBusinessHours(now, cfg);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return {
    businessHours,
    attendant: businessHours ? 'recepcao' : 'ia',
    localTime: `${hh}:${mm}`,
    weekday,
    automationsAlwaysOn: true,
  };
}
