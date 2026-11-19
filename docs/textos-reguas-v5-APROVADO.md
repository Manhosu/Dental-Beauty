# Textos das réguas — v5, de 19/11/2026

Recebido em 19/11/2026: *"Mensagens automáticas da Dental Beauty, versão 5"*. **Mesmos textos da
v4** — o que mudou é só a **formatação**, pedida pelo Bruno depois de ver as mensagens reais que
saíram na manhã de 19/11:

1. emoji no **fim da saudação**, não no meio do texto;
2. **linha em branco** entre os blocos;
3. a **pergunta final em linhas próprias**;
4. um **emoji fechando** cada mensagem, sozinho na última linha.

> O motivo é concreto: no WhatsApp, texto sem linha em branco vira um paredão. O exemplo que ele
> mandou foi o lembrete do dia que saiu hoje para 23 pacientes.

## Como os campos viram variável no GHL

| No documento | No painel |
|---|---|
| `[Nome]` | `{{contact.first_name}}` |
| `[ nome do filho(a) ]` | `{{contact.nome_da_criana}}` |
| `[hora]` | `{{contact.rgua__hora}}` |
| `[dia]` | `{{contact.rgua__dia}}` |
| `[link da anamnese da especialidade]` | `{{contact.anamnese__link}}` |
| `[link do Google]` | está na base de conhecimento, por unidade — a Clara busca lá |

No editor do painel, a linha em branco se faz com **`Shift+Enter` duas vezes**. Digitar
`{{contact.campo}}` cria o chip sozinho.

## Como editar sem quebrar — o que foi aprendido em 19/11

Três armadilhas, todas descobertas no braço:

1. **Expanda o painel antes de qualquer `Ctrl+A`.** Com o painel na lateral, o clique no editor
   muitas vezes não pega o foco e o `Ctrl+A` vai para o **canvas** — que seleciona todos os nós.
   O botão de expandir é o `⤢` ao lado de "Saiba mais". Ele é um *toggle*: se o painel já estiver
   expandido de um nó anterior, clicar de novo **colapsa**. Confira na tela antes.
2. **Nunca termine um trecho digitado logo depois de uma variável.** Digitar `{{contact.campo}}`
   abre o seletor de variáveis, e o `Enter` seguinte **escolhe o item destacado da lista** em vez
   de quebrar a linha. Como a lista vem ordenada por nome, o item destacado é quase sempre
   **"Anamnese - Link"** — foi assim que o chip da data virou link da anamnese duas vezes. Sempre
   escreva algo depois da variável (`.`, `,`, mais texto) antes da quebra de linha.
3. **Salve o fluxo a cada ação, não só no fim.** "Salvar ação" guarda a mensagem no editor, mas
   só o **"Salvar"** do cabeçalho grava no workflow. Recarregar a página sem ele descarta tudo —
   inclusive ações já "salvas". O navegador avisa com um *beforeunload*; esse aviso é a pista.

E **confira o chip na tela antes de salvar**. O painel às vezes renderiza o rótulo errado em
mensagem recém-carregada (mostrou "Anamnese - Link" onde o dado real era "Régua - Dia"); redigitar
a variável corrige a exibição.

## Estado da aplicação no painel — 19/11/2026

| Régua | Adulto | Infantil |
|---|---|---|
| Lembrete do dia | ✅ | ✅ |
| Confirmação de consulta | ✅ | ✅ |
| Aniversário | ✅ | ✅ |
| Pesquisa de satisfação | ✅ | ✅ |
| Sem confirmação (12h, 19h, horário liberado) | ✅ (as três) | — |
| Anamnese (D-2) | ✅ | ✅ |
| Anamnese lembrete (D-1) | ✅ | ✅ |
| Pesquisa em tratamento | ✅ | — |
| Cuidado no dia seguinte | ✅ | **pendente** |
| Reengajamento 6 meses | **pendente** | **pendente** |
| Reengajamento 12 meses | **pendente** | **pendente** |
| Retorno pós-procedimento | **pendente** (10 textos) | **pendente** (3 textos) |

**18 mensagens aplicadas, conferidas uma a uma na tela antes de salvar.** As pendentes seguem no
formato antigo — funcionam, só estão sem as linhas em branco.

> A régua "Sem confirmação" foi furada na fila de propósito: ela dispara às 12h, e a troca entrou
> a tempo do envio de 19/11.

---

## Retorno pós-procedimento

### Limpeza · 6 meses

```
Olá, {{contact.first_name}}! Como você está? ✨

Já se passaram seis meses desde o seu último cuidado preventivo aqui na Dental Beauty.
Manter o sorriso saudável é um compromisso que construímos juntos, e a prevenção faz toda a diferença ao longo dos anos.

Que tal reservarmos um momento para cuidar de você novamente?
Conte qual período da sua semana é mais tranquilo, e organizamos tudo.

😃
```

