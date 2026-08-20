# Migração Chatbotify → GoHighLevel

> Iniciada em 2026-08-19. Acompanha [ESTADO-ATUAL.md](ESTADO-ATUAL.md).

## Conta

| Item | Valor |
|---|---|
| Plataforma | GoHighLevel **white-label "Black Eagle" / BLACK CRM** (revenda, não GHL direto) |
| Login | `financeiro@dentalbeauty.com.br` (2FA por e-mail do cliente) |
| Subconta única | `ZCMG4O9K8UhFYmvx4i4b` |
| API | v2 (`https://services.leadconnectorhq.com`), header `Version: 2021-07-28` |
| Token | Private Integration `pit-…` — **só no `.env` local**, nunca no git |

**Escopos concedidos ao token:** `contacts.readonly/write` · `opportunities.readonly/write` ·
`conversations.readonly/write` · `conversations/message.write` · `locations/customFields.readonly/write` ·
`locations.readonly`.

> ⚠️ **Criação de pipeline NÃO é permitida por Private Integration** (401 "token is not authorized
> for this scope"). Leitura funciona. Funis e etapas se criam pelo painel.

## ✅ Feito

- Private Integration criada e token validado (200 em `GET /opportunities/pipelines`)
- **Pipeline "Atendimento Lead" — 17 etapas**, idêntico ao do Chatbotify
- **Pipeline "Orçamento" — 8 etapas** (Agendado Retorno · D0 · D1 · D3 · D7 · D15 · Orçamento Aprovado · Não fechado)
- IDs de pipeline e de cada etapa salvos em [`ghl-ids.json`](ghl-ids.json)

## 🔴 Bloqueio: módulo WhatsApp não contratado

A área de WhatsApp da conta mostra a tela de venda (**"PAGAR $20 E ASSINAR"**). Sem esse módulo:
- não dá para conectar a WABA do cliente (que existe e tem os 50 templates aprovados);
- não dá para conferir se os templates vieram junto;
- nenhuma automação de envio pode ser montada ou testada.

O cliente precisa assinar em **Configurações → WhatsApp**. Só depois disso a camada de mensagens anda.

## ✅ Feito (2ª rodada)

- **25 campos personalizados** criados via API (`POST /locations/{id}/customFields`) — cobrem os
  três formulários da spec. Mapa nome→id/fieldKey em [`ghl-custom-fields.json`](ghl-custom-fields.json).
  Script idempotente reutilizável: [`scripts/ghl-custom-fields.mjs`](../scripts/ghl-custom-fields.mjs).
- **`GoHighLevelCrmClient`** (`src/integrations/ghl/client.ts`) — substitui o `ChatbotifyCrmClient`
  no webhook do Sonax. A interface `SonaxCrmPort` não mudou; só a implementação. 7 testes.
- **`createGhlDispatcher`** (`src/scheduling/reguas/ghlDispatcher.ts`) — entrega das réguas pelo
  Inbound Webhook do GHL. 7 testes.
- **Fiação com coexistência:** o `main.ts` escolhe GHL quando configurado e cai no Chatbotify caso
  contrário — dá para virar a chave por variável de ambiente, sem deploy de código.

### Payload enviado ao workflow (GHL)
Diferente do Chatbotify, o corpo é **JSON livre** — o workflow mapeia o que quiser:
`phone` · `name` · `first_name` · `tipo` · `track` · `nome_crianca` · `observacoes` ·
`appointment_id` · `data` · `hora` · `profissional` · `unidade` · `procedimento` · `meses`

> `first_name` existe porque os textos aprovados usam só o primeiro nome ("Oi, [Nome]!").

## Pendente

1. Módulo WhatsApp + conexão da WABA + conferência dos 50 templates *(depende do cliente)*
2. ~50 campos personalizados dos formulários (Atendimento Lead, Orçamento, Recepção)
3. 25 workflows de follow-up (D1/D2/D4/D7/D10 por especialidade)
4. Workflows das 5 réguas, disparados pelo nosso Cron-Engine via inbound webhook
5. Agente de IA (portar o prompt de 16k + 13 mídias + ações HTTP da Clinicorp)
6. `GoHighLevelCrmClient` no backend, substituindo o `ChatbotifyCrmClient` do Sonax
7. Adaptador de saída das réguas (do "Gatilho HTTP" para o inbound webhook do GHL)

## Notas técnicas

- **Sonax:** a `SonaxCrmPort` não muda — só a implementação. Contrato confirmado na doc oficial:
  `POST /contacts/upsert` (upsert por telefone) e `POST /contacts/{id}/notes`.
- **Dialer nativo:** a conta tem "Discador" (StevoVoice) embutido. Não muda nada agora (o Sonax já
  foi contratado), mas é alternativa futura.
- **Suporte:** passa pela revenda Black Eagle, não pelo GHL. O cliente saiu do Chatbotify por
  suporte ruim — vale ele testar esse canal antes de o sistema depender dele.
