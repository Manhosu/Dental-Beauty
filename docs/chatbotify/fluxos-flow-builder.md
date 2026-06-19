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
| Implante | 6 meses |
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
- **Listagem de agendamentos por período** (fonte das réguas 2/3/4 e inatividade): confirmar o nome do parâmetro de data do `/appointment/list` da Clinicorp (e expor um endpoint `GET /agendamentos?date=`). Itens prontos hoje: disponibilidade, book, cancelar, aniversariantes, catálogo.
- **Resolução de paciente por telefone** antes de marcar (evita conflito de nome) — `GET /patient/get`.
- **Unidade Ipanema** na Clinicorp (API só expõe Recreio) — necessário para marcar em Ipanema.
