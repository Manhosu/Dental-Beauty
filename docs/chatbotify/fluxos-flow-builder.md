# Fluxos do Flow Builder (Chatbotify) — Dental Beauty

Desenho dos fluxos/automações a montar no Flow Builder. Os blocos HTTP chamam o **microserviço de agendamento** (substituir `SEU_DOMINIO`):
- `GET  /agendamento/disponibilidade?date=YYYY-MM-DD[&professionalId=]`
- `POST /agendamento/book`  → 201 confirmado · 409 vaga ocupada · 502 falha
- `POST /agendamento/cancelar` `{ appointmentId }`
- `GET  /pacientes/aniversariantes`
- `GET  /catalogo/especialidades` · `GET /catalogo/profissionais`

---

## 1. Fluxo de Agendamento (dentro do agente Lead/Recepção)
1. Agente identifica **especialidade + bairro → unidade + profissional** (regras do prompt).
2. **Bloco HTTP GET** `disponibilidade?date={{data}}` → lista de horários (`from/to/professionalId`). Filtrar pelo profissional roteado e oferecer 2–3 opções.
3. Paciente escolhe → coletar dados (nome, telefone, CPF; infantil: + responsável).
4. **Bloco HTTP POST** `book` com `{ patient, date, fromTime, toTime, dentistPersonId, specialty }`.
   - 201 → confirmar ("Agendado! ✅") e mover card do pipeline para "Agendado [especialidade]".
   - 409 → "esse horário acabou de ser ocupado", voltar ao passo 2.
   - 502 → tentar de novo / handoff.

## 2. Régua Anti No-Show (gatilho agendado)
- **T-24h** e **T-2h** antes da consulta: enviar confirmação (Sim/Não).
- Fonte dos agendamentos do dia: listagem de agendamentos da Clinicorp (endpoint a finalizar — ver pendência do parâmetro de data).
- Resposta **"Não"** → **Bloco HTTP POST** `cancelar { appointmentId }` (libera a vaga) + mover card para "Não agendado".

## 3. Réguas por procedimento (gatilho diário; disparo = "procedimento executado")
Para cada procedimento executado (status "Atendido" na Clinicorp), agendar o disparo no prazo:
| Procedimento | Prazo |
|---|---|
| Limpeza | 6 meses |
| Clareamento | 6 meses |
| Restaurações | 6 meses |
| Canal | 6 meses |
| Coroa / Prótese | 12 meses |
| Implante | 12 meses (ajustado de 6m pelo cliente em 2026-07) |
| Tratamento Periodontal | 3 meses |
| Ortodontia adulto | 6 meses |
| Invisalign | 6 meses |
| Odontopediatria | 6 meses |
| Lente de Contato / Faceta | 6 meses |

## 4. Réguas por inatividade
- **Sem retorno há 12 meses** → reengajamento.
- **Sem consulta há 6 meses** → reengajamento.

## 5. Aniversariantes (gatilho diário)
- **Bloco HTTP GET** `pacientes/aniversariantes` → para cada item, enviar felicitação pelo número **Disparos**.

## 6. Follow-up de Orçamento (número Orçamento — pipeline D0→D15)
Sequência após gerar/agendar retorno do orçamento:
- **D0** (mesmo dia) · **D1** · **D3** · **D7** · **D15** → mensagens de acompanhamento.
- Se "Orçamento Aprovado" → encerra a régua. Se "Não fechado" → classificar por especialidade (Odonto/Lentes/Ortodontia/Implante/Outros).

## 7. Follow-up de não-resposta + requalificação (Lead e Orçamento)
- Lead **enviou mensagem e não respondeu** → entra num **fluxo de mensagens** de follow-up (espaçado).
- Sem resposta após a sequência → mover para uma **etapa de requalificação** que volta a receber novos envios (campanhas) para reengajar.

## 8. Campanhas programadas (data + frase de lista, arte de pasta)
- **Gatilho Agendado** lê uma **lista** (planilha) com *data + mensagem* e a **arte** de uma **pasta/link**.
- Na data marcada, dispara pelo número **Disparos**.
- O cliente mantém a lista e a pasta de artes; o sistema só lê e envia. (Permite programar mesmo sem a arte/frase finais — vão sendo preenchidas.)

---

