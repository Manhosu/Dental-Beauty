# Spike 2 — Mapeamento da conta Chatbotify

**Status:** 🔎 PARCIALMENTE MAPEADO (acesso feito via navegador em 2026-06-15). Falta: conectar números (precisa dos celulares) e decidir a arquitetura.
**Plataforma:** **chatbotify.com.br** (login em `/login`). É uma **plataforma no-code completa de agentes de IA para WhatsApp** (white-label para agências), NÃO um gateway simples.
**Conta:** `financeiro@dentalbeauty.com.br`. Estado: **plano gratuito, 0 contas WhatsApp, 0 agentes, 0 módulos ativos** — totalmente zerada.

> ⚠️ Recomendado **rotacionar a senha** (trafegou em texto puro).

## Descoberta central (muda a arquitetura)

O Chatbotify já faz nativamente quase todo o escopo do README:
- **Agentes de IA** (NLP/triagem) com base de conhecimento/Documentos (Google File Search/Gemini).
- **Ferramentas do Agente** prontas: `🔔 Notificação / Atendimento Humano` (= **handoff**), `⏸️ Desabilitar Contato` (= **supressão do bot**), `🎂 Salvar Aniversário` (= régua aniversário), `📍 Calcular Distância`, `🧠 Think`, busca em documentos.
- **Flow Builder** com blocos de automação: `⏰ Gatilho Agendado` (= **réguas/cron**: follow-up, no-show), `🔍 Obter Dados` (CRM), `🧠 Agente Analista`, `✏️ Editar Contato` — e (a confirmar) bloco de **requisição HTTP/webhook** para chamar APIs externas.
- **Agendamento Público** nativo, inclusive **vagas simultâneas por horário** (controle de concorrência próprio).
- **CRM** (pipeline/kanban), **ERP próprio** (PDV/produtos — varejo, NÃO é o Clinicorp), Marketing, White-label.
- Conexão WhatsApp via **Uazapi** (não-oficial, QR/pareamento) **ou Meta Cloud API** (oficial).

**Implicação:** a integração com a **Clinicorp** (disponibilidade/agendamento em tempo real) provavelmente é feita por **bloco HTTP do Flow Builder** ou **ferramenta custom do agente** chamando a API da Clinicorp — não exige reconstruir triagem/handoff/réguas do zero. Ver decisão de arquitetura no fim.

## Números de WhatsApp a conectar (nenhum conectado ainda)

| Número | Papel (`WhatsappRole`) | Instance ID (preencher) |
|---|---|---|
| (21) 99128-2761 | `reception` | |
| (21) 98121-7082 | `lead` | |
| (21) 92000-2328 | `dispatch` | |
| (21) 97552-0232 | `quote` | |

## Checklist de investigação

- [ ] **Webhook de entrada:** formato real do payload de mensagem recebida (campos de remetente, número de destino, tipo, texto, mídia). → validar/ajustar `src/http/webhooks/chatbotify.schema.ts`.
- [ ] **API de disparo:** endpoint para enviar mensagem de texto e mídia; autenticação; identificação do número de origem por papel.
- [ ] **Supressão/retomada do bot:** mecanismo para silenciar o robô durante handoff humano e retomá-lo ao concluir o ticket.
- [ ] **Mapa número↔instância:** registrar os instance IDs para alimentar o `NumberRegistry`.
- [ ] **STT de áudio:** o Chatbotify transcreve áudio nativamente? Se **não**, registrar necessidade de Whisper-class (Groq/OpenAI) na Fase 2.
- [ ] **Ferramentas/assinaturas necessárias:** que plano/recurso habilita API+webhook (cliente topou assinar).

## Achados (mapeamento via navegador — 2026-06-15)

### Conexão de números (CANAIS → Contas de WhatsApp)
- 0 contas conectadas. Botão "Nova Conta de Whatsapp" → modal "Escolha o tipo de conexão":
  - **API não oficial (Uazapi):** QR Code ou código de pareamento (coexistência no mesmo número).
  - **API oficial (Meta):** aprovar o app na conta WhatsApp (Meta Cloud API).
- **Ambas exigem o aparelho/conta física → precisa do cliente** (escanear QR ou aprovar na Meta). Produção provavelmente exige **módulo pago** (conta gratuita tem limite).

### Webhook de entrada / API de disparo
- Em `/settings` há só perfil/senha/dispositivos — **sem** painel de API/webhook do usuário ali.
- A integração externa vive no **Flow Builder** (blocos) e nas **Ferramentas do Agente**. _(Falta confirmar: existe bloco "HTTP Request"/"Webhook" para sair e/ou entrar? Abrir `/flow-builder` com uma conta criada.)_
- Não há (aparentemente) um webhook genérico "encaminhe toda mensagem para minha URL" exposto na UI — a lógica roda dentro da própria plataforma.

### Supressão do bot (handoff)
- Nativo: ferramenta do agente **`🔔 Notificação / Atendimento Humano`** (transfere para humano) + **`⏸️ Desabilitar Contato`** (desativa o agente para um contato). Cobre o requisito de handoff/supressão do README sem código.

### STT de áudio
- _(A confirmar na config do agente — a plataforma processa áudio/voz; tem inclusive ligações via Meta. Provável STT nativo. Verificar ao criar um agente.)_

### Réguas / campanhas
- Nativo via **Flow Builder → `⏰ Gatilho Agendado`** + `🔍 Obter Dados` (CRM) + `✏️ Editar Contato`. Cobre follow-up, no-show e aniversário sem cron próprio.

### Ferramentas a assinar
- _(A confirmar em SISTEMA → Assinatura quais módulos pagos habilitam: contas WhatsApp em produção, Agendamento, ERP/integrações. Cliente topou assinar.)_

## Ajustes necessários
- [ ] `chatbotify.schema.ts` — alinhar ao payload real
- [ ] `src/integrations/chatbotify/types.ts` — alinhar `OutboundMessage`/`ChatbotifyClient` à API real

## Decisão de arquitetura (a definir com o cliente/responsável)

Como o Chatbotify já entrega triagem/IA, handoff, supressão, réguas e agendamento nativos, há 3 caminhos:

- **A — No-code no Chatbotify:** configurar tudo na plataforma; chamar a API da Clinicorp via bloco HTTP do Flow Builder / ferramenta do agente. Nosso backend Node some (ou vira nada). Mais rápido/barato.
- **B — Backend custom (plano original):** Chatbotify só como transporte WhatsApp, encaminhando mensagens ao nosso Node, que faz tudo. Mais controle, mas reconstrói o que a plataforma já faz e depende de a plataforma expor webhook de entrada — **aparentemente não expõe** isso de forma genérica.
- **C — Híbrido (recomendado):** Chatbotify cuida da conversa/IA/handoff/réguas nativamente; nosso backend vira um **microserviço enxuto de integração Clinicorp** (disponibilidade + agendamento atômico anti double-booking — o `SchedulingEngine`/`ClinicorpClient` que já construímos), chamado pelo Flow Builder via HTTP. Preserva o trabalho da Fase 1 e usa a plataforma para o resto.

> O caminho B parece inviável pela ausência de webhook de entrada genérico. A escolha real é **A vs C**, e depende de o Flow Builder conseguir garantir o booking atômico sozinho (se não, C).

## Próximos passos
1. **Cliente:** conectar 1 número (QR/Meta) para destravar a criação de agente e do Flow Builder.
2. **Confirmar** no Flow Builder: existe bloco HTTP Request (saída) para chamar a Clinicorp? Como ele trata a resposta?
3. **Definir A vs C** e então escrever o plano (config no Chatbotify + microserviço Clinicorp, se C).