### Clareamento · 6 meses

```
Olá, {{contact.first_name}}! ✨

Lembra daquele sorriso iluminado que conquistamos juntos? Seu clareamento completou seis meses.
Com o tempo e os hábitos do dia a dia, pode ser interessante avaliarmos a manutenção do resultado e orientar os próximos cuidados.

Qual dia da semana fica melhor para você vir ver como está o seu sorriso?

😁
```

### Restauração · 6 meses

```
Olá, {{contact.first_name}}! 🤍

Aqui na Dental Beauty, nosso cuidado continua mesmo depois que o tratamento termina.
Sua restauração completou seis meses, e queremos convidar você para uma revisão: conferimos a adaptação, a integridade e como o trabalho se conserva com o tempo.

Qual é o melhor dia para encaixarmos essa revisão na sua rotina?

😊
```

### Canal · 6 meses

```
Olá, {{contact.first_name}}! Tudo bem? ✨

Seu tratamento de canal completou seis meses, e chegou o momento de acompanhar a evolução.
Mesmo quando está tudo bem e não há desconforto, a revisão clínica e, quando indicada, a radiografia confirmam que o dente segue saudável.

Queremos ter certeza de que tudo evolui como esperado.
Qual dia funciona melhor para você?

🦷
```

### Coroa / Prótese · 12 meses

```
Olá, {{contact.first_name}}! ✨

Seu sorriso passou por uma transformação importante conosco, e sua prótese completou um ano.
É o momento de avaliarmos a adaptação, a mordida e a saúde da gengiva ao redor, para preservar o conforto e a durabilidade do tratamento.

Vamos celebrar esse primeiro ano cuidando dela?
Qual período da semana fica mais confortável para você?

😃
```

### Implante · 12 meses

```
Olá, {{contact.first_name}}! 🤍

Um implante representa muito mais do que um novo dente: representa conforto, segurança e qualidade de vida.
Por isso fazemos questão de acompanhar você depois da conclusão do tratamento. Já faz um ano, e é o momento de avaliarmos a gengiva, a estabilidade do implante e os cuidados de manutenção.

Qual semana fica melhor para você vir?

😁
```

### Tratamento periodontal · 3 meses

```
Olá, {{contact.first_name}}! Tudo bem? 🌿

Você sabia que a saúde da gengiva é essencial para preservar os dentes ao longo da vida?
Seu tratamento periodontal completou três meses, e esta é a manutenção mais importante: acompanhamos sua evolução e mantemos a gengiva saudável e estável.

Qual dia da semana fica mais fácil para você manter essa constância com a gente?

😊
```

### Ortodontia adulto · 6 meses

```
Olá, {{contact.first_name}}! ✨

Cada etapa do tratamento ortodôntico faz parte do sorriso que planejamos juntos.
Já se passaram seis meses desde o seu último acompanhamento, e a regularidade das consultas é o que mantém o planejamento no caminho certo, seja na evolução do tratamento ou na contenção.

Vamos proteger o sorriso que você está construindo?
Qual dia da semana é melhor para você?

😃
```

### Invisalign · 6 meses

```
Olá, {{contact.first_name}}! ✨

Como está sendo sua experiência com os alinhadores?
Seu novo sorriso está sendo construído etapa por etapa, e queremos acompanhar cada detalhe: o encaixe dos alinhadores, o progresso dos movimentos e as próximas etapas do planejamento.

Quando fica bom para você passar aqui?
Separamos um tempo com calma para essa consulta.

😁
```

### Lente / Faceta · 6 meses

```
Olá, {{contact.first_name}}! ✨

Um sorriso bonito merece continuar recebendo cuidados especiais.
Suas lentes ou facetas completaram seis meses, e queremos convidar você para uma revisão: avaliamos o acabamento, a saúde da gengiva e os cuidados para preservar a estética e a função do seu sorriso.

Qual momento da sua semana combina com essa visita?
Será um prazer receber você novamente.

😍
```

---

## Aniversário

```
Feliz aniversário, {{contact.first_name}}! 🎂✨

Hoje queremos celebrar você!
Que este novo ciclo seja repleto de saúde, conquistas, momentos felizes e muitos motivos para sorrir.
É um privilégio fazer parte da sua história e cuidar de algo tão especial: o seu sorriso.

Com carinho,
Equipe Dental Beauty

🥳
```

---

## Lembrete de consulta

### Confirmação · D-4 às 8h (ou D-2 se agendou de 5 a 3 dias antes)

```
Olá, {{contact.first_name}}! ✨

Estamos preparando tudo para receber você com muito carinho na Dental Beauty.
Sua consulta está agendada para:
📅 {{contact.rgua__dia}}
🕒 {{contact.rgua__hora}}

Pode confirmar sua presença com um SIM?
Se precisar de outro horário, responda NÃO que encontramos uma nova opção para você.

😊
```

