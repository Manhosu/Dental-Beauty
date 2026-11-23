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
Hoje elas saem de graça pelo app; no oficial cada disparo vira template cobrado por mensagem.

São **disparos**, não conversas: pela média do primeiro dia real (19/11, 67 envios) dá ~2.000
mensagens/mês. E elas **não estão todas na mesma faixa**, que foi o erro da primeira estimativa:

| Faixa | Réguas | Por mês | Preço | Custo |
|---|---|---|---|---|
| Utilidade | lembrete 23 + confirmação 15 + pesquisa 12 + anamnese 2 | ~1.560 | ~R$ 0,035–0,05 | **R$ 55–78** |
| Marketing | aniversário 13 + reengajamento 1 + pós-procedimento 1 | ~450 | ~R$ 0,31–0,38 | **R$ 140–171** |

**R$ 195–250/mês** em mensagens, mais os $20 da assinatura: algo entre **R$ 305 e R$ 360**.

A régua de **aniversário** é 20% do volume e ~70% do custo. Utilidade, para a Meta, é o que está
preso a uma transação específica do paciente — lembrete, confirmação e anamnese são; parabéns de
aniversário é relacionamento, logo marketing, a ~9x o preço. Reengajamento e retorno pós-procedimento
caem do mesmo lado, porque convidam a marcar. Se a clínica quiser cortar custo sem perder régua
operacional, é o aniversário que paga a conta.

Duas ressalvas: **quem decide a categoria é a Meta**, na aprovação do template — só vira número
fechado quando os textos forem submetidos; e as tarifas em BRL variam por fonte, daí a faixa.

**Resposta de paciente não é mais sempre grátis.** Desde **out/2026** a mensagem de serviço é
cobrada pela tarifa de utilidade, com franquia mensal gratuita (as ~1.000 primeiras do mês). Dentro
da franquia não custa; acima dela, custa. Vale para a recepção e para a Clara.

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

## ✅ A liberação de horário nunca funcionou — e mandava mensagem falsa (achado de 22/11, resolvido em 23/11)

Encontrado ao conferir os **Registros de execução** do workflow `Sem confirmação`. São dois
problemas empilhados, e o segundo chegava ao paciente.

**1. O webhook falha, sempre.** Nas três execuções de 22/11 (8:02–8:03) o erro foi idêntico:

```
Webhook Action error: {"error":"invalid","issues":[{"code":"invalid_type",
"expected":"string","received":"undefined","path":["appointmentId"],"message":"Required"}]}
```

**A causa NÃO é o backend.** A primeira hipótese foi `GHL_FIELD_AGENDAMENTO` faltando no ambiente.
Está errada, e fica registrada para ninguém repetir o caminho:

| Verificado em 22/11 | Resultado |
|---|---|
| `GHL_FIELD_AGENDAMENTO` no Render | **presente**, com o valor certo `T7UxlEaWVQ7w0CMKliPL` |
| Campo `Régua - Agendamento` nos contatos que falharam | **preenchido** — Matheus `5564279249436673` e Márcia `6340962639413249`, ambos desde **21/11 12:00**, ou seja 20h antes do webhook rodar |
| Mapeamento no painel (`Dados personalizados`) | `appointmentId` → `Contact.Custom Fields.Régua - Agendamento` |
| Cabeçalho `x-api-key` | preenchido — e o erro foi **400**, não 401, então a autenticação passou |

Ou seja: o backend grava, o contato tem o valor, o mapeamento aponta para o campo certo — e mesmo
assim o GHL monta o corpo **sem a chave**. O problema é do lado do painel, na resolução do chip de
variável para o corpo do webhook. É parente da armadilha de rótulo defasado que já apareceu nas
mensagens (ver `textos-reguas-v5-APROVADO.md`).

**Refazer o chip não resolveu (22→23/11).** O par `appointmentId` foi apagado pela lixeira da linha
e remontado pelo seletor de variáveis; o fluxo foi salvo e publicado. Na execução seguinte, às 8h de
23/11, as **10 execuções falharam com o erro idêntico**. O contato que falhou carregava
`T7UxlEaWVQ7w0CMKliPL = "5591430351814657"` desde 22/11 09:01, 23h antes. Hipótese derrubada.

**Descartado no mesmo dia:** a ação `Limpa a confirmacao do ciclo anterior` roda antes do webhook,
então valia conferir se ela zerava o campo antes das 8h. Não zera — é `Remova tag de contato` com
`consulta-confirmada` e `REMOVER TODAS AS TAGS` desligado. Não encosta em campo personalizado.

### ✅ Resolvido em 23/11 — e o dado sempre esteve no corpo

O conserto saiu do painel e veio para o backend (commit `514225e`). O que mudou de entendimento:

**O payload padrão do webhook já traz os campos personalizados do contato.** O próprio painel avisa,
embaixo de `DADOS PERSONALIZADOS`: *"Esses pares personalizados de token-valor serão incluídos junto
com **dados padrão**"*. O chip nunca foi necessário — era um caminho a mais para o mesmo dado, e o
único que não funcionava.

Agora `/reguas/liberar-horario` procura o id do agendamento nesta ordem:

1. `appointmentId` / `appointment_id`, na raiz ou em `customData` — a grafia que a gente pede;
2. qualquer chave que **fale de agendamento** (`/agendamento/i`), que é o que cobre o GHL mandar o
   campo com o nome dele (`Régua - Agendamento`) ou com o fieldKey (`rgua__agendamento`);
3. se nada disso vier, busca o campo no contato pela API do GHL, a partir do id do contato.

A resposta de sucesso diz por qual caminho veio, em `origem`: `corpo` ou `contato`. A recusa passou a
listar `chavesRecebidas` — **só os nomes das chaves, nenhum valor**, porque essa resposta aparece no
registro de execução do painel e o corpo carrega nome e telefone de paciente.

**Como foi confirmado, em minutos e não em 24h.** Está no painel o workflow
`ZZ BANCADA — teste do webhook da liberacao (nao publicar)`: um acionador nenhum, uma ação de webhook
só, apontando para o mesmo endpoint com o mesmo `x-api-key` e **sem nenhum dado personalizado**. Roda
pelo botão `Testar fluxo de trabalho` escolhendo o contato `TESTE Liberacao (apagar)`
(`teste-liberacao@dental-beauty.invalid`, id `9IieEzKxBK29828bSesu`), que **não tem telefone** — então
nenhuma mensagem alcança ele nem por acidente. Resultado:

```
Status: Executado / Success
{"status":200,"msg":"webhook response: {\"status\":\"simulado\",
\"appointmentId\":\"TESTE-AGD-999\",\"origem\":\"corpo\"}"}
```

`origem: corpo` num webhook sem dado personalizado nenhum é a prova: o campo veio nos dados padrão.

Vale guardar a bancada. Ela troca um ciclo de conferência de 24h — porque a régua real só toca o
webhook às 8h — por 30 segundos. Foram dois dias e duas hipóteses erradas por falta dela.

> O par `appointmentId` com o chip **continua na ação da régua real** e não atrapalha: o GHL manda a
> chave vazia ou não manda, e nos dois casos a rota cai no passo 2. Se um dia o GHL passar a resolver
> o chip, o valor que chegar é o certo.

> ⚠️ **Não use Ctrl+A dentro desse painel.** Em 22/11, com o foco não pegando no campo do chip, o
> Ctrl+A selecionou **os 7 nós do canvas** e o Delete abriu "excluir 7 nós selecionado? (6 ações e
> 1 acionador)". Foi cancelado a tempo e nada se perdeu, mas é o caminho mais curto para apagar a
> régua inteira. Para limpar o chip, use o botão de lixeira da linha ou apague com Backspace.

**2. A mensagem saía mesmo assim.** Um segundo depois de cada falha, a ação `Horario liberado`
aparece como **Executado**. O texto dizia: *"Como não recebemos a sua confirmação, liberamos o
horário de [dia] para outro paciente."* Era falso duas vezes — o webhook tinha falhado, e mesmo se
tivesse passado, `LIBERAR_HORARIO_ATIVO=false` responde `simulado` e não cancela nada. Conferido na
agenda: **Maria Vitória Nunes Oliveira (23/11 17h) e Matheus Teixeira de Abreu (23/11 9h) seguiam
com consulta marcada** depois de receberem o aviso.

**Feito em 22/11:** a ação `Horario liberado` foi **removida** do workflow. A cadeia termina no
webhook, que falha sem efeito. O texto está guardado em `mensagens-para-colar.md` §2c.2 para voltar.

### Ordem para ligar a liberação de verdade

1. ~~Fazer o webhook chegar com o `appointmentId`~~ — **resolvido em 23/11** no backend, não no
   painel. Confirmado na bancada: `Executado`, `origem: corpo`.
2. **← estamos aqui.** Decidir **quando** a vaga deve ser solta (ver abaixo) — é escolha da clínica,
   não detalhe técnico, e precisa ser resolvida antes de ligar o interruptor.
3. Em 24/11, conferir em **Registros de execução → Webhook** da régua real que as execuções das 8h
   saíram de `Failed`. A resposta tem que trazer `origem`; se vier `contato`, funcionou pela busca na
   API, que também vale. Se vier `400`, o campo `chavesRecebidas` diz exatamente o que o GHL mandou.
4. `LIBERAR_HORARIO_ATIVO=true` no Render + redeploy, e conferir no log `simulado` sumindo.
5. **Só então** recolocar a mensagem `Horario liberado` no fim da cadeia.

Inverter essa ordem é o que produziu o problema de 22/11: a mensagem estava no ar antes de qualquer
um dos passos funcionar.

### ⚠️ Antes de ligar: a vaga é solta no D-3

Apareceu nos dados de 23/11 e **não é bug, é a cadeia funcionando como foi desenhada** — mas é
decisão da clínica, não nossa. A consulta do contato que falhou hoje é **26/11**; o webhook de
liberação disparou **23/11**.

A conta: a confirmação sai no D-4, a cobrança às 19h do mesmo dia, e a liberação às 8h do dia
seguinte. Quem não responde em **~10 horas** perde a vaga **3 dias antes** da consulta.

Hoje não machuca ninguém porque `LIBERAR_HORARIO_ATIVO=false`. Mas no dia em que o interruptor virar,
isso solta horário de paciente que simplesmente não olhou o WhatsApp numa tarde. Perguntar à clínica
se é isso mesmo que ela quer, ou se a liberação deve esperar mais (por exemplo, só no D-1).

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
