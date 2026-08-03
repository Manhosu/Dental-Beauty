// scripts/clinicorp-get.mjs — GET autenticado (Basic) na API Clinicorp. SOMENTE LEITURA.
// Uso: node scripts/clinicorp-get.mjs "/procedures/list_specialties?subscriber_id=123"
import { readFileSync } from 'node:fs';

function loadEnv() {
  const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const BASE = process.env.CLINICORP_API_BASE.replace(/\/$/, '');
const USER = process.env.CLINICORP_API_USER;
const TOKEN = process.env.CLINICORP_API_TOKEN;
const path = process.argv[2];
if (!path) {
  console.error('Informe o path. Ex: "/procedures/list_specialties?subscriber_id=X"');
  process.exit(1);
}
const basic = Buffer.from(`${USER}:${TOKEN}`).toString('base64');
const res = await fetch(`${BASE}${path}`, {
  headers: { Accept: 'application/json', Authorization: `Basic ${basic}` },
});
const body = await res.text();
console.log(`HTTP ${res.status} ${res.statusText}`);
console.log(body.slice(0, 1500).replaceAll(TOKEN, '***').replaceAll(USER, '***USER***'));
