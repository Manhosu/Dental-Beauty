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
| Confirmação de consulta (96h antes) | `regua-confirmacao` |
| Lembrete da manhã (7h30, consultas de hoje) | `regua-lembrete-hoje` |
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
| `[dia]` | `{{contact.rgua__dia}}` | agenda |
| `[hora]` | `{{contact.rgua__hora}}` | agenda |

> **Atenção à grafia da tag:** é `rgua`, sem o "e" — o GHL monta a chave do campo tirando os
> acentos de "Régua - Dia" e o "é" some junto. Digitar `{{contact.regua__dia}}` não resolve para o
> campo certo. Os ids estão no `.env` (`GHL_FIELD_REGUA_DIA` / `GHL_FIELD_REGUA_HORA`) e os dois
> campos **existem** na location.

Campos usados só para ramificar, nunca no texto: `{{contact.trilha}}` e
`{{contact.ltimo_procedimento}}`.

> **Cuidado com a grafia da Trilha.** O campo é de opção única e as opções cadastradas são
> **"Adulto"** e **"Infantil"**, com inicial maiúscula. A API aceita gravar minúsculo sem reclamar,
> mas a condição do workflow compara com a opção: minúsculo faria todo mundo cair no ramo
> "Sem trilha" e ninguém receberia mensagem. O dispatcher já converte.


## Estado da montagem (12/11/2026)

Tudo em **rascunho**. Nada publicado.

| Workflow | Estado |
| --- | --- |
| `RÉGUA — Aniversário` | ✅ pronta |
| `RÉGUA — Pesquisa de satisfação` | ✅ pronta, escala 0 a 5, sem a trava de "já avaliou" |
| `RÉGUA — Cuidado no dia seguinte` | ✅ pronta |
| `RÉGUA — Reengajamento 6 meses` | ✅ pronta |
| `RÉGUA — Reengajamento 12 meses` | ✅ pronta |
| `RÉGUA — Confirmação de consulta` | ✅ pronta, agora com 96h de antecedência |
| `RÉGUA — Retorno pós-procedimento` | ✅ pronta, com as 13 mensagens |
| `RÉGUA — Lembrete do dia` | ✅ pronta (7h30) |

### Mudanças pedidas pela cliente em 12/11/2026

1. **Confirmação passou de 24h para 96h.** Com quatro dias, quem responde NÃO ainda dá tempo de a
   recepção oferecer a vaga. O texto perdeu o "amanhã": agora é "Sua consulta está agendada para:".
2. **O lembrete de 2h virou um aviso às 7h30** para todos os pacientes do dia. Régua própria,
   montada a partir de uma cópia da confirmação (tag `regua-lembrete-hoje`, segunda rodada do
   cron). O texto é o que estava reservado para o lembrete de 2h.
3. **Pesquisa de satisfação:** saiu "de 1 a 5 estrelas, como foi a experiência" e entrou
   **"de 0 a 5, o quanto você indicaria a Dental Beauty"**. As respostas viraram três faixas:
   5 → link do Google; 4 → "o que faltou para ser 5?"; 0 a 3 → um atendente entra em contato.
4. **A pesquisa não sai mais depois de toda consulta.** Agora é **a cada 3 vindas** — a trava
   "NPS - Nota está em branco" saiu do gatilho, porque ela impediria a segunda rodada. O
   espaçamento é contado no backend (`visitCounter.ts`).
5. **"Criança que concluiu o tratamento" está descartada por ora.** A Clinicorp não tem campo de
   alta: a conclusão só aparece escrita na ficha clínica, em texto livre. Sem um campo estruturado
   não há como disparar sozinho.

### Confirmado pela cliente em 13/11/2026

Duas dúvidas que tinham ficado abertas voltaram respondidas, e as duas bateram com o que já estava
montado — nada mudou no painel nem no código.

- **Escala 0 a 5 igual para adulto e infantil.** O documento dela trazia o infantil em "0 a 10",
  mas era descuido: a escala é a mesma nas duas trilhas. (As três faixas de resposta — 5 / 4 /
  0 a 3 — só fazem sentido em 0 a 5 mesmo.)
