# Requisições HTTP do Agente (Chatbotify → backend de agendamento)

Config das 3 requisições que o agente usa. Backend: **`https://dental-beauty-agenda.onrender.com`** (Render, `/health` → 200).
**Header obrigatório em TODAS:** `x-api-key: <API_KEY_SECRET>` (o valor está no Render → serviço `dental-beauty-agenda` → Environment → `API_KEY_SECRET`). Sem ele → 401.

> ⚠️ Não versionar o valor da chave aqui. Ela vive só no Render e no painel do Chatbotify.

Aba do painel: **Configurar Agente → Requisições HTTP** (ativar o "Agente HTTP Request" primeiro).

---

## 1) Consultar horários disponíveis
- **Método:** `GET`
- **URL:** `https://dental-beauty-agenda.onrender.com/agendamento/disponibilidade?date={{date}}`
  - opcional: `&professionalId={{professionalId}}`
  - `date` no formato `AAAA-MM-DD`
- **Headers:** `x-api-key: <chave>`
- **Resposta 200:**
```json
{ "date": "2026-07-29", "slots": [
  { "from": "11:00", "to": "12:00", "professionalId": 6467093833252864,
    "professionalName": "Lívia - Protesista - Recreio", "unit": "Recreio", "dayWeek": 3, "businessId": 6247357829611520 }
]}
```
- O agente filtra `slots` pelo **profissional** (roteamento) e **unidade**, e oferece até 3 `from`. Guarda `professionalId` e `to` do slot escolhido (precisa deles pra marcar).

## 2) Marcar agendamento
- **Método:** `POST`
- **URL:** `https://dental-beauty-agenda.onrender.com/agendamento/book`
- **Headers:** `x-api-key: <chave>` · `Content-Type: application/json`
- **Body (campos planos, o backend monta o resto):**
```json
{
  "name": "{{nome}}",
  "phone": "{{telefone}}",
  "date": "{{date}}",
  "fromTime": "{{fromTime}}",
  "toTime": "{{toTime}}",
  "professionalId": "{{professionalId}}"
}
```
  - O backend deriva sozinho: `patient` (de name/phone), `dentistPersonId` (= professionalId), `slotId` (date-fromTime-professionalId) e `specialty` (default "Avaliação"). Opcional mandar `email`, `specialty`, `procedures`.
- **Respostas:**
  - `201` → `{ "status": "confirmed", "appointmentId": "..." }` → confirmar ao paciente + mover CRM p/ "Agendado".
  - `409` → `{ "status": "slot_taken" }` → horário ocupado; consultar disponibilidade de novo e reoferecer.
  - `502` → `{ "status": "failed", "reason": "..." }` → tentar 1x; se persistir, handoff humano.

## 3) Cancelar agendamento
- **Método:** `POST`
- **URL:** `https://dental-beauty-agenda.onrender.com/agendamento/cancelar`
- **Headers:** `x-api-key: <chave>` · `Content-Type: application/json`
- **Body:**
```json
{ "appointmentId": "{{appointmentId}}" }
```
- **Resposta 200:** `{ "status": "cancelled", "released": true }`

---

## 4) Horário comercial — quem atende agora (fluxo, não é ferramenta do agente)
Decisão do cliente (2026-08): **dentro do horário comercial quem atende é a recepção humana**;
**fora dele, a IA**. Réguas e follow-ups rodam sempre, independente do horário — eles não passam
por aqui.

- **Método:** `GET` · **URL:** `https://dental-beauty-agenda.onrender.com/atendimento/status`
- **Headers:** `x-api-key: <chave>`
- **Resposta 200:**
```json
{ "businessHours": true, "attendant": "recepcao", "localTime": "10:30", "weekday": 3,
  "automationsAlwaysOn": true, "horario": { "inicio": "09:00", "fim": "18:00", "dias": [1,2,3,4,5] } }
```

**Como montar no Flow Builder** (fluxo que roda ao receber mensagem, ANTES do agente responder):
```
Gatilho (mensagem recebida)
  └─ HTTP Request → GET /atendimento/status
       └─ Condição: attendant == "recepcao"
            ├─ sim → Controle de Agente: DESLIGAR  (a recepção assume; nenhuma resposta automática)
            └─ não → Controle de Agente: LIGAR     (a IA atende normalmente)
```

> Isso também é a trava contra o problema relatado pelo cliente ("a IA entrou automaticamente e
> enviou muita coisa errada"): mesmo que o agente seja reativado por engano, o fluxo o desliga
> dentro do expediente.

O horário fica em variáveis de ambiente no Render (`BUSINESS_HOURS_START`, `_END`, `_DAYS`,
`_TZ_OFFSET`) — mudar o expediente **não exige deploy de código**. Default: seg–sex 09:00–18:00 BRT.

---

## Extras disponíveis no backend (se precisar em fluxos/réguas)
| Rota | Método | Uso |
|---|---|---|
| `/atendimento/status` | GET | Quem atende agora (recepção x IA) — ver §4 |
| `/agendamento/agenda?date=AAAA-MM-DD[&to=AAAA-MM-DD]` | GET | Agendamentos do período (fonte no-show/lembrete). Retorna `{from,to,appointments[]}` |
| `/catalogo/especialidades` | GET | Lista de especialidades (id, description) |
| `/catalogo/profissionais` | GET | Lista de profissionais |
| `/pacientes/aniversariantes` | GET | Aniversariantes do dia (régua de aniversário) |
| `/health` | GET | Sem chave — status do serviço |

> Validado ao vivo em 20/07/2026: `/health` 200; com a chave, `/catalogo/especialidades` e `/agendamento/disponibilidade` retornam dados reais da Clinicorp.