### Lembrete do dia · 8h do dia da consulta, todos os agendados

```
Bom dia, {{contact.first_name}}! ☀️

Hoje é dia da sua consulta na Dental Beauty, às {{contact.rgua__hora}}. Estamos esperando por você.

Se surgir algum imprevisto, consegue nos avisar por aqui o quanto antes?
Assim remarcamos com calma e o horário pode atender outro paciente.

😃
```

---

## Pesquisa de satisfação

Depois da 1ª consulta atendida e, para quem está em tratamento, a cada 3 consultas atendidas.

```
Olá, {{contact.first_name}}! 🤍

Foi um prazer receber você na Dental Beauty!
Queremos que cada visita seja marcada por acolhimento, confiança e uma experiência verdadeiramente especial, e a sua opinião nos ajuda a evoluir.

De 1 a 5, como você avalia a sua experiência com a gente?

😊
```

---

## Reengajamento de inativos

### 12 meses sem vir

```
Olá, {{contact.first_name}}! Como você está? ✨

Revisando os acompanhamentos dos nossos pacientes, percebemos que já faz um ano desde a sua última visita.
Seguimos com o mesmo compromisso: cuidar de você de forma personalizada, com atenção a cada detalhe. Gostaríamos muito de saber como está o seu sorriso e de convidar você para uma nova avaliação preventiva.

Que tal começar esse novo cuidado ainda este mês?
Conte qual período fica melhor, e nós organizamos tudo.

😃
```

### 6 meses sem vir

```
Olá, {{contact.first_name}}! 🤍

Já se passaram seis meses desde a sua última consulta.
Manter esse acompanhamento é o jeito mais leve de cuidar do sorriso: aqui, você vem para se cuidar, e não só quando aparece um problema.

Qual dia da sua semana combina com esse cuidado?
O resto, deixe com a gente.

😁
```

---

## Trilha infantil — Dental Beauty Kids

### Limpeza infantil

```
Olá, família de {{contact.nome_da_criana}}! 🧚✨

Temos uma mensagem especial do Reino dos Guardiões!
Está chegando o momento de conferir como estão os dentinhos e continuar a missão de proteger o sorriso. Cada visita é uma nova oportunidade de aprender, cuidar e criar memórias felizes!

Qual dia da semana encaixa melhor na rotina de vocês para a próxima aventura?

😃
```

### Restauração infantil

```
Olá, família de {{contact.nome_da_criana}}! 🧚✨

No Reino dos Guardiões, toda conquista merece acompanhamento!
Chegou o momento de revisar a restauração e conferir que está tudo certinho, numa consulta tranquila e no ritmo da criança.

Qual dia fica mais tranquilo para vocês?

💖
```

### Ortodontia infantil

```
Atenção, família de {{contact.nome_da_criana}}! 🦸✨

Nosso Guardião do Sorriso tem uma nova missão!
Nessa fase de crescimento o sorriso muda rápido, e cada acompanhamento ortodôntico ajuda a observar a evolução e a orientar os próximos passos. E, claro, tem uma experiência cheia de carinho esperando por aqui!

Qual dia da semana encaixa melhor na rotina da família?

😃
```

### Aniversário infantil

```
Hoje é dia de festa no Reino dos Guardiões! 🎂🧚✨

{{contact.nome_da_criana}} está completando mais um ano de vida!
A Fada do Dente e todos os Guardiões desejam um novo ciclo cheio de aventuras, descobertas, saúde e sorrisos mágicos! Que continue espalhando alegria por onde passar!

Com muito carinho,
Sua família Dental Beauty Kids

🥳
```

### Confirmação D-4 (ou D-2) infantil

```
Olá, família de {{contact.nome_da_criana}}! ✨

Estamos preparando tudo com muito carinho para a próxima aventura no Reino dos Guardiões.
A consulta está agendada para:
📅 {{contact.rgua__dia}}
🕒 {{contact.rgua__hora}}

Pode confirmar a presença com um SIM?
Se precisar remarcar, responda NÃO que encontramos outro horário.

🧚
```

### Lembrete do dia, 8h · infantil

```
Bom dia, família de {{contact.nome_da_criana}}! 🧚

Hoje a Fada do Dente espera {{contact.nome_da_criana}} às {{contact.rgua__hora}}.

Se surgir algum imprevisto, conseguem nos avisar por aqui o quanto antes?
Assim remarcamos com calma e o horário pode atender outra criança.

💖
```

### Pesquisa de satisfação infantil

