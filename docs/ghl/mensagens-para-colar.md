# Mensagens prontas para colar no GoHighLevel

Os textos [v3 aprovados](../textos-reguas-v3-APROVADO.md) com os campos já trocados pelas tags do
GHL. É copiar e colar na ação **SMS** de cada workflow.

> Montar tudo como **não publicado**. Publicar só depois do ok do cliente.
> Canal de teste: **#3 — Disparos**.

## Como enviar WhatsApp neste painel (verificado em 11/11/2026)

A ação a usar é a **SMS** nativa ("Envia uma mensagem de texto para o contato"), não a do app
4zapy. O 4zapy está ligado como provedor de conversas da subconta, então o que sai pela ação SMS é
entregue como WhatsApp. É assim que a consultoria monta todos os disparos deles.

A ação **WhatsApp API Não Oficial** (4zapy) não serve: o endpoint de campos dinâmicos do app
devolve `{"inputs":[]}`, ou seja, nenhum campo de texto aparece no formulário. Testado nos três
tipos de mensagem.

O número de saída não fica na ação, e sim em **Configurações do fluxo → Comunicação → Número de
origem**. É onde se escolhe o canal #3 (Disparos) para o teste.

### Subconta certa

`ZCMG4O9K8UhFYmvx4i4b` = **Dental Beauty** (a principal, onde ficam os disparos).
Existe também `W0oKvITQdvDXRnOdtJln` = Dental Beauty Recepção, que é outra subconta — não é lá.

### O gatilho é por tag, não por webhook

O "Webhook recebido" é **acionador premium** e o GHL cobra por execução. Com as réguas rodando
todo dia isso vira custo recorrente na conta da clínica, então foi descartado (decisão de
11/11/2026).

O que vale: o backend grava os campos no contato e marca uma **tag**; o workflow usa o gatilho
**Tag de contato**, que não cobra. É o mesmo padrão dos disparos da consultoria.

| Régua | Tag que dispara |
| --- | --- |
| Aniversário | `regua-aniversario` |
| Confirmação de consulta | `regua-confirmacao` |
| Retorno pós-procedimento | `regua-posprocedimento` |
| Pesquisa de satisfação | `regua-nps` |
| Reengajamento 6 meses | `regua-inatividade-6` |
| Reengajamento 12 meses | `regua-inatividade-12` |
| Cuidado no dia seguinte | `regua-poscirurgia` |

> No fim de cada workflow, **remover a tag** que o disparou. Sem isso a régua não volta a rodar
> para o mesmo paciente no ano seguinte.

> O backend nunca manda `tags` no upsert do contato: a doc do GHL avisa que esse campo
> **sobrescreve** todas as tags, o que apagaria a segmentação da consultoria. A tag entra pelo
> endpoint `POST /contacts/{id}/tags`.

### Padrão anti-bloqueio da consultoria

Nos disparos em massa eles usam, entre o gatilho e o envio: **"Liberar 1 paciente a cada 4
minutos"** (drip) e **rodízio aleatório entre 9 variações do texto**. Vale replicar nas réguas de
volume (reengajamento, pós-procedimento). Aniversário e confirmação são volume baixo e não
precisam.

## Como os campos chegam

Antes de marcar a tag, o backend grava os dados nos campos personalizados do contato
(`src/scheduling/reguas/ghlTagDispatcher.ts`). No texto eles viram:

| Campo no texto | Tag para colar | Origem |
| --- | --- | --- |
| `[Nome]` | `{{contact.first_name}}` | cadastro do contato |
| `[ nome do filho(a) ]` | `{{contact.nome_da_criana}}` | Clinicorp |
| `[dia]` | `{{contact.regua__dia}}` | agenda · **campo ainda não existe** |
| `[hora]` | `{{contact.regua__hora}}` | agenda · **campo ainda não existe** |

Campos usados só para ramificar, nunca no texto: `{{contact.trilha}}` e
`{{contact.ltimo_procedimento}}`.

> **Cuidado com a grafia da Trilha.** O campo é de opção única e as opções cadastradas são
> **"Adulto"** e **"Infantil"**, com inicial maiúscula. A API aceita gravar minúsculo sem reclamar,
> mas a condição do workflow compara com a opção: minúsculo faria todo mundo cair no ramo
> "Sem trilha" e ninguém receberia mensagem. O dispatcher já converte.

> **Pendência:** "Régua - Dia" e "Régua - Hora" precisam ser criados como campos de texto na
> location, e o dispatcher precisa passar a gravá-los. Só a régua de confirmação depende deles, e
> ela também está esperando a segunda rodada do cron (lembrete de 2h). As outras quatro réguas não
> dependem disso.