- **A pesquisa sai na 1ª vinda e depois a cada três** (1ª, 4ª, 7ª…). Palavras dela: *"quem vem
  apenas uma vez, sem problemas receber apenas uma vez e não responder"*. Ou seja, perguntar a
  quem aparece só uma vez é desejado, e silêncio na resposta não é problema. É o que
  `visitaPedePesquisa` faz.

### Como ficou o retorno pós-procedimento

Workflow `571fa3ad-e253-4d2c-a62c-e0bfcd47cb36`.

```
Tag adicionada includes "regua-posprocedimento"
  └─ Remove a tag para valer no proximo retorno
       └─ Trilha: adulto ou infantil
            ├─ Adulto → Procedimento (adulto)
            │    ├─ Limpeza             → Retorno Limpeza 6 meses
            │    ├─ Clareamento         → Retorno Clareamento 6 meses
            │    ├─ Restauracao         → Retorno Restauracao 6 meses
            │    ├─ Canal               → Retorno Canal 6 meses
            │    ├─ Coroa ou Protese    → Retorno Coroa ou Protese 12 meses
            │    ├─ Implante            → Retorno Implante 12 meses
            │    ├─ Periodontal         → Retorno Periodontal 3 meses
            │    ├─ Ortodontia adulto   → Retorno Ortodontia adulto 6 meses
            │    ├─ Invisalign          → Retorno Invisalign 6 meses
            │    ├─ Lente ou faceta     → Retorno Lente ou faceta 6 meses
            │    └─ Procedimento nao mapeado - nao envia → FIM
            ├─ Infantil → Procedimento (infantil)
            │    ├─ Limpeza infantil     → Retorno Limpeza infantil
            │    ├─ Restauracao infantil → Retorno Restauracao infantil
            │    ├─ Ortodontia infantil  → Retorno Ortodontia infantil
            │    └─ Procedimento nao mapeado - nao envia → FIM
            └─ Sem trilha - nao envia → FIM
```

A remoção da tag está **uma vez só, logo no início** — serve o fluxo inteiro, inclusive os ramos
que não enviam nada. Sem isso o paciente ficaria com a tag presa e a régua não voltaria a rodar.

Os ramos casam por **Contém** no campo `Último Procedimento`, com o radical entre aspas:
`Limpeza`, `Clareamento`, `Restaura`, `Canal`, `tese`, `Implante`, `Periodont`, `Ortodontia`,
`Invisalign`, `Lente`. No infantil: `Limpeza`, `Restaura`, `Ortodontia`.

> **A ordem dos ramos importa:** o GHL pega o **primeiro** que casar, e hoje `Ortodontia` (8º) vem
> antes de `Invisalign` (9º). Se a Clinicorp escrever "Ortodontia Invisalign", o paciente recebe o
> texto genérico de ortodontia em vez do de alinhadores. Não é erro grave — a mensagem continua
> fazendo sentido —, mas se a agenda real usar essa grafia vale subir o Invisalign pelo botão
> "Reordenar filiais".

> ⚠️ Dois casamentos merecem conferência quando a agenda real passar por aqui: **`tese`** foi
> escolhido para pegar "Prótese" (não pega "Coroa" sozinho) e **`Lente`** não pega "Faceta"
> sozinha. Se a Clinicorp usar essas palavras separadas, o paciente cai no ramo "não mapeado" e
> não recebe nada — que é o comportamento seguro, mas deixa de enviar.

### O que a agenda real devolve (medido em 13/11/2026)

A cliente disse que os procedimentos são classificados pelo nome da especialidade, e que daria para
pegar "pelo procedimento executado". Fui conferir na API antes de esperar a lista dela. **As duas
coisas não se confirmam.**

Período medido: 13/10 a 13/11/2026, **309 agendamentos** (`GET /appointment/list`).

