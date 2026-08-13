# Estado Atual do Sistema — Dental Beauty

> **Fonte de verdade para reentrar no projeto.** Atualizado em **2026-08-13**.
> Se você está retomando o contexto do zero, leia este arquivo primeiro e só depois os específicos.

---

## 1. O que é, em uma tela

Atendimento automático por WhatsApp para a **Dental Beauty / Oral Multi** (Rio — unidades **Recreio**
e **Ipanema**). O robô conversa, faz triagem por especialidade, informa **só o preço da avaliação**
(regra do CRO), **agenda direto na Clinicorp** e dispara réguas de relacionamento.

**Arquitetura C (híbrida)** — a decisão que explica tudo:

```
WhatsApp ⇄ Chatbotify (no-code: IA, prompt, CRM, handoff, mídias, automações)
                │  HTTP  (header x-api-key)
                ▼
   Backend (Render: dental-beauty-agenda.onrender.com)
        │
        ├── microserviço de agendamento (anti double-booking, lock Redis)
        ├── Cron-Engine das réguas (itera listas → "Gatilho HTTP" do Chatbotify)
        ├── horário comercial (GET /atendimento/status)
        └── webhook do discador Sonax → CRM do Chatbotify
                │  Basic Auth
                ▼
          API Clinicorp
```

O Chatbotify faz a conversa. Nosso código faz o que a plataforma **não** consegue: agendamento
atômico e **iteração de listas** (o Flow Builder não tem bloco de loop — é por isso que o
Cron-Engine existe).

---

## 2. Regras de negócio vigentes (decisões do cliente)

| Tema | Regra |
|---|---|
| **Quem atende** | **Horário comercial → recepção humana** (IA calada) · **fora do horário → IA** |
| **Réguas/follow-ups** | Rodam **sempre**, dia e noite, independente do horário |
| **Confirmação de consulta e NPS** | Saem pelo número da **Recepção** (templates Utility) |
| **Aniversário, retorno, reengajamento** | Saem pelo número de **Disparos** (templates Marketing) |
| **Preço** | Só valor de **avaliação**. Nunca preço de tratamento (CRO) |
| **Unidade** | Derivada do **nome do profissional** ("Ipanema" no nome → Ipanema; senão Recreio) |
| **Retorno pós-procedimento** | Periodontia 3m · Coroa/Prótese/Implante 12m · demais 6m |

⚠️ **Pendência com o cliente:** o **horário comercial exato** e o comportamento de **sábado/domingo**
não foram informados. O sistema está com o default **seg–sex 09:00–18:00 BRT** — ajustável só por
variável de ambiente, sem deploy de código.

---

## 3. Endpoints do backend

| Rota | Método | Uso |
|---|---|---|
| `/health` | GET | status (público) |
| `/atendimento/status` | GET | **quem atende agora** — o Flow Builder liga/desliga o agente com isso |
| `/agendamento/disponibilidade?date=&professionalId=` | GET | horários reais, com `professionalName` e `unit` |
| `/agendamento/book` | POST | **201** confirmed · **409** slot_taken · **502** failed |
| `/agendamento/cancelar` | POST | cancela e libera a vaga |
| `/agendamento/agenda?date=&to=` | GET | agendamentos do período (fonte do no-show) |
| `/pacientes/aniversariantes` | GET | régua de aniversário |
| `/catalogo/especialidades` · `/catalogo/profissionais` | GET | catálogo real |
| `/webhooks/sonax` | GET | discador (autentica por `?token=`, não por x-api-key) |

Tudo exceto `/health` e `/webhooks/sonax` exige `x-api-key: <API_KEY_SECRET>`.

### Como o Flow Builder usa o `/atendimento/status`

```
Gatilho (mensagem recebida)
   └─ HTTP Request GET /atendimento/status
        └─ Condição: attendant == "recepcao"
             ├─ sim → Controle de Agente: DESLIGAR (a recepção responde)
             └─ não → Controle de Agente: LIGAR (a IA atende)
```

Resposta: `{ businessHours, attendant: "recepcao"|"ia", localTime, weekday, automationsAlwaysOn, horario }`.

---

## 4. As 5 réguas (Cron-Engine)

Rodam **1×/dia às 12h UTC (09h BRT)**, em [src/scheduling/reguas/](../src/scheduling/reguas/).

| Régua | Gatilho | Conta de envio | Env do fluxo |
|---|---|---|---|
| Aniversário | aniversariantes do dia (separa adulto/infantil pela idade) | Disparos | `CHATBOTIFY_REGUA_FLOW` |
| No-show | agendamentos de amanhã (T-24h) | **Recepção** | `..._FLOW_NOSHOW` |
| Pós-procedimento | atendido (CHECKOUT) há 3/6/12m | Disparos | `..._FLOW_POSPROC` |
| NPS | consulta atendida ontem (T-1) | **Recepção** | `..._FLOW_NPS` |
| Inatividade | atendido há 6/12m e sem voltar desde então | Disparos | `..._FLOW_INATIVIDADE` |

**Garantias implementadas:**
- **Sem envio duplicado** — cada `(régua, paciente, dia)` é reivindicado no Redis antes do envio
  (`regua:sent:*`). Restart do processo não reenvia. Falha no envio libera a reserva para retentar.
- **Sem dia perdido** — se o serviço subir **depois** das 09h e a rotina do dia ainda não tiver
  rodado, ela roda no boot (catch-up). Resolve a hibernação/restart do Render.