## Estrutura: 6 workflows

Um workflow por régua, cada um disparado pela sua tag. Dentro dele, ramificação por
`{{contact.trilha}}` (e por procedimento quando precisa).

| Workflow | Tag que dispara | Ramos | Mensagens |
| --- | --- | --- | --- |
| `RÉGUA — Aniversário` | `regua-aniversario` | trilha | 2 |
| `RÉGUA — Confirmação de consulta` | `regua-confirmacao` | trilha × 24h/2h | 4 |
| `RÉGUA — Retorno pós-procedimento` | `regua-posprocedimento` | trilha × procedimento | 13 |
| `RÉGUA — Pesquisa de satisfação` | `regua-nps` | trilha | 2 |
| `RÉGUA — Reengajamento` | `regua-inatividade-6` e `-12` | trilha × tag | 4 |
| `RÉGUA — Cuidado no dia seguinte` | `regua-poscirurgia` | nenhum | 1 |

---

# 1 · RÉGUA — Aniversário

Gatilho: Tag de contato · `regua-aniversario`

> **Pronta, como rascunho, em 11/11/2026.** Workflow `efa7fba5-f84c-42f6-872d-7f2c0224654b`.
>
> ```
> Tag adicionada includes "regua-aniversario"
>   └─ Trilha: adulto ou infantil
>        ├─ Adulto    → mensagem adulto   → remove a tag → FIM
>        ├─ Infantil  → mensagem infantil → remove a tag → FIM
>        └─ Sem trilha - nao envia → FIM
> ```
>
> Serve de molde para as outras cinco.
>
> Armadilha do construtor: no campo de escolher tag, **Enter recarrega o painel e descarta tudo
> que não foi salvo**. Tem que clicar na opção da lista.

## 1.1 · trilha = adulto

```
🎂✨ Feliz aniversário, {{contact.first_name}}!
Hoje queremos celebrar você!
Que este novo ciclo seja repleto de saúde, conquistas, momentos felizes e muitos motivos para sorrir.
É um privilégio fazer parte da sua história e cuidar de algo tão especial: o seu sorriso.
Com carinho,
Equipe Dental Beauty 🤍
```

## 1.2 · trilha = infantil

```
🎂🧚✨ Hoje é dia de festa no Reino dos Guardiões!
{{contact.nome_da_criana}} está completando mais um ano de vida!
A Fada do Dente e todos os Guardiões desejam um novo ciclo cheio de aventuras, descobertas, saúde e sorrisos mágicos! Que continue espalhando alegria por onde passar!
Com muito carinho,
Sua família Dental Beauty Kids 💖
```

---

# 2 · RÉGUA — Confirmação de consulta

Gatilho: Tag de contato · `regua-confirmacao`

> **Pendência técnica:** hoje o motor dispara um evento só, 24h antes. O lembrete de 2h precisa de
> uma segunda rodada diária no cron. Montar os 4 ramos mesmo assim; os de 2h ficam inertes até a
> rodada existir.

## 2.1 · 24h antes · trilha = adulto

```
✨ Olá, {{contact.first_name}}!
Estamos preparando tudo para receber você com muito carinho na Dental Beauty. 🤍
Sua consulta está agendada para amanhã:
📅 {{contact.regua__dia}}
🕒 {{contact.regua__hora}}
Pode confirmar sua presença com um SIM? Se precisar de outro horário, responda NÃO que encontramos uma nova opção para você.
```

## 2.2 · 24h antes · trilha = infantil

```
✨ Olá, família de {{contact.nome_da_criana}}!
Estamos preparando tudo com muito carinho para a próxima aventura no Reino dos Guardiões. 💖
A consulta está agendada para amanhã:
📅 {{contact.regua__dia}}
🕒 {{contact.regua__hora}}
Pode confirmar a presença com um SIM? Se precisar remarcar, responda NÃO que encontramos outro horário.
```

## 2.3 · 2h antes · trilha = adulto

```
Olá, {{contact.first_name}}! ✨ Sua consulta é hoje, às {{contact.regua__hora}}.
Nossa equipe já está esperando por você. Se surgir qualquer imprevisto, é só nos avisar por aqui. 🤍
```

## 2.4 · 2h antes · trilha = infantil

```
🧚 Olá, família de {{contact.nome_da_criana}}! A consulta é hoje, às {{contact.regua__hora}}.
Estamos esperando vocês com carinho. Qualquer imprevisto, é só nos avisar por aqui. 💖
```

---

# 3 · RÉGUA — Retorno pós-procedimento

Gatilho: Tag de contato · `regua-posprocedimento`

