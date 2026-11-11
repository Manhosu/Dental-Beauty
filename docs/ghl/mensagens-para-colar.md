# Mensagens prontas para colar no GoHighLevel

Os textos [v3 aprovados](../textos-reguas-v3-APROVADO.md) com os campos já trocados pelas tags do
GHL. É copiar e colar na ação **WhatsApp API Não Oficial** (app 4zapy) de cada workflow.

> Montar tudo como **não publicado**. Publicar só depois do ok do cliente.
> Canal de teste: **#3 — Disparos**.

## Como os campos chegam

O backend posta JSON livre no gatilho **Inbound Webhook** de cada workflow
(`src/scheduling/reguas/ghlDispatcher.ts`). No GHL esses campos viram:

| Campo no texto | Tag para colar | Origem |
| --- | --- | --- |
| `[Nome]` | `{{inboundWebhookRequest.first_name}}` | primeiro nome do paciente |
| `[ nome do filho(a) ]` | `{{inboundWebhookRequest.nome_crianca}}` | Clinicorp |
| `[dia]` | `{{inboundWebhookRequest.data}}` | agenda |
| `[hora]` | `{{inboundWebhookRequest.hora}}` | agenda |

Campos usados só para ramificar, nunca no texto: `tipo`, `track` (`adulto`/`infantil`),
`procedimento`, `meses`.

> Antes de colar, mande um disparo de teste e confira na aba do gatilho se os campos aparecem com
> esses nomes. O GHL só reconhece a tag depois de ter visto o campo chegar uma vez.

## Estrutura: 5 workflows, 25 mensagens

Um workflow por régua, porque o backend tem uma URL de webhook por régua. Dentro dele, ramificação
por `track` (e por `procedimento` ou `meses` quando precisa).

| Workflow | Gatilho (`tipo`) | Ramos | Mensagens |
| --- | --- | --- | --- |
| `RÉGUA — Aniversário` | `aniversario` | track | 2 |
| `RÉGUA — Confirmação de consulta` | `no_show` | track × 24h/2h | 4 |
| `RÉGUA — Retorno pós-procedimento` | `pos_procedimento` | track × procedimento | 13 |
| `RÉGUA — Pesquisa de satisfação` | `nps` | track | 2 |
| `RÉGUA — Reengajamento` | `inatividade` | track × meses | 4 |

---

# 1 · RÉGUA — Aniversário

Gatilho: Inbound Webhook · `GHL_REGUA_WEBHOOK_ANIVERSARIO`

## 1.1 · track = adulto

```
🎂✨ Feliz aniversário, {{inboundWebhookRequest.first_name}}!
Hoje queremos celebrar você!
Que este novo ciclo seja repleto de saúde, conquistas, momentos felizes e muitos motivos para sorrir.
É um privilégio fazer parte da sua história e cuidar de algo tão especial: o seu sorriso.
Com carinho,
Equipe Dental Beauty 🤍
```

## 1.2 · track = infantil

```
🎂🧚✨ Hoje é dia de festa no Reino dos Guardiões!
{{inboundWebhookRequest.nome_crianca}} está completando mais um ano de vida!
A Fada do Dente e todos os Guardiões desejam um novo ciclo cheio de aventuras, descobertas, saúde e sorrisos mágicos! Que continue espalhando alegria por onde passar!
Com muito carinho,
Sua família Dental Beauty Kids 💖
```

---

# 2 · RÉGUA — Confirmação de consulta

Gatilho: Inbound Webhook · `GHL_REGUA_WEBHOOK_NOSHOW`

> **Pendência técnica:** hoje o motor dispara um evento só, 24h antes. O lembrete de 2h precisa de
> uma segunda rodada diária no cron. Montar os 4 ramos mesmo assim; os de 2h ficam inertes até a
> rodada existir.

## 2.1 · 24h antes · track = adulto

```
✨ Olá, {{inboundWebhookRequest.first_name}}!
Estamos preparando tudo para receber você com muito carinho na Dental Beauty. 🤍
Sua consulta está agendada para amanhã:
📅 {{inboundWebhookRequest.data}}
🕒 {{inboundWebhookRequest.hora}}
Pode confirmar sua presença com um SIM? Se precisar de outro horário, responda NÃO que encontramos uma nova opção para você.
```

## 2.2 · 24h antes · track = infantil

