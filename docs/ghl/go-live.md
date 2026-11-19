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
| Agente → **Implantar → Canais** | *"Ainda não há canais configurados"* — os 8 canais aparecem como **disponíveis**, nenhum ligado |
| Canais → **SMS → Configurar → números de telefone** | **"No Data"** — o canal existe, mas não há nenhum número LC Phone para apontar |
| Canais → **Adicionar canais do marketplace** | *"Ainda não há provedores instalados"* |
| **Configurações → Sistema telefônico → Números de Telefone** | **"No Data"** — nenhum número na location |
| **Configurações → WhatsApp** | página de venda com o botão **"PAGAR $20 E ASSINAR"** |

As duas linhas do meio foram levantadas em **19/11** e são as que fecham a questão. O canal SMS
existe e aceitaria a Clara — ele só não tem número para onde apontar. E a aba de marketplace, que
seria a porta do 4zapy, está vazia: **o app não se registra como provedor de conversa**, só como
app de envio.

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
2. ~~Perguntar à consultoria se o 4zapy expõe o número como canal de IA.~~ **Respondido em 19/11:
   não funciona.** A própria consultoria confirmou que o app deixa de operar no número se ele for
   registrado na API oficial, e a aba de provedores de marketplace está vazia. Opção encerrada.

**O que isso custa de verdade.** Registrar o número na API oficial **desliga o 4zapy nesse número**
— quem confirmou foi a consultoria. Então não é "$20 a mais": é trocar o canal de envio das réguas.
Hoje elas saem de graça pelo app; no oficial cada mensagem de régua vira *template de utilidade*.
Pela média do primeiro dia real (19/11, 67 envios) dá ~2.000 mensagens/mês, que a R$ 0,035
são **~R$ 70/mês**, mais os $20 da assinatura. As respostas de paciente continuam grátis: conversa
iniciada por ele é de serviço, e as 1.000 primeiras do mês não são cobradas.

## A recobrança que pegou quem já tinha confirmado (19/11)

O cliente reportou que a paciente respondeu e o robô cobrou de novo. Investigado na conversa real
(Luna Farias Oliveira, consulta 23/11 13:30):

| Hora | O que aconteceu |
|---|---|
| 09:00 | régua pede o SIM |
| 09:15 | paciente responde **"Confirmado"** |
| 10:55 | a recepção responde à mão |
| 12:10 | régua: *"Ainda não recebemos a confirmação…"* |
| 12:28 | paciente responde "Confirmado" e "Sim" |

**A lista de palavras não é a culpada.** O gatilho é
`Corpo da mensagem contains any of ["sim","confirmo","confirmad","estarei"]` — "Confirmado" casa com
`confirmad`. O fluxo `RÉGUA — Confirmação recebida` está **publicado**, com **reentrada ligada**, e
funcionou para sete outros contatos no mesmo dia (09:03, 09:27, 09:46, 10:28, 12:18, 12:28, 13:20).

O histórico de inscrições dela mostra **uma única entrada, às 12:28:49**. Ou seja: o "Confirmado"
das 09:15 **não chegou a disparar o gatilho**. A mensagem está na conversa, mas o evento de entrada
não veio no momento em que ela foi escrita — é o app não-oficial entregando o recebido fora de hora.

Some-se a isso o desenho: com a confirmação no **D-4**, a cobrança das 12h cai **no mesmo dia**, só
**3h depois** do pedido. Mesmo com a detecção perfeita, quem responde à tarde é cobrado antes.

> ✅ **Resolvido em 19/11, com o OK do cliente: a cobrança das 12h saiu.** O fluxo virou
> `#2 RÉGUA — Sem confirmação (19h e liberação)`: a espera passou de 12h para 19h, e a mensagem das
> 12h e a espera intermediária foram apagadas. A liberação segue às 8h do dia seguinte, então a
> clínica mantém 3 dias para remanejar a vaga. Workflow salvo e publicado.
>
> Um efeito colateral, benigno: apagar a espera tira do fluxo quem estava parado nela. A turma de
> 19/11 já tinha recebido a cobrança das 12h, então perdeu só o aviso das 19h — e deixou de receber
> o "liberamos o seu horário" de amanhã, que seria falso enquanto `LIBERAR_HORARIO_ATIVO=false`.

## Dentista que faltou: o que a agenda resolve sozinha

Levantado na API em 19/11, sobre 281 agendamentos de 20/10 a 19/11:

- **agendamento cancelado some da lista.** Nenhum registro voltou com `Deleted = "X"` — a Clinicorp
  simplesmente não devolve o que foi cancelado. Como toda régua de agenda lê
  `GET /appointment/list`, **cancelar na Clinicorp já cala a régua**, sem tocar em código.
- **bloqueio de agenda não aparece.** Nenhum dos 281 veio sem nome de paciente, e nenhum com
  "cancelado", "bloqueio", "compromisso" ou "férias" na categoria. Então criar um compromisso
  bloqueando a agenda **não serve de sinal**: o backend não enxerga esse registro, e os pacientes já
  marcados continuam recebendo normalmente.

A ideia do cliente de "mandar uma instrução para a IA" não funciona por um motivo anterior: **quem
dispara as réguas não é a Clara**, é o cron do backend lendo a Clinicorp. A Clara não tem como pausar
o que ela não envia — nem depois que ganhar canal.

Se a clínica quiser uma pausa que não exija mexer agendamento por agendamento, isso é escopo novo:
um interruptor "não enviar nada da profissional X no dia Y", acionado por fora da Clinicorp.

## Como desligar tudo, se precisar

- **Parar as réguas:** `REGUAS_ENABLED=false` no Render + redeploy. Os workflows podem ficar
  publicados; sem a tag do backend eles não inscrevem ninguém.
- **Parar um workflow só:** o toggle Publicar/Rascunho no cabeçalho dele.
- **Parar a Clara:** IA → Clara → Modo → Desativado.
