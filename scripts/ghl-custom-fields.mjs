// Cria os campos personalizados dos formulários no GoHighLevel.
// Fonte dos campos: docs/specs-funil-formularios.md (specs do cliente).
// Idempotente: pula o que já existe (compara por nome).
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
);
const headers = {
  Authorization: 'Bearer ' + env.GHL_PRIVATE_TOKEN,
  Version: env.GHL_API_VERSION,
  Accept: 'application/json',
  'Content-Type': 'application/json',
};
const url = `${env.GHL_API_BASE}/locations/${env.GHL_LOCATION_ID}/customFields`;

const CAMPOS = [
  // ── Atendimento Lead ────────────────────────────────────────────────
  { name: 'Canal de Entrada', dataType: 'SINGLE_OPTIONS', options: ['Formulário', 'Site', 'Facebook/Instagram', 'Comentário', 'Indicação', 'Parceria', 'Propaganda', 'Currículo', 'Engano', 'Não identificado'] },
  { name: 'Campanha/Parceiro', dataType: 'SINGLE_OPTIONS', options: ['Implante', 'Odonto Recreio', 'Odonto Ipanema', 'Lentes Recreio', 'Lentes Ipanema', 'Eventos', 'Parceria Espaço Pontal', 'Indicação', 'Outra'] },
  { name: 'Especialidade', dataType: 'SINGLE_OPTIONS', options: ['Avaliação geral', 'Odontopediatria', 'Ortodontia infantil', 'Ortodontia adulto', 'Clareamento', 'Lentes', 'Implante unitário', 'Implante protocolo', 'Prótese', 'Periodontia', 'Canal', 'Frenectomia', 'Não identificado'] },
  { name: 'Status da Negociação', dataType: 'SINGLE_OPTIONS', options: ['Em conversa', 'Em agendamento', 'Agendado 1 pessoa', 'Agendado 2 ou mais', 'Reagendamento', 'Retorno futuro', 'Sem acordo'] },
  { name: 'Motivo Sem Acordo', dataType: 'SINGLE_OPTIONS', options: ['Agendamento concluído', 'Procedimento não atendido', 'Convênio', 'SUS', 'Já em tratamento', 'Financeiro', 'Mora distante', 'Sem tempo', 'Sem resposta (houve interação)', 'Sem resposta (só encaminhado)', 'Retornará outra data', 'Clique errado', 'Engano'] },
  { name: 'Bairro', dataType: 'TEXT' },
  { name: 'Código Clinicorp', dataType: 'TEXT' },
  { name: 'Profissional', dataType: 'TEXT' },
  { name: 'Data/Hora do Agendamento', dataType: 'DATE' },
  { name: 'Resumo do Atendimento', dataType: 'LARGE_TEXT' },
  { name: 'Já é paciente', dataType: 'SINGLE_OPTIONS', options: ['Sim', 'Não'] },
  { name: 'Trilha', dataType: 'SINGLE_OPTIONS', options: ['Adulto', 'Infantil'] },
  { name: 'Nome do Responsável', dataType: 'TEXT' },
  { name: 'Nome da Criança', dataType: 'TEXT' },

  // ── Orçamento ───────────────────────────────────────────────────────
  { name: 'Orçamento - Tipo de Cliente', dataType: 'SINGLE_OPTIONS', options: ['Cliente novo', 'Cliente antigo'] },
  { name: 'Orçamento - Mês', dataType: 'TEXT' },
  { name: 'Orçamento - Especialidade', dataType: 'SINGLE_OPTIONS', options: ['Implante protocolo', 'Implante unitário', 'Implante 2 ou mais', 'Ortodontia/Ortopedia', 'Odontopediatria', 'Invisalign', 'Gerais', 'Lentes'] },
  { name: 'Orçamento - Status', dataType: 'SINGLE_OPTIONS', options: ['Em negociação', 'Agendado', 'Fechado', 'Solicitou retorno', 'Sem resposta', 'Não fechado', 'Sem condições financeiras'] },
  { name: 'Orçamento - Valor', dataType: 'MONETORY' },
  { name: 'Orçamento - Retorno Agendado', dataType: 'DATE' },
  { name: 'Orçamento - Observações', dataType: 'LARGE_TEXT' },

  // ── Relacionamento / réguas ─────────────────────────────────────────
  { name: 'NPS - Nota', dataType: 'NUMERICAL' },
  { name: 'Último Procedimento', dataType: 'TEXT' },
  { name: 'Data do Último Atendimento', dataType: 'DATE' },
];

const existentes = await fetch(url, { headers })
  .then((r) => r.json())
  .then((j) => new Set((j.customFields ?? []).map((c) => c.name)));

let criados = 0, pulados = 0, erros = 0;
for (const campo of CAMPOS) {
  if (existentes.has(campo.name)) { pulados++; continue; }
  const body = { name: campo.name, dataType: campo.dataType, model: 'contact', ...(campo.options ? { options: campo.options } : {}) };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.status === 201 || res.ok) { criados++; }
  else { erros++; console.log('ERRO', campo.name, res.status, (await res.text()).slice(0, 160)); }
  await new Promise((r) => setTimeout(r, 350));
}
console.log(`criados=${criados} pulados=${pulados} erros=${erros} total=${CAMPOS.length}`);