```
✨ Olá, família de {{inboundWebhookRequest.nome_crianca}}!
Estamos preparando tudo com muito carinho para a próxima aventura no Reino dos Guardiões. 💖
A consulta está agendada para amanhã:
📅 {{inboundWebhookRequest.data}}
🕒 {{inboundWebhookRequest.hora}}
Pode confirmar a presença com um SIM? Se precisar remarcar, responda NÃO que encontramos outro horário.
```

## 2.3 · 2h antes · track = adulto

```
Olá, {{inboundWebhookRequest.first_name}}! ✨ Sua consulta é hoje, às {{inboundWebhookRequest.hora}}.
Nossa equipe já está esperando por você. Se surgir qualquer imprevisto, é só nos avisar por aqui. 🤍
```

## 2.4 · 2h antes · track = infantil

```
🧚 Olá, família de {{inboundWebhookRequest.nome_crianca}}! A consulta é hoje, às {{inboundWebhookRequest.hora}}.
Estamos esperando vocês com carinho. Qualquer imprevisto, é só nos avisar por aqui. 💖
```

---

# 3 · RÉGUA — Retorno pós-procedimento

Gatilho: Inbound Webhook · `GHL_REGUA_WEBHOOK_POSPROC`

Ramificar por `{{inboundWebhookRequest.procedimento}}`. O prazo de cada um já é decidido no backend
(`intervalMonthsForCategory`), então o workflow só escolhe o texto.

## 3.1 · Limpeza · 6 meses

```
✨ Olá, {{inboundWebhookRequest.first_name}}! Como você está?
Já se passaram seis meses desde o seu último cuidado preventivo aqui na Dental Beauty. 🤍
Manter o sorriso saudável é um compromisso que construímos juntos, e a prevenção faz toda a diferença ao longo dos anos.
Que tal reservarmos um momento para cuidar de você novamente? Conte qual período da sua semana é mais tranquilo, e organizamos tudo.
```

## 3.2 · Clareamento · 6 meses

```
✨ Olá, {{inboundWebhookRequest.first_name}}!
Lembra daquele sorriso iluminado que conquistamos juntos? Seu clareamento completou seis meses. 🤍
Com o tempo e os hábitos do dia a dia, pode ser interessante avaliarmos a manutenção do resultado e orientar os próximos cuidados.
Qual dia da semana fica melhor para você vir ver como está o seu sorriso?
```

## 3.3 · Restauração · 6 meses

```
Olá, {{inboundWebhookRequest.first_name}}! 🤍
Aqui na Dental Beauty, nosso cuidado continua mesmo depois que o tratamento termina.
Sua restauração completou seis meses, e queremos convidar você para uma revisão: conferimos a adaptação, a integridade e como o trabalho se conserva com o tempo.
Qual é o melhor dia para encaixarmos essa revisão na sua rotina?
```

## 3.4 · Canal · 6 meses

```
Olá, {{inboundWebhookRequest.first_name}}! Tudo bem? ✨
Seu tratamento de canal completou seis meses, e chegou o momento de acompanhar a evolução.
Mesmo quando está tudo bem e não há desconforto, a revisão clínica e, quando indicada, a radiografia confirmam que o dente segue saudável.
Queremos ter certeza de que tudo evolui como esperado. Qual dia funciona melhor para você? 🤍
```

## 3.5 · Coroa / Prótese · 12 meses

```
✨ Olá, {{inboundWebhookRequest.first_name}}!
Seu sorriso passou por uma transformação importante conosco, e sua prótese completou um ano.
É o momento de avaliarmos a adaptação, a mordida e a saúde da gengiva ao redor, para preservar o conforto e a durabilidade do tratamento.
Vamos celebrar esse primeiro ano cuidando dela? Qual período da semana fica mais confortável para você? 🤍
```

## 3.6 · Implante · 12 meses

```
Olá, {{inboundWebhookRequest.first_name}}! 🤍
Um implante representa muito mais do que um novo dente: representa conforto, segurança e qualidade de vida.
Por isso fazemos questão de acompanhar você depois da conclusão do tratamento. Já faz um ano, e é o momento de avaliarmos a gengiva, a estabilidade do implante e os cuidados de manutenção.
Qual semana fica melhor para você vir?
```

## 3.7 · Tratamento periodontal · 3 meses

```
Olá, {{inboundWebhookRequest.first_name}}! Tudo bem? 🌿
Você sabia que a saúde da gengiva é essencial para preservar os dentes ao longo da vida?
Seu tratamento periodontal completou três meses, e esta é a manutenção mais importante: acompanhamos sua evolução e mantemos a gengiva saudável e estável.
Qual dia da semana fica mais fácil para você manter essa constância com a gente?
```