## Pendências técnicas (nosso lado)
- ✅ **Listagem de agendamentos por período — RESOLVIDO (2026-06-25).** O param do `/appointment/list` é **`from`/`to`** (`YYYY-MM-DD`). Exposto em **`GET /agendamento/agenda?date=YYYY-MM-DD[&to=YYYY-MM-DD]`** → `{ from, to, appointments[] }` com `id` (p/ cancelar), `patientName`, `mobilePhone`, `fromTime/toTime`, `professionalName`, `unit`. Fonte da régua de no-show. Validado em produção (14 agendamentos reais p/ 26/06). Filtra `Deleted`.
- ⚠️ **Status "atendido/CHECKOUT" p/ pós-procedimento:** o registro de `/appointment/list` **não traz um campo Status**, e `/patient/list_appointments` retornou vazio nos params testados. Confirmar com a Clinicorp como obter "procedimento executado" (campo de status, `/appointment/get` por id, ou webhooks de CHECKOUT) antes de montar as réguas de pós-procedimento/inatividade.
- Itens prontos hoje: disponibilidade, book, cancelar, **agenda (listagem)**, aniversariantes, catálogo.

## Spike Flow Builder — RESULTADO (2026-06-25)
Capacidades do Flow Builder do Chatbotify (conta Disparos):
- **Gatilhos:** `Gatilho Agendado` (via n8n; ex.: todo dia às 9h), `Gatilho HTTP` (POST externo), Trigger Asaas.
- **Blocos:** `HTTP Request` (chama APIs externas — nosso backend), `Mensagem` (envia ao usuário), `Obter Dados` (busca contatos/leads do CRM com filtros de pipeline/temperatura/status/tempo na etapa), `Validação de Resposta` (AI), `Aguardar` (com saída antecipada), `Condição`/`Case`, `Agente AI`/`Agente Analista`, `Controle de Agente`, `Definir Variável`, `Editar Contato`, `Kanban`, `Iniciar Atendimento`, `Notificação`, `Resetar/Fim`.
- ⚠️ **Não há bloco de loop/iterar lista.** Logo, réguas com destinatários vindos da **Clinicorp** (aniversário, no-show, pós-procedimento) não podem fazer N envios a partir de um único `Gatilho Agendado` que chama nosso endpoint.

### Arquitetura recomendada das réguas (casa com README §3.4)
- **Réguas Clinicorp (aniversário, no-show, pós-procedimento, inatividade):** **Cron-Engine no backend** (node-cron/BullMQ-repeat) → consulta Clinicorp (`/pacientes/aniversariantes`, `/agendamento/agenda`, etc.) → **itera a lista** → por destinatário, faz `POST` no **`Gatilho HTTP`** de um fluxo simples (`Gatilho HTTP → Mensagem`) que envia pelo número Disparos. (A iteração e as regras de prazo ficam no backend; o Flow Builder faz o envio.)
- **Réguas baseadas no CRM (follow-up de lead D0–D15, inatividade por etapa):** nativas — `Gatilho Agendado` + `Obter Dados` (filtra contatos) + `Mensagem`.
- **Validação pendente:** construir o fluxo `Gatilho HTTP → Mensagem` e confirmar que o POST dispara o envio ao telefone do payload (linchpin do envio das réguas).

### Como montar o fluxo de envio no canvas (protocolo descoberto 2026-06-26)
Os blocos da paleta usam **HTML5 drag-and-drop** com `dataTransfer.setData('application/reactflow', <tipo>)`. Tipo do **Gatilho HTTP** = `formTrigger`. Para automatizar: construir um `DataTransfer`, `setData('application/reactflow', tipo)`, e disparar `dragenter/dragover/drop` (DragEvent com esse dataTransfer) no `.react-flow__pane` na posição desejada. Conectar arestas (arrastar handle source→target) e configurar o bloco `Mensagem` (enviar p/ o telefone do payload, texto por `type`) ainda é trabalho de canvas. O fluxo deve ter **Gatilho HTTP → Mensagem**, ser ativado, e a URL do Gatilho HTTP vai pra `CHATBOTIFY_REGUA_WEBHOOK_URL` no Render + `REGUAS_ENABLED=true`.

### Status "atendido" da Clinicorp — INVESTIGADO (2026-06-26)
`/appointment/list` NÃO traz status CONFIRMED/CHECKOUT direto. O que existe por agendamento: `CategoryId` + `CategoryDescription` (texto livre, ex.: "AGENDAMENTO PENDENTE DE CONFIRMAÇÃO") + `tags` (ex.: "PAGAMENTO PENDENTE", Type "AppointmentMarker") + `ListTagsId`. `/appointment/get?id=` não respondeu JSON nos params testados. → **Pós-procedimento/inatividade dependem de confirmar com a Clinicorp/clínica qual Categoria/Tag = "atendido"**, ou habilitar webhook de evento (Gestão de Webhook da Clinicorp).
- **Resolução de paciente por telefone** antes de marcar (evita conflito de nome) — `GET /patient/get`.
- **Unidade Ipanema** na Clinicorp (API só expõe Recreio) — necessário para marcar em Ipanema.