| `CategoryDescription` | Qtd | Casa com algum ramo? |
| --- | ---: | --- |
| Consulta | 152 | não |
| Avaliação Recreio | 60 | não |
| Limpeza | 19 | **sim** |
| Avaliação para paciente - retorno(COBRADA) | 13 | não |
| Prótese retorno laboratório | 11 | **sim** (`tese`) |
| Escaneamento | 10 | não |
| Cirurgia | 8 | não (mas casa no cuidado do dia seguinte) |
| Revisão | 8 | não |
| Retorno Manutenção odontopediatria(COBRADA) | 6 | não |
| Avaliação Ipanema | 5 | não |
| Emergência | 4 | não |
| Clareamento | 3 | **sim** |
| Aparelho retorno laboratório | 3 | não |
| AGENDAMENTO  PENDENTE DE CONFIRMAÇÃO | 3 | não |
| (vazio) | 2 | não |
| Planejamento inicial | 1 | não |
| Instalação de aparelho(ortodontia) | 1 | **sim** (`Ortodontia`) |

Três conclusões:

1. **O campo não é especialidade.** As 25 especialidades existem
   (`GET /procedures/list_specialties`: Endodontia, Dentística, Implantodontia, Periodontia…), mas
   não é isso que chega no agendamento. `CategoryDescription` é categoria livre da agenda.
2. **`Procedures` está vazio em 306 dos 309.** O "procedimento executado" que a cliente sugeriu
   usar não é preenchido na rotina da recepção. Não dá para apoiar a régua nele **hoje** — mas é
   nele que está a saída, ver a seção seguinte.
3. **Só 34 dos 309 casam com algum ramo** (~11%). Seis dos dez ramos adultos — `Restaura`, `Canal`,
   `Implante`, `Periodont`, `Invisalign`, `Lente` — não aparecem **uma única vez** no mês.

Ou seja: a lista que a cliente ficou de montar **não resolve sozinha**. O problema não é a grafia
estar diferente, é a agenda não registrar o procedimento. O catálogo de procedimentos existe
(`GET /procedures/list` devolve `ProcedureName` + `ProcedureExpertiseName` ligados à tabela de
preços), mas ele diz o que a clínica vende, não o que o paciente fez.

Tentativas que deram 404: `/procedures/list_procedures`, `/procedures/list_procedures_by_specialty`,
`/patient/treatments`, `/budget/list`. Se um dia aparecer uma rota de evolução/ficha clínica, é por
ali que o problema se resolve de verdade.

**O que foi feito com isso (13/11):** `temTextoDeRetorno` em `jobs.ts` passou a filtrar antes do
dispatch. Sem ele, o default de 6 meses do `intervalMonthsForCategory` mandava **todos** os
atendidos para o GHL — uns 150 "Consulta" por mês — só para o workflow descartar no ramo
"Procedimento nao mapeado". Gastava chamada de API e escrevia tag + campo no contato à toa. O
resultado final para o paciente é o mesmo (silêncio), mas agora para no backend.

Os seis ramos sem movimento **ficaram montados**. Não atrapalham, não disparam, e passam a valer
sozinhos no dia em que a agenda começar a registrar o procedimento.

### O sistema puxa orçamento aprovado? (pergunta da cliente, 13/11/2026)

**Rota dedicada de orçamento não existe.** Testei ~35 nomes plausíveis (`/budget/*`, `/treatment/*`,
`/patient/budget*`, `/patient/treatment*`, `/evolution/*`, `/clinical/*`) e todos devolvem
`404 Cannot GET`. O que existe e responde: `/patient/get`, `/patient/birthdays`,
`/patient/list_appointments`, `/appointment/list`, `/appointment/status_list`,
`/appointment/get_avaliable_times_calendar`, `/appointment/cancel_appointment`, `/procedures/list`,
`/procedures/list_specialties`, `/professional/list_all_professionals`, `/business/list_chairs`.

**Mas o orçamento chega pelo agendamento.** O `/appointment/list` traz dois campos que eu não
estava usando:

- **`Procedures`** — texto do procedimento, vindo da tabela de preços. Ex.: `"22 - Tratamento
  endodôntico 1 canal"`.
- **`SelectedProceduresList`** — o mesmo em estruturado. Quando o agendamento está vinculado a um
  **orçamento aprovado**, cada item vem com `TreatmentId`, `Tooth`, `Amount`/`FinalAmount`,
  `PaymentPlanId`, `StatusId`, `BillType` e um marcador **`Executed`**.

Caso real de 07/11/2026: `CategoryDescription` = `"Consulta"`, mas `Procedures` = `"22 - Tratamento
endodôntico 1 canal"` e a lista estruturada trazia `TreatmentId: 4966846963384321`, `Tooth: "11"`,
`FinalAmount: 1800`. **A informação certa estava lá, e a régua estava olhando para o campo errado.**

Frequência: preenchido em **3 de 309** (1%).

**O que foi feito:** `procedimentoDoAtendimento` passa a preferir `Procedures` e só cai em
`CategoryDescription` quando ele vier vazio. Vale para o retorno e para o cuidado do dia seguinte.
Hoje muda pouco (são 3 casos), mas é a ordem certa: no dia em que a clínica vincular o procedimento
ao agendamento, a régua acerta sozinha, sem mexer em código nem no painel.

**Consequência para a conversa com a cliente.** O pedido muda. Não é "escrevam o procedimento na
categoria da agenda" (texto livre, erra na digitação) — é **"vinculem o procedimento do orçamento
ao agendamento"**, que é campo estruturado, sai da tabela de preços e não tem como escrever errado.
Se um dia valer a pena, `Executed` ainda permite distinguir o que foi de fato executado do que só
estava orçado.

**O que continua fora de alcance:** orçamento aprovado **sem** agendamento vinculado. Esse a API
não entrega por nenhum caminho que eu tenha encontrado.

### O que ficou em aberto

1. **Antes de publicar**, escolher o número de saída em cada workflow:
   Configurações do fluxo → Comunicação → Número de origem → canal **#3 (Disparos)**.
2. **Decisão da cliente sobre o retorno pós-procedimento.** Hoje ele cobre Limpeza, Clareamento,
   Prótese e Ortodontia — o que a agenda sustenta. Para cobrir o resto, a recepção precisa passar a
   escrever o procedimento na categoria do agendamento, e o efeito só aparece daqui a 3, 6 e 12
   meses (é a janela que a régua olha para trás).
3. **Reengajamento x campanha da consultoria:** eles já têm a campanha "6+ meses sem vir"
   publicada. Confirmar a divisão antes de publicar, senão o paciente recebe as duas.
4. **Dois rascunhos `New Workflow`** (criados em 08/10 e 09/11) estão na lista da subconta. Não
   são das réguas — são anteriores a esta montagem —, então ficaram de pé. Quem souber a origem
   que apague.

### Por que o lembrete de 2h antes não existiu

Ele não cabia no desenho: o motor dispara uma vez por dia, então não há como acertar "2 horas
antes" com uma espera de duração fixa. A cliente resolveu por outro caminho em 12/11 — um aviso
às 7h30 para todos os pacientes do dia —, que cabe numa segunda rodada diária e está montado
(régua 2b). Se um dia o lembrete de 2h voltar à pauta, o caminho é gravar a data/hora da consulta
num campo de data do contato e usar a espera "Até uma data/hora específica → Antes desta data".

## Estrutura: 8 workflows

Um workflow por régua, cada um disparado pela sua tag. Dentro dele, ramificação por
`{{contact.trilha}}` (e por procedimento quando precisa).