Ramificar por `{{contact.ltimo_procedimento}}`. O prazo de cada um já é decidido no backend
(`intervalMonthsForCategory`), então o workflow só escolhe o texto.

## 3.1 · Limpeza · 6 meses

```
✨ Olá, {{contact.first_name}}! Como você está?
Já se passaram seis meses desde o seu último cuidado preventivo aqui na Dental Beauty. 🤍
Manter o sorriso saudável é um compromisso que construímos juntos, e a prevenção faz toda a diferença ao longo dos anos.
Que tal reservarmos um momento para cuidar de você novamente? Conte qual período da sua semana é mais tranquilo, e organizamos tudo.
```

## 3.2 · Clareamento · 6 meses

```
✨ Olá, {{contact.first_name}}!
Lembra daquele sorriso iluminado que conquistamos juntos? Seu clareamento completou seis meses. 🤍
Com o tempo e os hábitos do dia a dia, pode ser interessante avaliarmos a manutenção do resultado e orientar os próximos cuidados.
Qual dia da semana fica melhor para você vir ver como está o seu sorriso?
```

## 3.3 · Restauração · 6 meses

```
Olá, {{contact.first_name}}! 🤍
Aqui na Dental Beauty, nosso cuidado continua mesmo depois que o tratamento termina.
Sua restauração completou seis meses, e queremos convidar você para uma revisão: conferimos a adaptação, a integridade e como o trabalho se conserva com o tempo.
Qual é o melhor dia para encaixarmos essa revisão na sua rotina?
```

## 3.4 · Canal · 6 meses

```
Olá, {{contact.first_name}}! Tudo bem? ✨
Seu tratamento de canal completou seis meses, e chegou o momento de acompanhar a evolução.
Mesmo quando está tudo bem e não há desconforto, a revisão clínica e, quando indicada, a radiografia confirmam que o dente segue saudável.
Queremos ter certeza de que tudo evolui como esperado. Qual dia funciona melhor para você? 🤍
```

## 3.5 · Coroa / Prótese · 12 meses

```
✨ Olá, {{contact.first_name}}!
Seu sorriso passou por uma transformação importante conosco, e sua prótese completou um ano.
É o momento de avaliarmos a adaptação, a mordida e a saúde da gengiva ao redor, para preservar o conforto e a durabilidade do tratamento.
Vamos celebrar esse primeiro ano cuidando dela? Qual período da semana fica mais confortável para você? 🤍
```

## 3.6 · Implante · 12 meses

```
Olá, {{contact.first_name}}! 🤍
Um implante representa muito mais do que um novo dente: representa conforto, segurança e qualidade de vida.
Por isso fazemos questão de acompanhar você depois da conclusão do tratamento. Já faz um ano, e é o momento de avaliarmos a gengiva, a estabilidade do implante e os cuidados de manutenção.
Qual semana fica melhor para você vir?
```

## 3.7 · Tratamento periodontal · 3 meses

```
Olá, {{contact.first_name}}! Tudo bem? 🌿
Você sabia que a saúde da gengiva é essencial para preservar os dentes ao longo da vida?
Seu tratamento periodontal completou três meses, e esta é a manutenção mais importante: acompanhamos sua evolução e mantemos a gengiva saudável e estável.
Qual dia da semana fica mais fácil para você manter essa constância com a gente?
```

## 3.8 · Ortodontia adulto · 6 meses

```
✨ Olá, {{contact.first_name}}!
Cada etapa do tratamento ortodôntico faz parte do sorriso que planejamos juntos.
Já se passaram seis meses desde o seu último acompanhamento, e a regularidade das consultas é o que mantém o planejamento no caminho certo, seja na evolução do tratamento ou na contenção.
Vamos proteger o sorriso que você está construindo? Qual dia da semana é melhor para você? 🤍
```

## 3.9 · Invisalign · 6 meses

```
Olá, {{contact.first_name}}! ✨
Como está sendo sua experiência com os alinhadores?
Seu novo sorriso está sendo construído etapa por etapa, e queremos acompanhar cada detalhe: o encaixe dos alinhadores, o progresso dos movimentos e as próximas etapas do planejamento.
Quando fica bom para você passar aqui? Separamos um tempo com calma para essa consulta. 🤍
```

## 3.10 · Lente / Faceta · 6 meses

```
✨ Olá, {{contact.first_name}}!
Um sorriso bonito merece continuar recebendo cuidados especiais.
Suas lentes ou facetas completaram seis meses, e queremos convidar você para uma revisão: avaliamos o acabamento, a saúde da gengiva e os cuidados para preservar a estética e a função do seu sorriso.
Qual momento da sua semana combina com essa visita? Será um prazer receber você novamente. 🤍
```

