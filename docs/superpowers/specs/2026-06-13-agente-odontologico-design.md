# Design — Agente Inteligente de Atendimento Odontológico

**Projeto:** Dental Beauty / Oral Multi — Integração Chatbotify ⇄ Clinicorp
**Data:** 2026-06-13
**Status:** Design aprovado — Fase 0 implementada. **Revisado para Arquitetura C em 2026-06-15** (ver banner abaixo).

---

## ⚠️ Revisão 2026-06-15 — Arquitetura C (híbrida)

Os spikes revelaram que o **Chatbotify (chatbotify.com.br) é uma plataforma no-code completa** (agentes de IA, base de conhecimento, handoff/supressão nativos, Flow Builder com cron/HTTP, agendamento e CRM). Logo, **não construímos do zero** triagem/NLP, handoff, mídias nem réguas — isso é configurado na plataforma.

**Novo papel do nosso backend:** um **microserviço enxuto de integração Clinicorp**, chamado pelo **Flow Builder do Chatbotify** via HTTP, que garante o **agendamento atômico anti double-booking** (o `SchedulingEngine` + `ClinicorpClient` já construídos na Fase 0).

**O que muda neste design:**
- Seções 3.1 (IA), 3.3 (handoff) e 3.4 (réguas) passam a ser **configuração no Chatbotify**, não código nosso.
- Seção 3.2 (agendamento síncrono) permanece **como nosso microserviço**.
- Componentes `ConversationOrchestrator`, `IntentEngine`, `KnowledgeBase`, `HandoffManager`, `CronEngine`, worker de mensagens e webhook de entrada **saem do nosso escopo** (ficam na plataforma).

**Fatos da integração Clinicorp (spike 1):** base `https://api.clinicorp.com/rest/v1`, **Basic auth** (user+token), `subscriber_id=oralmultiedentalbeauty`, `Clinic_BusinessId=6247357829611520`. Endpoints: disponibilidade (`/appointment/get_avaliable_times_calendar` + código de acesso), criação (`POST /appointment/create_appointment_by_api`), cancelamento (`/appointment/cancel_appointment`). Detalhes em [spikes/2026-06-13-spike1-clinicorp.md](../spikes/2026-06-13-spike1-clinicorp.md).

**Pendência do cliente:** habilitar/obter o **código de acesso do Agendamento Online** na Clinicorp (necessário para consultar disponibilidade).

> O restante deste documento descreve o plano original (backend completo). Mantido como referência histórica; o escopo ativo é o microserviço acima + a configuração no Chatbotify.

---

## 1. Objetivo e escopo

Construir a camada de software (Full Code: **TypeScript / Node.js**) que atua como inteligência central entre a plataforma de atendimento **Chatbotify** (WhatsApp Business) e o ERP clínico **Clinicorp** (API pública). O sistema automatiza:

1. Triagem conversacional com IA (texto e áudio) e entrega de mídias.
2. Agendamento síncrono em tempo real com mitigação de double-booking.
3. Handoff estruturado para atendente humano (CRC).
4. Réguas de relacionamento e campanhas (Cron-Engine).

Este documento é o **plano ponta a ponta** (arquitetura dos 4 subsistemas + roadmap). Cada fase recebe depois seu próprio plano de implementação detalhado, começando por **Fase 0 + Fase 1**.

### Fora de escopo (por ora)
- Painel administrativo web (Fase 4, opcional).
- Treinamento/fine-tuning de modelo próprio de IA (usaremos modelos gerenciados).
- Migração de dados históricos da clínica.

---

## 2. Recursos e credenciais (fornecidos pelo cliente)

| Recurso | Detalhe | Observação de segurança |
|---|---|---|
| Clinicorp API | Doc: `https://sistema.clinicorp.com/api-docs/` · Usuário API: `oralmultiedentalbeautyoralmulti` · Token fornecido · OAuth2 | **Token trafegou em texto puro — rotacionar após setup.** Nunca commitar. |
| Clinicorp Webhooks | "Gestão de Webhook" disponível para autorizar acessos / receber eventos | Avaliar push de eventos vs polling no spike |
| Chatbotify | Login `financeiro@dentalbeauty.com.br` · **conta do zero, nada configurado** | Senha trafegou em texto puro — **rotacionar**. Cliente topa assinar ferramentas necessárias |
| WhatsApp (4 números) | Recepção `(21) 99128-2761` · Atendimento lead `(21) 98121-7082` · Disparos `(21) 92000-2328` · Orçamento `(21) 97552-0232` | **Nenhum conectado ao Chatbotify ainda** |
| Base de conhecimento | Google Drive (doc de treinamento da IA + tabela de preços; imagens/vídeos pendentes) | Fonte de mídias e preços para a KB |

**Premissa crítica:** todo segredo vive em `.env` / secret manager, jamais no repositório. `.gitignore` cobre `.env*` desde o primeiro commit.

---

## 3. Decisões de arquitetura

