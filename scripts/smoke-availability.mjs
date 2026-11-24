// scripts/smoke-availability.mjs — smoke test REAL do HttpClinicorpClient contra a API.
// Uso: npx tsx scripts/smoke-availability.mjs 2026-06-22
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
console.log(`Disponibilidade ${date}: ${slots.length} horários`);
console.log(JSON.stringify(slots.slice(0, 5), null, 2));
const esps = await client.listSpecialties();
console.log(`Especialidades: ${esps.length} (ex: ${esps.slice(0, 3).map((e) => e.description).join(', ')})`);
