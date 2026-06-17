// scripts/smoke-booking.mjs — TESTE REAL de marcação+cancelamento (cria e CANCELA na hora).
// ⚠️ Cria um agendamento de verdade na Clinicorp e cancela em seguida.
// Uso: npx tsx scripts/smoke-booking.mjs 2026-06-22
import { readFileSync } from 'node:fs';
import { HttpClinicorpClient } from '../src/integrations/clinicorp/client.ts';

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
}

const client = new HttpClinicorpClient({
  baseUrl: process.env.CLINICORP_API_BASE,
  user: process.env.CLINICORP_API_USER,
  token: process.env.CLINICORP_API_TOKEN,
  subscriberId: process.env.CLINICORP_SUBSCRIBER_ID,
  businessId: Number(process.env.CLINICORP_BUSINESS_ID),
  accessCode: process.env.CLINICORP_ACCESS_CODE,
  accessCodeParam: process.env.CLINICORP_ACCESS_CODE_PARAM,
});

const date = process.argv[2] ?? '2026-06-22';
const slots = await client.getAvailability({ date });
if (slots.length === 0) {
  console.log(`Sem horários para ${date}. Tente outra data.`);
  process.exit(0);
}
const slot = slots[0];
console.log('Slot escolhido:', slot);

const input = {
  patient: { name: 'TESTE INTEGRACAO IA - PODE CANCELAR', phone: '21999990000' },
  date: `${date}T03:00:00.000Z`,
  fromTime: slot.from,
  toTime: slot.to,
  dentistPersonId: slot.professionalId,
  // scheduleToId omitido → agendamento por profissional (modo correto confirmado em produção)
  categoryDescription: 'Teste de integração (remover)',
};

try {
  console.log('Criando agendamento de teste...');
  const created = await client.createAppointment(input);
  console.log('CRIADO:', created);

  console.log('Cancelando o agendamento de teste...');
  const cancelled = await client.cancelAppointment(created.appointmentId);
  console.log('CANCELADO:', cancelled);
  console.log(`\n>>> Verifique no painel que o agendamento ${created.appointmentId} (paciente "TESTE INTEGRACAO IA") foi removido.`);
} catch (err) {
  console.error('FALHA:', err?.message ?? err);
  console.error('(Se chegou a criar e não cancelou, remova manualmente o paciente "TESTE INTEGRACAO IA" no painel.)');
  process.exit(1);
}
