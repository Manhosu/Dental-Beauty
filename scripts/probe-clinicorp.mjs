// scripts/probe-clinicorp.mjs
//
// Sonda a API da Clinicorp para DESCOBRIR qual esquema de autenticação funciona
// e inspecionar a resposta de um endpoint. SOMENTE LEITURA (GET).
//
// Uso (PowerShell, a partir da raiz do projeto):
//   1) Garanta que o .env tem CLINICORP_API_BASE, CLINICORP_API_USER, CLINICORP_API_TOKEN
//   2) node scripts/probe-clinicorp.mjs "<PATH_DO_ENDPOINT>"
//      ex: node scripts/probe-clinicorp.mjs "/api/v1/appointment/availability"
//
// O PATH você pega no Swagger: https://sistema.clinicorp.com/api-docs/
// O script tenta vários esquemas de auth e mostra o status HTTP de cada um.
// O esquema que retornar 200 (e não 401/403) é o correto — anote no spike.
//
// ⚠️ NÃO use este script para criar/cancelar agendamentos. Apenas GET de leitura.

import { readFileSync } from 'node:fs';

// --- carrega .env manualmente (sem dependência externa) ---
function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    console.error('Não achei o arquivo .env na raiz. Crie-o a partir do .env.example.');
    process.exit(1);
  }
}
loadEnv();

const BASE = (process.env.CLINICORP_API_BASE || 'https://sistema.clinicorp.com').replace(/\/$/, '');
const USER = process.env.CLINICORP_API_USER || '';
const TOKEN = process.env.CLINICORP_API_TOKEN || '';
const path = process.argv[2];

if (!USER || !TOKEN) {
  console.error('CLINICORP_API_USER e CLINICORP_API_TOKEN precisam estar no .env.');
  process.exit(1);
}
if (!path) {
  console.error('Informe o PATH do endpoint. Ex: node scripts/probe-clinicorp.mjs "/api/v1/appointment/availability"');
  process.exit(1);
}

const basic = Buffer.from(`${USER}:${TOKEN}`).toString('base64');

// Cada candidato é uma forma diferente de mandar a credencial.
const candidates = [
  {
    name: 'Query ?subscriber&token',
    url: `${BASE}${path}${path.includes('?') ? '&' : '?'}subscriber=${encodeURIComponent(USER)}&token=${encodeURIComponent(TOKEN)}`,
    headers: {},
  },
  { name: 'Header Authorization: Bearer', url: `${BASE}${path}`, headers: { Authorization: `Bearer ${TOKEN}` } },
  { name: 'Header Authorization: Basic (user:token)', url: `${BASE}${path}`, headers: { Authorization: `Basic ${basic}` } },
  { name: 'Headers subscriber + token', url: `${BASE}${path}`, headers: { subscriber: USER, token: TOKEN } },
  { name: 'Headers x-subscriber + x-api-token', url: `${BASE}${path}`, headers: { 'x-subscriber': USER, 'x-api-token': TOKEN } },
  { name: 'Header token apenas', url: `${BASE}${path}`, headers: { token: TOKEN } },
];

function redact(s) {
  return String(s).replaceAll(TOKEN, '***TOKEN***').replaceAll(USER, '***USER***');
}

console.log(`\nBase: ${BASE}\nPath: ${path}\nTestando ${candidates.length} esquemas de auth...\n`);

for (const c of candidates) {
  try {
    const res = await fetch(c.url, { headers: { Accept: 'application/json', ...c.headers } });
    const body = await res.text();
    const preview = redact(body.slice(0, 300));
    const verdict = res.status === 200 ? '  <<< FUNCIONOU (200)' : res.status === 401 || res.status === 403 ? '  (auth rejeitada)' : '';
    console.log(`[${res.status}] ${c.name}${verdict}`);
    if (res.status === 200) console.log(`      preview: ${preview}\n`);
  } catch (err) {
    console.log(`[ERRO] ${c.name}: ${redact(err.message)}`);
  }
}

console.log('\nO esquema marcado FUNCIONOU (200) é o correto. Anote-o no spike-1.');
console.log('Se nenhum deu 200: confirme o PATH no Swagger e clique em "Authorize" lá para ver o esquema esperado.');
