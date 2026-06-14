# Spike 2 — Mapeamento da conta Chatbotify

**Status:** ⏳ PENDENTE — requer acesso à conta e (provavelmente) assinatura de plano que habilite API/webhook.
**Conta:** `financeiro@dentalbeauty.com.br` (senha no cofre, não aqui). A conta está **zerada** — nada configurado.

> ⚠️ Recomendado **rotacionar a senha** após o setup (trafegou em texto puro).

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

## Achados

### Formato do webhook de entrada
_(preencher — comparar com `inboundMessageSchema`)_

### API de disparo (saída)
_(preencher)_

### Supressão do bot (handoff)
_(preencher)_

### STT de áudio
_(preencher: nativo? se não, provedor recomendado)_

### Ferramentas a assinar
_(preencher e informar o cliente)_

## Ajustes necessários
- [ ] `chatbotify.schema.ts` — alinhar ao payload real
- [ ] `src/integrations/chatbotify/types.ts` — alinhar `OutboundMessage`/`ChatbotifyClient` à API real

## Próximo passo
Escrever o plano de implementação HTTP do `ChatbotifyClient` e o wiring de produção (webhook → fila → worker → roteamento por papel).
