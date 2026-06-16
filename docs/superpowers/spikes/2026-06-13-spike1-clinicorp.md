# Spike 1 — Mapeamento da API Clinicorp

**Status:** ✅ MAPEADO (via Swagger + chamadas read-only autenticadas, 2026-06-15).
**Doc oficial:** https://sistema.clinicorp.com/api-docs/

## Autenticação
- **Esquema:** HTTP **Basic Auth**.
  - **Username** = Usuário API (`CLINICORP_API_USER` = `oralmultiedentalbeautyoralmulti`).
  - **Password** = Token API (`CLINICORP_API_TOKEN`).
  - Header: `Authorization: Basic base64(user:token)`.
- **Base URL real:** `https://api.clinicorp.com/rest/v1` (⚠️ NÃO é `sistema.clinicorp.com` — esse é só o portal do Swagger).
- **`subscriber_id`** (query) é **obrigatório** na maioria dos endpoints. Para esta conta funciona qualquer um de: `oralmultiedentalbeauty` (canônico, bate com o namespace), `oralmulti`, `dentalbeauty`. **Usar `oralmultiedentalbeauty`** → vira config `CLINICORP_SUBSCRIBER_ID`.
- Namespace da conta: `oralmultiedentalbeauty.br.rj.rio_de_janeiro`.

## Dados reais confirmados (mascarados)
- **Clínica (`GET /business/list`):** `{ id: 6247357829611520, Name: "Dental Beauty", Address: "...Recreio dos Bandeirantes, Rio de Janeiro - RJ", Email: financeiro@dentalbeauty.com.br }` → **business_id = 6247357829611520**.
- **Profissionais (`GET /professional/list_all_professionals`):** 11 ativos, ex: Adriana-Ortodontia, Fábio-Odontopediatria, Leandro-Endodontista, Carolina-Periodontista, Haylane/Lívia-Protesista, Alinne-Lentes, Thaynara-Clínica Geral, Sergio Sinzato-Bucomaxilo. Campos: `{ id, name, cpf }`.
- **Especialidades (`GET /procedures/list_specialties`):** ex: "Avaliação Implante", "Avaliação Lentes", "Avaliação Odontopediatria". Campos: `{ id, Description, Type:"EXPERTISE", Active:"X", Language, z_* }`.

## Endpoints relevantes (base `https://api.clinicorp.com/rest/v1`)

| Função | Método/Path | Params confirmados | Observação |
|---|---|---|---|
| Listar especialidades | `GET /procedures/list_specialties` | `subscriber_id` | ✔ testado, retorna dados |
| Listar profissionais | `GET /professional/list_all_professionals` | `subscriber_id` | ✔ testado |
| Listar clínicas | `GET /business/list` | `subscriber_id` | ✔ testado |
| Horários por clínica | `GET /business/list_available_times` | `subscriber_id` (+?) | a confirmar params |
| Dias disponíveis | `GET /appointment/get_avaliable_days` | `subscriber_id` + **código de acesso** | 400 pediu "código de acesso" |
| Horários disponíveis | `GET /appointment/get_avaliable_times_calendar` | `subscriber_id` + **data `YYYY-MM-DD`** (+ código de acesso) | 400 pediu a data |
| Ocupação da agenda | `GET /appointment/schedule_occupation` | `subscriber_id` (+?) | leitura de agenda |
| Criar agend. online | `POST /appointment/create_online_scheduling` | corpo (a mapear) | fluxo de agendamento online |
| Criar agend. por API | `POST /appointment/create_appointment_by_api` | corpo (a mapear) | criação direta |
| Confirmar agend. | `POST /appointment/confirm_appointment` | corpo | confirmação de presença |
| Cancelar agend. | `POST /appointment/cancel_appointment` | corpo | **libera vaga (anti no-show)** |
| Buscar paciente | `GET /patient/get` | `subscriber_id` (+ telefone/id) | a confirmar |
| Criar paciente | `POST /patient/create` | corpo | |
| **Aniversariantes** | `GET /patient/birthdays` | `subscriber_id` (+ data?) | **régua aniversário nativa** |
| Procedimentos do paciente | `GET /patient/list_appointments` | `subscriber_id` + paciente | histórico p/ réguas |
| Leads CRM | `POST /crm/add_leads` | corpo | |

## Pendências (para o plano de implementação)
1. **Código de acesso de agendamento online:** os endpoints de disponibilidade (`get_avaliable_days`, `get_avaliable_times_calendar`) exigem um "código de acesso". É preciso **habilitar/obter o código de Agendamento Online** no painel da Clinicorp (config da clínica). → confirmar com o cliente. Vira config `CLINICORP_ACCESS_CODE`.
2. **Mapear os corpos (request body)** de `create_online_scheduling` / `create_appointment_by_api` / `cancel_appointment` lendo os schemas no Swagger (ou via "Try it out" com dado descartável).
3. **Webhooks Clinicorp:** verificar no painel ("Gestão de Webhook") se há push de eventos (criado/cancelado) — opcional para reduzir polling.

## Ajustes nas interfaces (`src/integrations/clinicorp/types.ts`)
- `AvailabilityQuery` precisa de: `subscriberId`, `accessCode`, `date` (YYYY-MM-DD), e opcional `professionalId`/`businessId`.
- `AvailabilitySlot`: alinhar ao retorno real de `get_avaliable_times_calendar` (a capturar com a data + código de acesso).
- `CreateAppointmentInput`: alinhar ao corpo real do endpoint de criação escolhido.
- Adicionar config: `CLINICORP_SUBSCRIBER_ID`, `CLINICORP_ACCESS_CODE`.

## Ferramentas de apoio criadas
- `scripts/probe-clinicorp.mjs` — testa esquemas de auth (confirmou Basic).
- `scripts/clinicorp-get.mjs` — GET autenticado read-only (usar com `subscriber_id`).
- ⚠️ Rodar via **PowerShell** (o Git Bash converte `/path` em caminho Windows).