> ### ⚠️ Todo fluxo que envia mensagem tem de começar com `#2 `
>
> O nome do fluxo é o que diz à **4zapy** por qual número disparar. `#2` é o atendimento do call
> center e vale para **todas** as mensagens automáticas; `#3` é só para disparos de campanha, que
> são os da consultoria.
>
> O campo "Número de origem" em Configurações → Comunicação **fica vazio mesmo** — inclusive nos
> fluxos publicados que já funcionam. Não é lá que se escolhe o canal.
>
> As 12 réguas que enviam mensagem já foram renomeadas. `RÉGUA — Confirmação recebida` fica sem o
> prefixo: ela só marca uma tag, não envia nada.

| Workflow | Tag que dispara | Ramos | Mensagens |
| --- | --- | --- | --- |
| `RÉGUA — Aniversário` | `regua-aniversario` | trilha | 2 |
| `RÉGUA — Confirmação de consulta` | `regua-confirmacao` | trilha | 2 |
| `RÉGUA — Sem confirmação (12h, 19h e liberação)` | `regua-confirmacao` | — | 3 |
| `RÉGUA — Confirmação recebida` | *Cliente respondeu* | — | 0 (só marca tag) |
| `RÉGUA — Lembrete do dia` | `regua-lembrete-hoje` | trilha | 2 |
| `RÉGUA — Retorno pós-procedimento` | `regua-posprocedimento` | trilha × procedimento | 13 |
| `RÉGUA — Pesquisa de satisfação` | `regua-nps` | trilha | 2 |
| `RÉGUA — Pesquisa em tratamento` | `regua-nps-tratamento` | — | 1 |
| `RÉGUA — Reengajamento` | `regua-inatividade-6` e `-12` | trilha × tag | 4 |
| `RÉGUA — Cuidado no dia seguinte` | `regua-poscirurgia` | trilha | 2 |

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

Gatilho: Tag de contato · `regua-confirmacao` · **96h antes** (4 dias)

Workflow `0ba77435-ad9f-4331-93e9-22af8fcc30ab`. Montada: as duas mensagens já estão com o texto
de 96h, sem o "amanhã".

## 2.1 · 96h antes · trilha = adulto

```
✨ Olá, {{contact.first_name}}!
Estamos preparando tudo para receber você com muito carinho na Dental Beauty. 🤍
Sua consulta está agendada para:
📅 {{contact.rgua__dia}}
🕒 {{contact.rgua__hora}}
Pode confirmar sua presença com um SIM? Se precisar de outro horário, responda NÃO que encontramos uma nova opção para você.
```

## 2.2 · 96h antes · trilha = infantil

```
✨ Olá, família de {{contact.nome_da_criana}}!
Estamos preparando tudo com muito carinho para a próxima aventura no Reino dos Guardiões. 💖
A consulta está agendada para:
📅 {{contact.rgua__dia}}
🕒 {{contact.rgua__hora}}
Pode confirmar a presença com um SIM? Se precisar remarcar, responda NÃO que encontramos outro horário.
```

---

# 2b · RÉGUA — Lembrete do dia

Gatilho: Tag de contato · `regua-lembrete-hoje` · dispara às **8h**, para todos os pacientes
com consulta naquele dia. Workflow `e98741ba-e3a3-4d93-9c3a-10de387bafa7`.