## 3.8 · Ortodontia adulto · 6 meses

```
✨ Olá, {{inboundWebhookRequest.first_name}}!
Cada etapa do tratamento ortodôntico faz parte do sorriso que planejamos juntos.
Já se passaram seis meses desde o seu último acompanhamento, e a regularidade das consultas é o que mantém o planejamento no caminho certo, seja na evolução do tratamento ou na contenção.
Vamos proteger o sorriso que você está construindo? Qual dia da semana é melhor para você? 🤍
```

## 3.9 · Invisalign · 6 meses

```
Olá, {{inboundWebhookRequest.first_name}}! ✨
Como está sendo sua experiência com os alinhadores?
Seu novo sorriso está sendo construído etapa por etapa, e queremos acompanhar cada detalhe: o encaixe dos alinhadores, o progresso dos movimentos e as próximas etapas do planejamento.
Quando fica bom para você passar aqui? Separamos um tempo com calma para essa consulta. 🤍
```

## 3.10 · Lente / Faceta · 6 meses

```
✨ Olá, {{inboundWebhookRequest.first_name}}!
Um sorriso bonito merece continuar recebendo cuidados especiais.
Suas lentes ou facetas completaram seis meses, e queremos convidar você para uma revisão: avaliamos o acabamento, a saúde da gengiva e os cuidados para preservar a estética e a função do seu sorriso.
Qual momento da sua semana combina com essa visita? Será um prazer receber você novamente. 🤍
```

## 3.11 · Limpeza · infantil

```
🧚✨ Olá, família de {{inboundWebhookRequest.nome_crianca}}!
Temos uma mensagem especial do Reino dos Guardiões!
Está chegando o momento de conferir como estão os dentinhos e continuar a missão de proteger o sorriso. Cada visita é uma nova oportunidade de aprender, cuidar e criar memórias felizes! 💖
Qual dia da semana encaixa melhor na rotina de vocês para a próxima aventura?
```

## 3.12 · Restauração · infantil

```
🧚✨ Olá, família de {{inboundWebhookRequest.nome_crianca}}!
No Reino dos Guardiões, toda conquista merece acompanhamento!
Chegou o momento de revisar a restauração e conferir que está tudo certinho, numa consulta tranquila e no ritmo da criança. 💖
Qual dia fica mais tranquilo para vocês?
```

## 3.13 · Ortodontia · infantil

```
🦸✨ Atenção, família de {{inboundWebhookRequest.nome_crianca}}!
Nosso Guardião do Sorriso tem uma nova missão!
Nessa fase de crescimento o sorriso muda rápido, e cada acompanhamento ortodôntico ajuda a observar a evolução e a orientar os próximos passos. E, claro, tem uma experiência cheia de carinho esperando por aqui! 💙
Qual dia da semana encaixa melhor na rotina da família?
```

---

# 4 · RÉGUA — Pesquisa de satisfação

Gatilho: Inbound Webhook · `GHL_REGUA_WEBHOOK_NPS`

A nota que o paciente responder é tratada pelo agente, não pelo workflow. As respostas por faixa
estão na seção **Sugestões novas**, e vão no prompt do agente.

## 4.1 · track = adulto

```
Olá, {{inboundWebhookRequest.first_name}}! 🤍
Foi um prazer receber você na Dental Beauty!
Queremos que cada visita seja marcada por acolhimento, confiança e uma experiência verdadeiramente especial, e a sua opinião nos ajuda a evoluir.
De 0 a 10, o quanto você indicaria a Dental Beauty para alguém de quem você gosta?
```

## 4.2 · track = infantil

```
Olá, família de {{inboundWebhookRequest.nome_crianca}}! 💖
Foi uma alegria receber vocês no Reino dos Guardiões!
Se quiser, conte também o que {{inboundWebhookRequest.nome_crianca}} achou da aventura: adoramos saber.
E, para nos ajudar a evoluir: de 0 a 10, o quanto você indicaria a Dental Beauty Kids para outra família?
```

---

# 5 · RÉGUA — Reengajamento

Gatilho: Inbound Webhook · `GHL_REGUA_WEBHOOK_INATIVIDADE`

Ramificar por `{{inboundWebhookRequest.meses}}` (6 ou 12). Quem voltou já é excluído no backend.

> **Atenção:** a consultoria tem uma campanha publicada chamada "6+ meses sem vir". Antes de
> publicar esta régua, confirmar a divisão com eles — senão o paciente recebe as duas.

## 5.1 · 12 meses · track = adulto