## 3.11 · Limpeza · infantil

```
🧚✨ Olá, família de {{contact.nome_da_criana}}!
Temos uma mensagem especial do Reino dos Guardiões!
Está chegando o momento de conferir como estão os dentinhos e continuar a missão de proteger o sorriso. Cada visita é uma nova oportunidade de aprender, cuidar e criar memórias felizes! 💖
Qual dia da semana encaixa melhor na rotina de vocês para a próxima aventura?
```

## 3.12 · Restauração · infantil

```
🧚✨ Olá, família de {{contact.nome_da_criana}}!
No Reino dos Guardiões, toda conquista merece acompanhamento!
Chegou o momento de revisar a restauração e conferir que está tudo certinho, numa consulta tranquila e no ritmo da criança. 💖
Qual dia fica mais tranquilo para vocês?
```

## 3.13 · Ortodontia · infantil

```
🦸✨ Atenção, família de {{contact.nome_da_criana}}!
Nosso Guardião do Sorriso tem uma nova missão!
Nessa fase de crescimento o sorriso muda rápido, e cada acompanhamento ortodôntico ajuda a observar a evolução e a orientar os próximos passos. E, claro, tem uma experiência cheia de carinho esperando por aqui! 💙
Qual dia da semana encaixa melhor na rotina da família?
```

---

# 4 · RÉGUA — Pesquisa de satisfação

Gatilho: Tag de contato · `regua-nps`

> **Reformulada em 11/11/2026 pelo cliente.** Saiu o NPS de 0 a 10 e entrou uma escala de
> **1 a 5 estrelas**. Quem dá 5 recebe o convite para avaliar no Google; **4 ou menos** vira
> conversa: perguntamos o que houve e avisamos que alguém da equipe entra em contato em breve.

**Quando dispara:** o motor marca a tag para quem compareceu, mas o **primeiro passo do workflow é
uma condição em `{{contact.nps__nota}}`**: só segue quem tem o campo **vazio**. Quem já deu nota
sai do fluxo.

