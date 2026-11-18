# Go-live — 18/11/2026, 18h40 (BRT)

O que está no ar, o que está em modo seguro e a única coisa que ficou faltando.

## No ar

| Peça | Estado |
|---|---|
| Backend no Render | commit `9daf632`, health 200 |
| `REGUAS_ENABLED` | **`true`** |
| Os 13 workflows de régua | **Publicados** |
| Webhook da liberação de horário | `x-api-key` com o valor real |
| Clara — prompt, base de conhecimento, 10 ações | prontos |

**A primeira mensagem sai amanhã de manhã.** O cron roda às **11:00 UTC (8h BRT)** — lembrete do
dia e anamnese D-2 — e às **12:00 UTC (9h BRT)** — o resto das réguas. Nada dispara hoje à noite.

## Em modo seguro de propósito

### `LIBERAR_HORARIO_ATIVO=false`

A régua "Sem confirmação" roda inteira: 12h, 19h, espera até as 8h do dia seguinte e chama
`/reguas/liberar-horario`. Só que a rota responde `{"status":"simulado"}` e **não toca na agenda**.

No log do Render procure `simulado` com o `appointmentId` — é a lista de quem teria sido cancelado.
Confira contra quem de fato não confirmou. Se a detecção de "SIM" estiver certa, basta trocar a
variável para `true` e redeployar.

### Clara em modo `Sugestivo`

Ela lê a conversa e **escreve a resposta, mas quem envia é a recepção**. Nada chega ao paciente sem
alguém dar OK. Trocar para `Piloto automático` é um clique em IA → Clara → Modo.

## O que falta: a Clara não tem canal

Em **Implantar → Canais**, tanto `WhatsApp` quanto `SMS` mostram **"No Data"** na lista de números.
Nenhum número está conectado nativamente a esta location.

O WhatsApp da clínica roda pelo app **"WhatsApp API Não Oficial" (4zapy)**, que entrega as
conversas em Conversas mas **não se registra como canal de agente de IA**. É por isso que as réguas
saem por ação de SMS com o prefixo `#2` no nome do workflow — o 4zapy roteia pelo nome, não pelo
canal.

Enquanto isso não se resolve, **a Clara está pronta e calada**: ela não recebe mensagem de paciente
nenhuma. Dois caminhos:

1. **Perguntar à consultoria** se o 4zapy expõe o número como canal de agente de IA no painel, ou
   se existe um passo de configuração do lado deles.
2. **Conectar um número oficial** (LC Phone ou WhatsApp Business API) à location. Tem custo e é
   decisão da clínica.

A primeira é a que vale tentar antes, porque não custa nada e o número da clínica já está lá.

## Como desligar tudo, se precisar

- **Parar as réguas:** `REGUAS_ENABLED=false` no Render + redeploy. Os workflows podem ficar
  publicados; sem a tag do backend eles não inscrevem ninguém.
- **Parar um workflow só:** o toggle Publicar/Rascunho no cabeçalho dele.
- **Parar a Clara:** IA → Clara → Modo → Desativado.