### 3.1. Topologia de runtime — **Serviço Fastify + Worker**
- **API Gateway (Fastify, TS):** escuta webhooks do Chatbotify e da Clinicorp; responde rápido (ack) e enfileira o trabalho.
- **Worker (BullMQ + Redis):** processa filas de mensagens, executa orquestração pesada e roda os Cron Jobs das réguas.
- Deploy na VPS dedicada (PM2 ou systemd para os dois processos; Docker Compose opcional).
- **Por quê (vs Next.js puro do README):** API routes do Next.js são efêmeras e ruins para workers de fila e cron de longa duração. Next.js fica reservado para um painel admin opcional (Fase 4).

### 3.2. Persistência
- **Postgres** (Supabase ou self-hosted): estado de conversa (FSM), idempotência de webhooks, estado de handoff, agendamentos espelhados, dedup de jobs, **audit log**.
- **Redis:** filas BullMQ, cache de disponibilidade/KB e **lock atômico anti double-booking** (`SET NX` / Redlock).

### 3.3. Camada de IA (atrás de interfaces trocáveis)
- **NLP (intenção + extração de entidades):** **Claude** (Haiku/Sonnet 4.5) via *tool calling* / structured output → JSON validado por Zod. Forte em PT-BR e barato para roteamento.
- **Áudio → texto (STT):** Whisper-class (**Groq `whisper-large-v3`** ou OpenAI). **Confirmar no spike se o Chatbotify já transcreve áudio** — se sim, dispensa este componente.
- Interfaces `LLMProvider` e `Transcriber` isolam o fornecedor da lógica de negócio.

### 3.4. Roteamento multi-número
- **Registro número↔papel** (config + tabela): mapeia cada número de WhatsApp ao seu fluxo (Recepção / Lead / Disparos / Orçamento).
- Webhook de entrada é roteado pelo número de destino; cada disparo de saída usa o número correto.

---

## 4. Arquitetura macro (fluxo ponta a ponta)

```
WhatsApp ⇄ Chatbotify ──webhook──▶ [Fastify: Webhook Gateway]
                                      │  Zod valida · idempotência · máscara LGPD no log · ack rápido
                                      ▼  enfileira
                          [Worker: Orquestrador de Conversa (FSM)]
                          ├─▶ IA: intenção + entidades (Claude) ── áudio→STT (Groq/OpenAI)
                          ├─▶ Base de Conhecimento (mídias / preços do Drive)
                          ├─▶ Motor de Agendamento ──▶ Clinicorp API (OAuth2)
                          │       └─ lock atômico Redis (anti double-booking)
                          └─▶ Handoff CRC (escala · preserva contexto · suprime bot)

[Worker: Cron-Engine] ── polling diário Clinicorp (ou webhook push) ──▶ disparos via Chatbotify
  ├─ Follow-up limpeza (T+6 meses)
  ├─ Anti no-show (T-24h / T-2h) → resposta "Não" libera vaga síncrona na Clinicorp
  ├─ Aniversariantes (diário)
  └─ Campanhas segmentadas por histórico de procedimentos

Compartilhado: ClinicorpClient (OAuth2 · retry exponencial · rate-limit) · ChatbotifyClient
Cross-cutting: Logger c/ máscara LGPD · Config/Secrets · Audit DB · Idempotência
```

---

## 5. Componentes (unidades com propósito único)

| Componente | O que faz | Depende de |
|---|---|---|
| `WebhookGateway` (Fastify) | Recebe/valida (Zod) webhooks, garante idempotência, enfileira | Redis/BullMQ, Logger |
| `ClinicorpClient` | Wrapper tipado da API (auth OAuth2, disponibilidade, agendamento, paciente, procedimentos), retry exponencial + rate-limit | Config/Secrets |
| `ChatbotifyClient` | Envio de mensagens/mídias, supressão do bot, leitura de contexto | Config/Secrets |
| `NumberRegistry` | Mapeia número↔papel↔fluxo de entrada/saída | Config |
| `ConversationOrchestrator` (FSM) | Estado da conversa, decide próximo passo | IA, Agendamento, Handoff, KB |
| `IntentEngine` | Classifica intenção + extrai entidades (nome, especialidade) | `LLMProvider`, `Transcriber` |
| `KnowledgeBase` | Serve preços e mídias (ingestão do Drive) | Storage |
| `SchedulingEngine` | Disponibilidade, lock atômico, confirmação pós-200/201 | `ClinicorpClient`, Redis |
| `HandoffManager` | Gatilhos de escalação, preserva contexto, suprime bot | `ChatbotifyClient`, DB |
| `CronEngine` | Jobs das réguas (limpeza, no-show, aniversário, campanhas) | `ClinicorpClient`, `ChatbotifyClient`, DB |
| `AuditLog` | Registro estruturado mascarado de eventos | DB, Logger |

---

## 6. Fluxos-chave e tratamento de erros

### 6.1. Agendamento síncrono (anti double-booking)
1. IA identifica especialidade/profissional/unidade desejados.
2. `SchedulingEngine` consulta disponibilidade na Clinicorp (cache curto em Redis).
3. Usuário escolhe horário → **adquire lock Redis** (`SET NX` com TTL) para `{profissional+slot}`.
4. Registra agendamento na Clinicorp. **Só confirma no WhatsApp após `HTTP 200/201`.**
5. Falha/timeout → libera lock, informa indisponibilidade, reoferece grade. Lock expira por TTL se o processo morrer.