Isso atende o pedido do cliente ("pós avaliação ou no decorrer do tratamento, de quem não avaliou
ainda") sem precisar adivinhar qual consulta era a avaliação: cada paciente é convidado uma vez
só, e se ele não responder a pergunta volta na consulta seguinte.

A nota que o paciente responde é tratada pelo agente, não pelo workflow.

## 4.1 · trilha = adulto

```
Olá, {{contact.first_name}}! 🤍
Foi um prazer receber você na Dental Beauty!
Queremos que cada visita seja marcada por acolhimento, confiança e uma experiência verdadeiramente especial, e a sua opinião nos ajuda a evoluir.
De 1 a 5 estrelas, como foi a sua experiência com a gente? ⭐
```

## 4.2 · trilha = infantil

```
Olá, família de {{contact.nome_da_criana}}! 💖
Foi uma alegria receber vocês no Reino dos Guardiões!
Se quiser, conte também o que {{contact.nome_da_criana}} achou da aventura: adoramos saber.
E, para nos ajudar a evoluir: de 1 a 5 estrelas, como foi a experiência de vocês? ⭐
```

## 4.3 · Respostas por nota (vão no prompt do agente)

O agente grava a nota em `NPS - Nota` e responde conforme a faixa. O link do Google **muda por
unidade**, então o agente escolhe pelo campo `{{contact.unidade}}`.

### 5 estrelas · unidade = Recreio

```
Que alegria ler isso, {{contact.first_name}}! 🤍
Se puder, conte em poucas palavras como foi a sua experiência no Google. Isso ajuda outras pessoas a nos conhecerem com confiança:
https://g.page/r/CQZuDgYFDS09EBM/review
```

### 5 estrelas · unidade = Ipanema

```
Que alegria ler isso, {{contact.first_name}}! 🤍
Se puder, conte em poucas palavras como foi a sua experiência no Google. Isso ajuda outras pessoas a nos conhecerem com confiança:
https://g.page/r/CUGB4w0QxtsmEBM/review
```

### 4 estrelas ou menos

```
Agradecemos a sinceridade, {{contact.first_name}}. 🤍
Queremos entender o que aconteceu e fazer diferente. Pode contar aqui o que faltou?
Uma pessoa da nossa equipe entra em contato com você em breve.
```

---

# 5 · RÉGUA — Reengajamento

Gatilho: Tag de contato · `regua-inatividade-6` e `regua-inatividade-12`

A faixa de meses vem na própria tag: um workflow para `regua-inatividade-6` e outro para
`regua-inatividade-12`, cada um ramificando só por `{{contact.trilha}}`. Quem voltou já é excluído
no backend.

> **Atenção:** a consultoria tem uma campanha publicada chamada "6+ meses sem vir". Antes de
> publicar esta régua, confirmar a divisão com eles — senão o paciente recebe as duas.

## 5.1 · 12 meses · trilha = adulto

```
✨ Olá, {{contact.first_name}}! Como você está?
Revisando os acompanhamentos dos nossos pacientes, percebemos que já faz um ano desde a sua última visita.
Seguimos com o mesmo compromisso: cuidar de você de forma personalizada, com atenção a cada detalhe. Gostaríamos muito de saber como está o seu sorriso e de convidar você para uma nova avaliação preventiva.
Que tal começar esse novo cuidado ainda este mês? Conte qual período fica melhor, e nós organizamos tudo. 🤍
```

## 5.2 · 6 meses · trilha = adulto

```
Olá, {{contact.first_name}}! 🤍
Já se passaram seis meses desde a sua última consulta.
Manter esse acompanhamento é o jeito mais leve de cuidar do sorriso: aqui, você vem para se cuidar, e não só quando aparece um problema.
Qual dia da sua semana combina com esse cuidado? O resto, deixe com a gente. ✨
```

## 5.3 · 12 meses · trilha = infantil

```
🧚✨ Psiu, família de {{contact.nome_da_criana}}!
A Fada do Dente estava olhando o livro de aventuras e percebeu que faz tempo que nosso Guardião não aparece por aqui. Estamos com saudades!
Muitas aventuras aconteceram desde a última visita, e adoraríamos ver como esse sorriso cresceu. 💖
Vamos preparar esse reencontro? Conte qual dia fica melhor para vocês.
```

## 5.4 · 6 meses · trilha = infantil

```
🧚✨ Olá, família de {{contact.nome_da_criana}}!
Já se passaram seis meses desde a última aventura no Reino dos Guardiões.
Cada visita reforça os bons hábitos em casa e ajuda a criança a cuidar, cada vez mais, do próprio sorriso. 💖
Qual dia da semana combina com a rotina de vocês para essa próxima missão?
```

---

# Sugestões novas

As três respostas de nota saíram daqui: viraram a escala de 1 a 5 e estão na
[régua 4](#43--respostas-por-nota-vão-no-prompt-do-agente).

## 6 · RÉGUA — Cuidado no dia seguinte · **aprovada em 11/11/2026**

Gatilho: Tag de contato · `regua-poscirurgia`

Decisão do cliente: **automatizar para todos**, adulto e infantil, que fizeram cirurgia, extração
ou canal. O objetivo é saber se a pessoa está bem no dia seguinte.

Backend pronto: `runPosCirurgia` lê as consultas atendidas de ontem e filtra pelo procedimento.
O casamento é por radical no texto livre da Clinicorp: `cirurg`, `exodontia`, `extraçã/extraçõ`,
`canal`, `endodont`, `frenectomia`.

> **Implante ficou de fora de propósito.** A colocação é cirúrgica, mas a mesma categoria cobre as
> etapas protéticas. Incluir mandaria "como você está depois do procedimento de ontem?" para quem
> só foi ajustar a prótese. Se o cliente quiser incluir, é uma linha em
> `isProcedimentoCirurgico`.

## 6.1 · trilha = adulto

```
Olá, {{contact.first_name}}! 🤍 Passando para saber como você está depois do procedimento de ontem.
Se sentir algo diferente do que o dentista explicou, é só nos chamar por aqui que nossa equipe orienta você.
```

## 6.2 · trilha = infantil

```
🧚 Olá, família de {{contact.nome_da_criana}}! 💖
Passando para saber como {{contact.nome_da_criana}} está se sentindo depois do procedimento de ontem.
Se notarem algo diferente do que o dentista explicou, é só chamar por aqui que nossa equipe orienta vocês.
```

## Criança que concluiu o tratamento · ainda sem resposta

Gatilho que falta: **tratamento marcado como concluído** na Clinicorp. Precisa verificar se a API
expõe esse estado; se não expuser, depende de marcação manual.

```
✨ Olá, família de {{contact.nome_da_criana}}!
Lembram de toda a jornada que vivemos juntos para cuidar desse sorriso? Foi uma conquista muito especial! 🏰
Agora queremos continuar fazendo parte dessa história, acompanhando o crescimento e preservando os resultados alcançados. Aqui na Dental Beauty Kids, nossa missão não termina quando o tratamento acaba.
Qual dia da semana fica melhor para a próxima visita preventiva? 💖
```