```
Olá, família de {{contact.nome_da_criana}}! 💖

Foi uma alegria receber vocês no Reino dos Guardiões!
Se quiser, conte também o que {{contact.nome_da_criana}} achou da aventura: adoramos saber.

E, para nos ajudar a evoluir: de 1 a 5, como vocês avaliam a experiência com a gente?

😊
```

### Reengajamento 12 meses infantil

```
Psiu, família de {{contact.nome_da_criana}}! 🧚✨

A Fada do Dente estava olhando o livro de aventuras e percebeu que faz tempo que nosso Guardião não aparece por aqui. Estamos com saudades!
Muitas aventuras aconteceram desde a última visita, e adoraríamos ver como esse sorriso cresceu.

Vamos preparar esse reencontro?
Conte qual dia fica melhor para vocês.

🏰
```

### Reengajamento 6 meses infantil

```
Olá, família de {{contact.nome_da_criana}}! 🧚✨

Já se passaram seis meses desde a última aventura no Reino dos Guardiões.
Cada visita reforça os bons hábitos em casa e ajuda a criança a cuidar, cada vez mais, do próprio sorriso.

Qual dia da semana combina com a rotina de vocês para essa próxima missão?

😃
```

---

## Pesquisa para quem está em tratamento · a cada 3 consultas atendidas

```
Olá, {{contact.first_name}}! 🤍

Que bom acompanhar o seu tratamento de perto.

De 1 a 5, como você avalia as suas últimas consultas com a gente?

😊
```

---

## Respostas por nota — vivem no prompt da Clara, não no workflow

### Nota 5

```
Que alegria ler isso, {{contact.first_name}}! 🤍

Você toparia contar como foi a sua experiência no Google?
Leva um minuto e ajuda outras pessoas a conhecerem a Dental Beauty:
[link do Google da unidade]

😃
```

### Nota 4

```
Obrigada pela nota, {{contact.first_name}}! ✨

Queremos chegar no 5 com você.

O que faltou para a sua experiência ser completa?

😊
```

### Nota 1 a 3

```
Obrigada por contar, {{contact.first_name}}. 🤍

Sinto muito que a sua experiência não tenha sido como você esperava.
Uma pessoa da nossa equipe vai te chamar para entender o que aconteceu.

Qual o melhor horário para falar com você?

🙏
```

---

## Sem confirmação · 12h e 19h do dia da confirmação

```
Olá, {{contact.first_name}}! ✨

Ainda não recebemos a confirmação da sua consulta de {{contact.rgua__dia}} às {{contact.rgua__hora}}.

Para guardarmos o seu horário, responda SIM até as 22h de hoje.
Se precisar mudar, responda NÃO que encontramos outra opção.

😊
```

## Horário liberado · 8h do dia seguinte, sem confirmação

```
Olá, {{contact.first_name}}! 🤍

Como não recebemos a sua confirmação, liberamos o horário de {{contact.rgua__dia}} para outro paciente.
Sabemos que a rotina aperta, e queremos muito te receber.

Qual dia da semana fica melhor para remarcarmos?

😊
```

---

## Anamnese da especialidade · D-2, só primeira avaliação

```
Olá, {{contact.first_name}}! Faltam 2 dias para a sua avaliação. ✨

Para o dentista já chegar conhecendo um pouco da sua saúde, preparamos uma ficha rápida:
{{contact.anamnese__link}}

Leva poucos minutos. Consegue preencher até amanhã?

😃
```

---

## Cuidado no dia seguinte a cirurgia, extração ou canal

```
Olá, {{contact.first_name}}! 🤍

Passando para saber como você está depois do procedimento de ontem.

Se sentir algo diferente do que o dentista explicou, é só nos chamar por aqui que nossa equipe orienta você.

🙏
```

---

## Sugestões novas — **não entram sem aprovação**

O documento traz uma mensagem que **não existe hoje no sistema** e que o próprio v5 marca como
sugestão: *"Criança que concluiu o tratamento"*. Não foi montada. Entra só se for aprovada, e
precisa de um gatilho novo — hoje o backend não sabe dizer que um tratamento infantil terminou.

```
Olá, família de {{contact.nome_da_criana}}! ✨

Lembram de toda a jornada que vivemos juntos para cuidar desse sorriso? Foi uma conquista muito especial!
Agora queremos continuar fazendo parte dessa história, acompanhando o crescimento e preservando os resultados alcançados. Aqui na Dental Beauty Kids, nossa missão não termina quando o tratamento acaba.

Qual dia da semana fica melhor para a próxima visita preventiva?

🏰
```

---

## O que o v5 **não** traz, e continua valendo da v4

- A **anamnese D-1** (o lembrete de quem não preencheu) não aparece no v5. O texto da v4 segue no
  painel, e a formatação nova foi aplicada nele por coerência.
- O v5 não fala da **régua de quem já concluiu tratamento adulto** nem do **cuidado infantil no dia
  seguinte** — não existem.