`runLembreteHoje` lê a agenda de hoje e marca a tag na rodada matinal (11h UTC = 8h de Brasília).
Mesma forma da confirmação: gatilho por tag → If/else de trilha → mensagem → remove a tag ("Remove
a tag para valer amanha", senão o paciente não receberia o lembrete na próxima vez).

> Redação da **v4**, trocada no painel em 17/11/2026. O texto antigo era o de "2h antes" e só
> avisava; este **pede o aviso de volta**, que é o motivo de a cliente ter movido o lembrete para
> as 8h — dar tempo de chamar outro paciente para o horário.

## 2b.1 · trilha = adulto

```
Bom dia, {{contact.first_name}}! ☀️ Hoje é dia da sua consulta na Dental Beauty, às {{contact.rgua__hora}}, na unidade {{contact.unidade}}. Estamos te esperando 🤍
Se surgir algum imprevisto, consegue me avisar por aqui o quanto antes? Assim remarcamos com calma e o horário pode atender outro paciente.
```

## 2b.2 · trilha = infantil

```
Bom dia, família de {{contact.nome_da_criana}}! ☀️ Hoje a Fada do Dente espera {{contact.nome_da_criana}} às {{contact.rgua__hora}}, na unidade {{contact.unidade}} 🧚‍♀️
Se surgir algum imprevisto, conseguem me avisar por aqui o quanto antes? Assim remarcamos com calma.
```

> A **unidade** entrou em 18/11, com a v2 de 18/11 da cliente. Sem ela, quem é atendido em Ipanema
> podia aparecer no Recreio.

---

# 2c · RÉGUA — Sem confirmação (12h, 19h e liberação)

Gatilho: Tag de contato · `regua-confirmacao` — a **mesma** da régua 2, rodando em paralelo.
Workflow `c73e7007-21cc-4ba0-ade7-e7b0ed2fffb4`. **Rascunho, e não pode ser publicada ainda** (ver
`roteiro-ia-v2-cliente.md`: falta o `x-api-key` do webhook e o `LIBERAR_HORARIO_ATIVO`).

Quem responde qualquer coisa sai do fluxo sozinho (`Parar ao receber resposta`). Quem responde ao
*primeiro* pedido de SIM — que saiu da régua 2, não desta — é pego pela tag `consulta-confirmada`,
marcada pelo workflow `RÉGUA — Confirmação recebida` (`7e1f4dba-d429-4c04-9877-c47b45e2da85`).

## 2c.1 · Sem confirmação · 12h e 19h (mesmo texto nas duas)

```
{{contact.first_name}}, ainda não recebemos a confirmação da sua consulta de {{contact.rgua__dia}} às {{contact.rgua__hora}}.
Para guardarmos o seu horário, responda SIM até as 22h de hoje. Se precisar mudar, responda NÃO que encontramos outra opção. 🤍
```

## 2c.2 · Horário liberado · 8h do dia seguinte

```
Olá, {{contact.first_name}}! Como não recebemos a sua confirmação, liberamos o horário de {{contact.rgua__dia}} para outro paciente.
Sabemos que a rotina aperta, e queremos muito te receber. Qual dia da semana fica melhor para remarcarmos?
```

Antes desta mensagem o fluxo chama `POST /reguas/liberar-horario` com
`appointmentId = {{contact.rgua__agendamento}}`. A ordem é essa de propósito: a frase "liberamos o
seu horário" só sai depois de o horário ter sido liberado de fato.

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

> **Reformulada duas vezes pela cliente.** Em 11/11 saiu o NPS de 0 a 10 e entrou "1 a 5
> estrelas"; em 12/11 virou **"de 0 a 5, o quanto você indicaria a Dental Beauty"** — pergunta de
> recomendação, não de experiência. Workflow `a621c15b-6e0e-461b-abf9-0ce755b55787`.

**Quando dispara:** o motor marca a tag para quem compareceu — mas **só a cada 3 vindas**. O
espaçamento é do backend (`visitCounter.ts`), não do workflow: a cliente vetou o envio depois de
toda consulta porque, para quem está em tratamento, a mesma pergunta a cada sessão incomoda.

A trava antiga ("NPS - Nota está em branco", no gatilho) **foi removida**: ela impediria a segunda
rodada de perguntas, que é justamente o que a nova regra quer.

A nota que o paciente responde é tratada pelo agente, não pelo workflow.

## 4.1 · trilha = adulto

```
Olá, {{contact.first_name}}! 🤍
Foi um prazer receber você na Dental Beauty!
Queremos que cada visita seja marcada por acolhimento, confiança e uma experiência verdadeiramente especial, e a sua opinião nos ajuda a evoluir.
De 1 a 5, como você avalia a sua experiência com a gente?
```

## 4.2 · trilha = infantil

```
Olá, família de {{contact.nome_da_criana}}! 💖
Foi uma alegria receber vocês no Reino dos Guardiões!
Se quiser, conte também o que {{contact.nome_da_criana}} achou da aventura: adoramos saber.
E, para nos ajudar a evoluir: de 1 a 5, como vocês avaliam a experiência com a gente?
```

## 4.3 · Respostas por nota (vão no prompt do agente)

O agente grava a nota em `NPS - Nota` e responde conforme a faixa. São **três** faixas desde
12/11/2026, com a redação da **v4**. O link do Google **muda por unidade**, então o agente escolhe
pelo campo `{{contact.unidade}}`.

### Nota 5 · unidade = Recreio

```
Que alegria ler isso, {{contact.first_name}}! 🤍
Você toparia contar como foi a sua experiência no Google? Leva um minuto e ajuda outras pessoas a conhecerem a Dental Beauty:
https://g.page/r/CQZuDgYFDS09EBM/review
```

### Nota 5 · unidade = Ipanema

```
Que alegria ler isso, {{contact.first_name}}! 🤍
Você toparia contar como foi a sua experiência no Google? Leva um minuto e ajuda outras pessoas a conhecerem a Dental Beauty:
https://g.page/r/CUGB4w0QxtsmEBM/review
```

### Nota 4

```
Obrigada pela nota, {{contact.first_name}}! ✨
Queremos chegar no 5 com você: o que faltou para a sua experiência ser completa?
```

### Nota 1 a 3

```
Obrigada por contar, {{contact.first_name}}, e sinto muito que a sua experiência não tenha sido como você esperava. 🤍
Uma pessoa da nossa equipe vai te chamar para entender o que aconteceu. Qual o melhor horário para falar com você?
```

> A faixa 4 é a novidade: antes, tudo abaixo de 5 ia direto para atendimento humano. Agora o 4
> primeiro pergunta o que faltou — é a nota mais recuperável, e a resposta costuma ser específica.

---

# 4b · RÉGUA — Pesquisa em tratamento

Gatilho: Tag de contato · `regua-nps-tratamento`. Workflow `21bd2c11-9211-4604-a591-f44935f6be78`,
rascunho. Gatilho → mensagem → remove a tag.

O backend separa os dois casos pelo contador de visitas: a **1ª vinda observada** recebe o texto
de boas-vindas da régua 4; da **4ª em diante** (a cada 3) sai este, que pergunta pelas "últimas
consultas". Sem contador, todo mundo cai no texto da régua 4 — caminho legado.

```
Olá, {{contact.first_name}}! 🤍 Que bom acompanhar o seu tratamento de perto.
De 1 a 5, como você avalia as suas últimas consultas com a gente?
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
Se sentir algo diferente do que o dentista explicou, é só nos chamar por aqui que nossa equipe orienta você. ✨
```

## 6.2 · trilha = infantil

```
🧚 Olá, família de {{contact.nome_da_criana}}! 💖
Passando para saber como {{contact.nome_da_criana}} está se sentindo depois do procedimento de ontem.
Se notarem algo diferente do que o dentista explicou, é só chamar por aqui que nossa equipe orienta vocês.
```

## Criança que concluiu o tratamento · **descartada por ora (12/11/2026)**

A cliente respondeu: a Clinicorp **não tem campo de alta**. A conclusão do tratamento só aparece
escrita na ficha clínica, em texto livre. Sem um estado estruturado não há gatilho possível — e
ler texto livre de prontuário para disparar mensagem é frágil e invasivo demais.

O texto fica guardado aqui. Se um dia houver um campo (ou uma tag manual que a equipe aplique na
alta), a régua é meia hora de trabalho.

```
✨ Olá, família de {{contact.nome_da_criana}}!
Lembram de toda a jornada que vivemos juntos para cuidar desse sorriso? Foi uma conquista muito especial! 🏰
Agora queremos continuar fazendo parte dessa história, acompanhando o crescimento e preservando os resultados alcançados. Aqui na Dental Beauty Kids, nossa missão não termina quando o tratamento acaba.
Qual dia da semana fica melhor para a próxima visita preventiva? 💖
```
