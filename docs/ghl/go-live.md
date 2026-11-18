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

## O que falta: a Clara não tem canal — e isso custa $20/mês

Investigado a fundo em 18/11. O bloqueio é comercial, não técnico, e o preço está na tela.

### O que foi verificado

| Onde | O que mostra |
|---|---|
| Agente → **Implantar → Canais** | `WhatsApp` e `SMS`: **"No Data"** |
| **Configurações → Sistema telefônico → Números de Telefone** | **"No Data"** — nenhum número na location |
| **Configurações → WhatsApp** | página de venda com o botão **"PAGAR $20 E ASSINAR"** |

A própria página de venda diz, com todas as letras: *"Automatize respostas do WhatsApp com o
Conversation AI! Responda de imediato, lide com consultas 24 horas por dia, 7 dias por semana."* É
essa assinatura que liga o canal da Clara.

### O caminho por workflow não existe

Testado e descartado. A lista de ações tem a categoria **"IA de fluxo de trabalho" → "Agente de
AI"**, mas:

- é um agente **genérico** (`Build Your Own`), com instruções e ferramentas próprias — **não
  reaproveita a Clara**: nem o prompt, nem a base de conhecimento, nem as 10 ações;
- é marcada como **ação premium, "com cobranças adicionais por execução"**;
- todos os templates prontos do dropdown aparecem bloqueados.

Não existe, em lugar nenhum da lista de ações, nada que invoque o agente de conversa. O
`Conversation AI` só se liga por canal. (O workflow de teste usado nessa verificação foi apagado.)

### O WhatsApp atual não serve de canal

O WhatsApp da clínica roda pelo app **"WhatsApp API Não Oficial" (4zapy)**, que entrega as
conversas em Conversas mas **não se registra como canal de agente de IA**. É por isso que as réguas
saem por ação de SMS com o prefixo `#2` no nome do workflow — o 4zapy roteia pelo nome, não pelo
canal. Funciona para **mandar**; não serve para a Clara **receber**.

### Decisão da clínica

**A Clara está pronta e calada.** Prompt, base de conhecimento, 10 ações, agendamento testado
contra a Clinicorp de produção. Falta só ela poder ouvir. Duas opções:

1. **Assinar o WhatsApp oficial** na location — $20 pelo botão, mais o custo por mensagem da Meta.
   É o caminho que o painel oferece e que comprovadamente liga o Conversation AI.
2. **Perguntar à consultoria** se o 4zapy tem algum modo de expor o número como canal de IA. Não
   custa nada perguntar, mas o painel não oferece isso em lugar nenhum — a chance é baixa.

## Como desligar tudo, se precisar

- **Parar as réguas:** `REGUAS_ENABLED=false` no Render + redeploy. Os workflows podem ficar
  publicados; sem a tag do backend eles não inscrevem ninguém.
- **Parar um workflow só:** o toggle Publicar/Rascunho no cabeçalho dele.
- **Parar a Clara:** IA → Clara → Modo → Desativado.
