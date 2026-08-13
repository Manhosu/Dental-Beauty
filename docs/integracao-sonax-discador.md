# Integração Discador Sonax → CRM Chatbotify

Objetivo: quando o discador **Sonax** atende/encerra uma ligação de campanha, o nosso backend
recebe o evento e **registra a ligação no contato** do CRM Chatbotify (acha/cria o paciente pelo
telefone, grava status/duração/link da gravação). Assim a equipe vê no CRM quem foi ligado e o
resultado, e pode dar sequência no WhatsApp.

## Como o Sonax chama a gente
O Sonax faz um **GET** na URL configurada no painel dele, nos eventos de **atendimento** e
**desligamento**, com estes query params (contrato deles):

```
GET https://dental-beauty-agenda.onrender.com/webhooks/sonax
    ?ID_CHAMADA=<>&ID_CHAMADA_ORIGINADOR=<>&RAMAL=<>&ALIASRAMAL=<>
    &NUMERO=<>&NUMERO_REC=<>&DATA_INICIO=<>&DATA_FIM=<>
    &STATUS_CHAMADA=<>&STATUS_ATENDIMENTO=<>&DURACAO_CHAMADA=<>&URL_GRAVACAO=<>
    &token=<SONAX_WEBHOOK_TOKEN>
```

- **`NUMERO`** = telefone do paciente (chave pra achar/criar o contato).
- **`DATA_FIM`** preenchida ⇒ evento de **desligamento** (senão, atendimento).
- **`token`** = segredo nosso, adicionado ao final da URL no painel Sonax (autenticação — o Sonax
  só manda query params, então NÃO usamos `x-api-key` aqui; a rota é exceção no server).

## O que o backend faz
1. Valida o `token`. Params inválidos → 400; token errado → 401.
2. Normaliza o evento (`normalizeSonaxEvent`).
3. `upsertContactWithNote(NUMERO, nota)` — **uma chamada só**: a API do Chatbotify faz upsert por
   `phone_number` (cria se novo, atualiza se já existe) e responde 200 sem corpo. A nota fica assim:
   `[Ligação Sonax] encerrada · status: ATENDIDA · duração: 200s · gravação: https://… · id: C1`
5. Responde **200 sempre** (mesmo em falha de CRM, pra não gerar retry-storm) — falhas ficam no log.

> Movimentar etapa do funil ao atender/encerrar ficou de fora por ora (as etapas de ligação ainda
> não foram definidas com o cliente). Fácil de adicionar depois no `handleSonaxCall`.

## Arquivos
- `src/integrations/sonax/sonax.ts` — schema (zod), normalização, `SonaxCrmPort`, `handleSonaxCall`, `buildCallNote`.
- `src/integrations/chatbotify/crmClient.ts` — `ChatbotifyCrmClient` (contatos get/post/patch; headers `id` + `api_token`).
- `src/http/routes/sonax.ts` — rota `GET /webhooks/sonax`.
- `src/http/server.ts` — registra a rota (se configurada) + exceção do X-Api-Key pra `/webhooks/sonax`.
- Testes: `tests/integrations/sonax/sonax.test.ts`, `tests/http/sonax.route.test.ts` (12 testes).

## Ativação (quando fechar a contratação do Sonax)
1. Preencher no Render (serviço `dental-beauty-agenda`):
   - `CHATBOTIFY_CRM_ACCOUNT_ID` = UUID da conta WhatsApp (aba **API** do agente no Chatbotify → header `id`)
   - `CHATBOTIFY_CRM_API_TOKEN` = `api_token` (mesma aba API)
   - `SONAX_WEBHOOK_TOKEN` = um segredo qualquer (ex.: gerar um hex)
   - (`CHATBOTIFY_CRM_API_BASE` já tem default)
2. No painel do **Sonax**, configurar a URL do webhook de atendimento e desligamento apontando para
   `https://dental-beauty-agenda.onrender.com/webhooks/sonax?...&token=<SONAX_WEBHOOK_TOKEN>`.
3. Testar com o `webhook.site` (como a Sonax sugeriu) e depois com a nossa URL real.

## ✅ Contrato do CRM confirmado (2026-08-03)
`POST /contatos/post` com headers `id` + `api_token` e corpo
`{ whatsapp_account_id, phone_number, observations, name? }` — é **upsert por telefone** e a resposta
vem vazia. Confirmado na doc oficial (Postman) e testado ao vivo.

## ⚠️ Ainda pendente: a 1ª ligação real
A ponte está construída e testada, mas **nenhuma ligação real passou por ela**. Além disso, a conta
antiga do Chatbotify foi excluída — o `CHATBOTIFY_CRM_ACCOUNT_ID` e o `api_token` precisam vir da
conta **nova** (`disparos_`). Fazer 1 ligação de teste e conferir a nota no contato.
