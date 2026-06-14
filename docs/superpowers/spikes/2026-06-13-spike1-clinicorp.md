# Spike 1 — Mapeamento da API Clinicorp

**Status:** ⏳ PENDENTE — requer credenciais no `.env` e chamadas à API de produção (a confirmar com o responsável).
**Doc oficial:** https://sistema.clinicorp.com/api-docs/
**Credenciais (no `.env`, nunca aqui):** `CLINICORP_API_USER`, `CLINICORP_API_TOKEN`.

> ⚠️ A API é de **produção**. Priorizar endpoints de **leitura**. NÃO criar agendamentos reais sem dado descartável (paciente/horário de teste) e cancelar após o teste.

## Checklist de investigação

- [ ] **Autenticação:** fluxo OAuth2 real (headers, formato do token, expiração/refresh). Documentar o passo a passo.
- [ ] **Disponibilidade:** endpoint de consulta de horários livres. Filtros suportados: profissional, unidade, especialidade. Método, path, params, shape da resposta.
- [ ] **Criar agendamento:** endpoint, payload exigido, resposta de sucesso (confirmar `HTTP 200/201`) e de conflito.
- [ ] **Cancelar / liberar vaga:** endpoint usado pelo fluxo anti no-show.
- [ ] **Paciente:** busca por telefone/nome; campos retornados.
- [ ] **Procedimentos:** listagem (ex: limpeza, implante) para as réguas e classificação.
- [ ] **Webhooks (Gestão de Webhook):** eventos disponíveis (agendamento criado/cancelado?). Avaliar se substituem o *polling* diário do Cron-Engine.
- [ ] **Rate limits:** limites observados e comportamento em 429.

## Achados

### Autenticação
_(preencher)_

### Endpoints

| Recurso | Método | Path | Params | Notas |
|---|---|---|---|---|
| Disponibilidade | | | | |
| Criar agendamento | | | | |
| Cancelar/liberar | | | | |
| Buscar paciente | | | | |
| Procedimentos | | | | |

### Exemplos de payload (mascarados — LGPD)
_(preencher)_

### Webhook push vs polling — decisão
_(preencher)_

## Ajustes necessários nas interfaces (`src/integrations/clinicorp/types.ts`)
Comparar o shape real com as interfaces atuais (`AvailabilitySlot`, `AvailabilityQuery`, `CreateAppointmentInput`, `AppointmentResult`, `ClinicorpClient`) e listar divergências:

- [ ] _(preencher)_

## Próximo passo
Com este mapeamento, escrever o plano de implementação HTTP do `ClinicorpClient` (auth + wrappers + retry/rate-limit) sobre as interfaces da Task 11.