- **Payload compatível com template** — o corpo leva `nome`, `numero`, `tipo`, `track`
  (adulto/infantil), `var1` (nome) e `var2` (nome da criança), além de `observacoes`.

**Estado:** dormentes (`REGUAS_ENABLED=false`, IDs de fluxo vazios).

---

## 5. Integrações externas

### Clinicorp (validada em produção)
```
base:          https://api.clinicorp.com/rest/v1     (Basic auth user:token)
subscriber_id: oralmultiedentalbeauty
business_id:   6247357829611520
code_link:     60903   ← "código de acesso" do Agendamento Online
```
Regra descoberta: enviar `Dentist_PersonId` **ou** `ScheduleToId`, nunca os dois (400).
Paciente com nome repetido exige `Patient_PersonId` → resolvido buscando por telefone antes.

### Chatbotify
Agente na conta **`disparos_`** (a conta "Disparos" antiga foi excluída em 19/07/2026 e levou junto
o agente e as automações — o prompt reconstruído está em
[chatbotify/prompt-agente-ATUAL.txt](chatbotify/prompt-agente-ATUAL.txt), 20 seções).
Modelo: **OpenAI gpt-4.1**. CRM com 3 pipelines.

### Sonax (discador)
Contratado. Painel: `pabxcloud.sonax.net.br`. Webhook GET com query params, em
[integracao-sonax-discador.md](integracao-sonax-discador.md).
**Construído e testado no código, mas ainda não provado com ligação real.**

---

## 6. O que falta para o go-live

| # | Item | Depende de |
|---|---|---|
| 1 | Informar o **horário comercial exato** + sábado/domingo | **cliente** |
| 2 | Montar o fluxo `Gatilho HTTP → Mensagem` no Chatbotify e confirmar que **dispara template com variáveis** | nós — **destrava as 5 réguas** |
| 3 | Preencher no Render os IDs de fluxo + `REGUAS_ENABLED=true` | nós (após 2) |
| 4 | Montar o gate de horário no Flow Builder (`/atendimento/status`) | nós |
| 5 | Acender o Sonax: 3 vars no Render + apontar webhook no painel | **cliente** (código do e-mail) |
| 6 | 1 ligação real de teste no Sonax | cliente |
| 7 | Reconectar o número Disparos | cliente |
| 8 | Teste de ponta a ponta em conversa **limpa** → go-live | ambos |

### Variáveis a preencher no Render
```
BUSINESS_HOURS_START / _END / _DAYS          # após o cliente informar
REGUAS_ENABLED=true
CHATBOTIFY_REGUA_WEBHOOK_URL / _ACCOUNT_ID / _TOKEN            # conta Disparos
CHATBOTIFY_REGUA_RECEPCAO_WEBHOOK_URL / _ACCOUNT_ID / _TOKEN   # conta Recepção
CHATBOTIFY_REGUA_FLOW / _NOSHOW / _POSPROC / _NPS / _INATIVIDADE
CHATBOTIFY_CRM_ACCOUNT_ID / CHATBOTIFY_CRM_API_TOKEN / SONAX_WEBHOOK_TOKEN
```

---

## 7. Riscos conhecidos

1. **Réguas de CHECKOUT nunca validadas com dado real.** Pós-procedimento, NPS e inatividade
   dependem de `StatusId` vir no `/appointment/list`. Se não vier, retornam **0 em silêncio**.
   Conferir com um dia real antes de ligar.
2. **Trilha infantil sem nome do responsável.** Os templates infantis pedem `{{1}}` responsável +
   `{{2}}` criança, mas os endpoints da Clinicorp usados hoje só expõem o nome do paciente. A régua
   manda o nome da criança nas duas variáveis — resolver antes de ativar a trilha infantil.
3. **`midias-followup/` é gitignored** — as 13 mídias existem só na máquina local. Manter backup
   fora do PC (já se perdeu contexto uma vez).
4. **Credenciais que circularam em texto puro** e seguem sem rotação: token Clinicorp, senha do
   Chatbotify, chave OpenAI `sk-proj-...`, senha do Sonax.

---

## 8. Mapa da documentação

| Preciso de… | Arquivo |
|---|---|
| Prompt do agente em produção | [chatbotify/prompt-agente-ATUAL.txt](chatbotify/prompt-agente-ATUAL.txt) |
| Config das requisições HTTP do agente | [chatbotify/requisicoes-http-agente.md](chatbotify/requisicoes-http-agente.md) |
| Regras de negócio do cliente | [superpowers/spikes/blueprint-agente.md](superpowers/spikes/blueprint-agente.md) |
| Textos aprovados das réguas | [textos-reguas-APROVADO.md](textos-reguas-APROVADO.md) |
| Textos dos 25 follow-ups | [plano-followup-leads.md](plano-followup-leads.md) |
| Templates para a Meta | [kit-templates-reguas.md](kit-templates-reguas.md) · [kit-templates-followup.md](kit-templates-followup.md) |
| Funis e campos do CRM | [specs-funil-formularios.md](specs-funil-formularios.md) |
| API da Clinicorp | [superpowers/spikes/2026-06-13-spike1-clinicorp.md](superpowers/spikes/2026-06-13-spike1-clinicorp.md) |
| Discador Sonax | [integracao-sonax-discador.md](integracao-sonax-discador.md) |
| Deploy | [DEPLOY.md](DEPLOY.md) |
| Guia para o cliente | [GUIA-SISTEMA-DENTAL-BEAUTY.md](GUIA-SISTEMA-DENTAL-BEAUTY.md) |