```
✨ Olá, {{inboundWebhookRequest.first_name}}! Como você está?
Revisando os acompanhamentos dos nossos pacientes, percebemos que já faz um ano desde a sua última visita.
Seguimos com o mesmo compromisso: cuidar de você de forma personalizada, com atenção a cada detalhe. Gostaríamos muito de saber como está o seu sorriso e de convidar você para uma nova avaliação preventiva.
Que tal começar esse novo cuidado ainda este mês? Conte qual período fica melhor, e nós organizamos tudo. 🤍
```

## 5.2 · 6 meses · track = adulto

```
Olá, {{inboundWebhookRequest.first_name}}! 🤍
Já se passaram seis meses desde a sua última consulta.
Manter esse acompanhamento é o jeito mais leve de cuidar do sorriso: aqui, você vem para se cuidar, e não só quando aparece um problema.
Qual dia da sua semana combina com esse cuidado? O resto, deixe com a gente. ✨
```

## 5.3 · 12 meses · track = infantil

```
🧚✨ Psiu, família de {{inboundWebhookRequest.nome_crianca}}!
A Fada do Dente estava olhando o livro de aventuras e percebeu que faz tempo que nosso Guardião não aparece por aqui. Estamos com saudades!
Muitas aventuras aconteceram desde a última visita, e adoraríamos ver como esse sorriso cresceu. 💖
Vamos preparar esse reencontro? Conte qual dia fica melhor para vocês.
```

## 5.4 · 6 meses · track = infantil

```
🧚✨ Olá, família de {{inboundWebhookRequest.nome_crianca}}!
Já se passaram seis meses desde a última aventura no Reino dos Guardiões.
Cada visita reforça os bons hábitos em casa e ajuda a criança a cuidar, cada vez mais, do próprio sorriso. 💖
Qual dia da semana combina com a rotina de vocês para essa próxima missão?
```

---

# Sugestões novas — aguardando decisão do cliente

Nada aqui entra sem aprovação. São de duas naturezas diferentes:

## Vão no prompt do agente (não são workflow)

O agente já recebe a nota do paciente na conversa do NPS. Basta ensiná-lo a responder por faixa.
Custo: edição do prompt, sem automação nova.

### Nota 9 ou 10

> ⚠️ Falta confirmar o link. Candidato: `https://g.page/r/CQZuDgYFDS09EBM/review`

```
Que alegria ler isso, {{inboundWebhookRequest.first_name}}! 🤍
Se puder, conte em poucas palavras como foi a sua experiência no Google. Isso ajuda outras pessoas a nos conhecerem com confiança:
[link do Google]
```

### Nota 7 ou 8

```
Agradecemos a sua nota, {{inboundWebhookRequest.first_name}}! ✨
O que faltou para ser um 10? Sua resposta nos ajuda a cuidar ainda melhor de você.
```

### Nota 0 a 6

> ⚠️ `[prazo]` não foi definido por ninguém. Sugestão: 24 horas úteis.

```
{{inboundWebhookRequest.first_name}}, agradecemos a sinceridade. 🤍
Queremos entender o que aconteceu e fazer diferente. Uma pessoa da nossa equipe vai falar com você em até [prazo].
```

## Precisam de régua nova no backend (escopo novo)

Nenhuma das duas tem gatilho no motor hoje.

### Cuidado no dia seguinte a cirurgia, extração ou canal

Gatilho que falta: consulta atendida ontem **cujo procedimento seja cirúrgico**. O motor já sabe
ler consultas atendidas (é o que a régua de NPS usa), então o trabalho é filtrar por categoria de
procedimento e criar o dispatcher.

```
Olá, {{inboundWebhookRequest.first_name}}! 🤍 Passando para saber como você está depois do procedimento de ontem.
Se sentir algo diferente do que o dentista explicou, é só nos chamar por aqui que nossa equipe orienta você.
```

### Criança que concluiu o tratamento

Gatilho que falta: **tratamento marcado como concluído** na Clinicorp. Precisa verificar se a API
expõe esse estado; se não expuser, depende de marcação manual.

```
✨ Olá, família de {{inboundWebhookRequest.nome_crianca}}!
Lembram de toda a jornada que vivemos juntos para cuidar desse sorriso? Foi uma conquista muito especial! 🏰
Agora queremos continuar fazendo parte dessa história, acompanhando o crescimento e preservando os resultados alcançados. Aqui na Dental Beauty Kids, nossa missão não termina quando o tratamento acaba.
Qual dia da semana fica melhor para a próxima visita preventiva? 💖
```