### 6.2. Anti no-show
- T-24h e T-2h: disparo pedindo confirmação (Sim/Não).
- Resposta "Não" → **libera a vaga de forma síncrona na Clinicorp** e registra no audit log.

### 6.3. Handoff
- Gatilhos: solicitação complexa, objeção de pagamento agressiva, pedido explícito.
- Preserva resumo da triagem + procedimento de interesse + dados do lead no painel do Chatbotify.
- **Suprime o bot** até o ticket ser marcado como concluído pelo atendente.

### 6.4. Resiliência (transversal)
- **Retry exponencial** com jitter em instabilidade/rate-limit da Clinicorp.
- **Idempotência:** chave por `event_id` do webhook; reprocessamento não duplica ações.
- **Circuit breaker** leve no `ClinicorpClient` para evitar tempestade em outage.
- Erros centralizados (`try/catch` em middleware) com classificação (retryable vs fatal).

### 6.5. LGPD
- **Mascaramento de dados sensíveis** (nome, telefone, CPF) em todos os logs.
- Segredos fora do repo; rotação recomendada das credenciais fornecidas.

---

## 7. Roadmap faseado (ordem por risco e dependência)

### Fase 0 — Fundação & Spikes *(destrava tudo)*
- Repo, TS, lint/format, estrutura de pastas, `.gitignore` (cobre `.env*`).
- Esqueleto Fastify + worker BullMQ; Config/Secrets; Logger com máscara LGPD; util de retry exponencial; middleware de erro central + validação Zod.
- `ClinicorpClient` e `ChatbotifyClient` tipados; `NumberRegistry`.
- **Spike 1 (Clinicorp):** autenticar com o token, validar endpoints reais de disponibilidade/agendamento/paciente; mapear schema real → ajustar tipos.
- **Spike 2 (Chatbotify):** inspecionar a conta, mapear webhook de entrada, API de disparo de mensagens/mídias e mecanismo de supressão do bot; conectar os 4 números.
- **Spike 3 (Clinicorp Webhooks):** avaliar push de eventos vs polling para o Cron-Engine.

### Fase 1 — Motor de Agendamento Síncrono *(núcleo de valor, maior risco técnico)*
- Consulta de disponibilidade (profissional/unidade/especialidade).
- Lock atômico de horário + confirmação pós-200/201.
- Testes de integração contra a Clinicorp. **Atenção:** o acesso fornecido é de produção — confirmar no Spike 1 se existe ambiente de teste; caso não, usar dados de teste reversíveis (paciente/horário descartável) e cancelar após o teste.

### Fase 2 — IA Conversacional + Handoff CRC
- FSM de conversa; `IntentEngine` (intenção + entidades nome/especialidade); STT de áudio.
- `KnowledgeBase` (ingestão Drive: preços + mídias) e entrega dinâmica de mídias.
- `HandoffManager`: escalação, preservação de contexto, supressão do bot.

### Fase 3 — Cron-Engine (Réguas)
- Follow-up limpeza (T+6 meses), anti no-show (T-24h/T-2h) com liberação síncrona de vaga, aniversariantes, campanhas segmentadas por histórico.
- Usa número de "Disparos"; templates de mensagem; dedup de jobs.

### Fase 4 — Painel admin (opcional)
- Next.js para visualizar agendamentos, logs e falhas de sincronização.

**Transversal em todas as fases:** máscara LGPD · retry exponencial + rate-limit · idempotência · testes (unit nos motores, integração nos clients).

---

## 8. Estratégia de testes
- **Unit:** `IntentEngine` (mock LLM), `SchedulingEngine` (mock client + lock), util de retry, máscara de logs.
- **Integração:** `ClinicorpClient` e `ChatbotifyClient` contra os ambientes reais (com dados de teste reversíveis quando não houver sandbox).
- **E2E (Fase 2+):** webhook simulado → orquestração → agendamento mockado.
- **Contrato:** validar payloads de webhook com Zod (falha cedo em mudança de schema).

---

## 9. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| API Chatbotify sem doc pública | Bloqueia entrada/saída | Spike 2 mapeia a conta real antes de codar o fluxo |
| Schema real da Clinicorp difere da suposição | Retrabalho no agendamento | Spike 1 valida endpoints antes da Fase 1 |
| Double-booking sob concorrência | Erro de negócio grave | Lock atômico Redis + confirmação só pós-200/201 |
| Credenciais expostas em texto puro | Segurança/LGPD | Secret manager + rotação das credenciais |
| Áudio em PT-BR | Triagem falha | STT Whisper-class; confirmar STT nativo do Chatbotify |
| Rate-limit Clinicorp | Falhas intermitentes | Retry exponencial + circuit breaker + cache |

---

## 10. Próximo passo
Detalhar **Fase 0 + Fase 1** em um plano de implementação (skill `writing-plans`).
