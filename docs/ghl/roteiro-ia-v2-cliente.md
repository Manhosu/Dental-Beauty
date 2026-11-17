# Roteiro da IA — versão 2 da cliente (recebido em 16/11/2026)

A cliente mandou um documento bem mais completo que o meu: **"Como a IA atende · Versão 2"**,
27 páginas, que segundo ela mesma *"substitui o IA-Atendente-Frases e o Manual Completo de
jul/2026"*. Ele é endereçado "para o programador" e traz o fluxo do Miro **"Máquina de Vendas
2.0"**, que eu não conhecia.

**Este documento passa a ser a referência do agente.** O que eu tinha montado em
[agente-conversation-ai.md](agente-conversation-ai.md) é de agosto e perde para ele.

> O documento atribui a confirmação dos valores "ao Bruno, em 16/11" e a regra de não usar
> diminutivos "à Bruna". São duas pessoas diferentes citadas em terceira pessoa — o documento não
> diz quem o escreveu.

---

## O que ele traz de novo (sem conflito — é só adotar)

| Item | Como fica |
|---|---|
| **Nome da IA** | **Clara** — "Clara, assistente virtual da Dental Beauty". Confirma que é IA se perguntarem. No infantil, o tom segue o da Fada do Dente. |
| **Parcelamento** | **14x** no cartão (o "até 21x" da base de conhecimento saiu). Desconto e 18x ficam para a equipe. |
| **Radiologia** | **Só no Recreio.** A IA não promete radiografia em Ipanema. |
| **Instagram infantil** | **@dentalbeautykids** (o @fadabrunela saiu). |
| **Recepção** | (21) 99128-2761 · WhatsApp comercial (21) 98121-7082 · site dentalbeauty.com.br |
| **Horário das consultas** | Seg–qui 8h–19h · sex 8h–17h · sáb 8h–14h. A IA **atende e agenda 24h**. |
| **Estacionamento** | Recreio tem, no subsolo com elevador. Ipanema não tem. |
| **Avaliação online de lentes** | **R$ 150**, por vídeo, abatida na presencial. Oferecida já no 1º contato, ao lado da presencial. |
| **Sondagem antes do valor** | Uma pergunta ("o que mais te incomoda hoje?") antes de apresentar a avaliação. |
| **Travas de texto do OdontoBI** | As frases **"Agendamento realizado com sucesso"** e **"Data e horário:"** não podem ser reescritas — o OdontoBI lê elas para conferir a conversa contra a agenda do Clinicorp. |
| **Envios ativos** | Só entre **8h e 20h**. Responder quem escreveu vale a qualquer hora. |

### Equipe (mudou)

Haylane (prótese, implante, lentes) · Lívia (prótese, implante) · Sérgio Sinzato (implante) ·
Alinne (lentes, prótese, clareamento) · Adriana (ortodontia, ortopedia, clareamento) ·
Dr. Fábio (odontopediatria, ortopedia).

**Thaynara saiu da lista** — era Clínica Geral e Periodontia no material de agosto.
Em Ipanema atendem só Dr. Fábio e Alinne.

### Valores (tabela fechada)

| Avaliação | Recreio | Ipanema |
|---|---:|---:|
| Geral (implante, prótese, ortodontia, ortopedia, alinhador, clareamento, extração) | R$ 200 | R$ 300 |
| Com limpeza no mesmo dia (adulto) | R$ 598 | R$ 300 + R$ 650 |
| Lentes | R$ 400 | R$ 400 |
| Online de lentes (abatida na presencial) | R$ 150 | R$ 150 |
| Infantil · paciente novo | R$ 289 | R$ 489 |
| Infantil · com limpeza no mesmo dia | R$ 389 | R$ 589 |
| Infantil · já é paciente, voltou em < 1 ano (com limpeza) | R$ 360 | — |

Saíram: a "avaliação especializada R$ 550" e a limpeza grátis por indicação. Lentes no Recreio
caiu de R$ 550 para **R$ 400**.

**Minhas duas dúvidas de 16/11 ficaram respondidas:** prótese e clareamento em Ipanema entram na
avaliação geral, **R$ 300**. E ortodontia continua **só no Recreio** (§Unidades e §tratamentos),
apesar de a cliente ter escrito "300 para ortodontia" no WhatsApp — pela estrutura do documento ela
quis dizer a avaliação geral de Ipanema, que cobre ortopedia.

---

## ✅ Os cinco conflitos foram resolvidos (17/11/2026)

A cliente respondeu os cinco e mandou duas versões novas: **"Como a IA atende v2"** com a seção
"Agenda e pesquisas (17/11)" e **"Mensagens automáticas v4 (base Bruna)"**. Em quatro dos cinco ela
voltou ao que já estava montado.

| Conflito | Decisão dela | Efeito |
|---|---|---|
| Escala da pesquisa | **1 a 5** — nota 5 manda o link, 4 pergunta o que faltou, **1 a 3** chama um atendente. Vale também no NPS de quem não fechou. | ✅ feito no painel em 17/11 (ver abaixo). |
| Cadência | **A cada 3 vindas confirmado**, e a pesquisa de quem está em tratamento passa a usar as **mesmas respostas por nota**, inclusive o link do Google. | Código já fazia; painel precisa ligar o ramo de nota na régua de tratamento. |
| Confirmação | **Volta para D-4**, com regra nova de antecedência (abaixo). | `runConfirmacao` reescrita. |
| Lembrete do dia | **8h**, não 7h30. | Rodada matinal passou de 10h30 UTC para 11h UTC. |
| NPS de quem não fechou | **1 a 5** também. | Painel. |

### A regra nova de quando confirmar

Confirmar cedo existe para **liberar a vaga a tempo de chamar outro paciente**. Mas o D-4 não cabe
em quem marcou anteontem, então a janela agora depende de como o paciente marcou:

| Marcou com | Confirma em | Por quê |
|---|---|---|
| 6 dias ou mais | **D-4, às 8h** | dá tempo de reaproveitar a vaga |
| 5 a 3 dias antes | **D-2, às 8h** | o D-4 já passou ou cairia no dia seguinte à marcação |
| 2 dias ou menos | **não confirma** | a mensagem do próprio agendamento já serviu de confirmação |

Sem resposta: avisos às **12h e às 19h**; sem SIM até as **22h**, o horário é liberado às **8h do
dia seguinte** (D-3 para quem confirmou no D-4, D-1 para quem confirmou no D-2).

Implementado em `diasAntesDaConfirmacao` + `runConfirmacao` (`jobs.ts`), lendo o `CreateDate` do
agendamento — campo que a gente não estava trazendo da Clinicorp e agora traz. Sem `CreateDate`,
cai no D-4, que era o comportamento anterior.

**Ainda não existe:** as recobranças das 12h e 19h e a liberação do horário. São três mensagens
novas, e a liberação precisa escrever de volta na agenda do Clinicorp.

### Anamnese online — integração pronta do lado do OdontoBI

Documento próprio da clínica, 17/11. O sistema **já está no ar**.

- **D-2 às 8h** (só primeira avaliação): `POST /api/v1/anamnese/externo/links` cria o link e a régua
  manda pelo WhatsApp. Se a confirmação também cair no D-2, o link vai **logo depois do SIM**.
  Marcou com menos de 2 dias: manda logo depois da mensagem de agendamento.
- **D-1 às 8h**: `GET /api/v1/anamnese/externo/links/<id>` diz se respondeu. Se não, um lembrete só.
- Sete formulários por especialidade: `odontopediatria`, `ortodontia`, `implante`, `protese`,
  `lentes`, `endodontia`, `clinico_geral` (padrão quando não dá para saber).
- Mandar o `clinicorp_patient_id` sempre que existir — sem ele o PDF não sobe sozinho para a ficha.
- Chamar de novo é seguro: devolve o mesmo link com `reaproveitado: true`.
- **A IA não recebe as respostas**, só se o paciente respondeu. São dados de saúde.
- Erros: 401 (segredo), 400 (especialidade fora da lista), 502/503 (tentar de novo em 1 min, até 3).

Implementado em `src/integrations/anamnese/client.ts`. O segredo veio por mensagem e está **só no
`.env`**, que é gitignored. Como ele trafegou por WhatsApp, vale a clínica trocá-lo depois do teste
— o próprio documento prevê a troca.

**Montado em 17/11:** `runAnamneseD2` e `runAnamneseD1` (`anamneseJobs.ts`), rodando na rodada das
8h junto do lembrete do dia. O `id` do link vive no Redis por 7 dias (`anamneseStore.ts`) — ele
nasce no D-2 e só é usado no D-1, e as duas rodadas são execuções diferentes do processo. O
`Patient_PersonId` passou a ser mapeado.

Quem recebe a ficha sai de `ehPrimeiraAvaliacao`: categoria com "avalia" e **sem** "retorno". É
heurística assumida — o sinal bom seria a especialidade do Additional Info, que o backend não
enxerga. Errar é brando nos dois sentidos: link repetido vira `reaproveitado: true`, e não mandar
faz o dentista preencher na cadeira, como hoje.

No painel foram criados o campo **"Anamnese - Link"** (`{{contact.anamnese__link}}`,
id `foB9jkyqGLtaxiowXnM1`) e as tags `regua-anamnese` e `regua-anamnese-lembrete`.

**Montados em 17/11, como rascunho:**

| Workflow | Id | Gatilho |
|---|---|---|
| `RÉGUA — Anamnese (D-2)` | `eea8dd30-4e63-4189-9d06-0ea5198b0bd2` | tag `regua-anamnese` |
| `RÉGUA — Anamnese lembrete (D-1)` | `c414c0fc-86b2-41a0-b2e4-20a1d7e96070` | tag `regua-anamnese-lembrete` |

Os dois saíram de uma duplicata da pesquisa de satisfação, então herdaram a forma:
gatilho → remove a tag → trilha adulto/infantil → mensagem → remove a tag → FIM.

> ⚠️ **A duplicata traz as ações de remover tag apontando para a tag do original.** Nos dois
> workflows havia três ações removendo `regua-nps`, que teriam tirado a tag da pesquisa de um
> paciente que estivesse no meio dela. Todas foram repontadas para a tag do próprio workflow.
> Vale conferir isso em qualquer duplicata futura.

Textos (os quatro, da spec da anamnese):

- **D-2 adulto:** "Olá, {{contact.first_name}}! Faltam 2 dias para a sua avaliação 🤍 / Para o
  dentista já chegar conhecendo um pouco da sua saúde, preparamos uma ficha rápida, que você
  responde e assina pelo celular: {{contact.anamnese__link}} / Leva poucos minutos. Consegue
  preencher até amanhã?"
- **D-2 infantil:** mesma ideia, citando `{{contact.nome_da_criana}}` e a consulta encantada.
- **D-1 adulto e infantil:** o lembrete único, também com o link.

**Diferença da spec:** os textos dela trazem `[especialidade]` e `[profissional]`, que não existem
como campo no GHL — o backend sabe a especialidade, mas ela não é gravada no contato. As mensagens
dizem "a sua avaliação" e "o dentista". Se a cliente quiser a personalização, dá para criar os dois
campos e passar a gravá-los no dispatcher.

### Painel: o que já foi trocado em 17/11

**`RÉGUA — Pesquisa de satisfação`** (`a621c15b-6e0e-461b-abf9-0ce755b55787`) — as duas mensagens
foram reescritas com a redação da v4 e renomeadas para "Pesquisa 1 a 5":

- **adulto:** termina em *"De 1 a 5, como você avalia a sua experiência com a gente?"* (era "De 0 a
  5, o quanto você indicaria a Dental Beauty para alguém de quem você gosta?");
- **infantil:** termina em *"E, para nos ajudar a evoluir: de 1 a 5, como vocês avaliam a
  experiência com a gente?"*.

Os chips de `{{contact.first_name}}` e `{{contact.nome_da_criana}}` foram recriados e conferidos na
tela. O workflow segue **rascunho**.

> ⚠️ **Como editar uma mensagem já preenchida, sem quebrar.** Clicar numa linha e usar
> `Shift+Home` **não funciona**: a seleção pega a *linha visual* (o texto é um parágrafo só, com
> quebras), e o trecho errado é substituído. O "Cancelar" do painel **não desfaz** — o editor mantém
> o estado.
>
> O caminho que funciona: clicar numa linha curta do corpo da mensagem (para dar foco ao editor),
> `Ctrl+A`, e **redigitar a mensagem inteira**, com `Shift+Enter` entre as linhas. Digitar
> `{{contact.campo}}` cria o chip corretamente. O `Ctrl+A` só é perigoso quando o foco está no
> canvas — aí ele seleciona os nós, e `Delete` abre o modal de excluir.

**Não está neste workflow:** as respostas por nota (5 / 4 / 1 a 3). Elas vivem no prompt do agente
de conversa, que ainda é a versão de agosto.

---

## ⚠️ O registro dos conflitos, como estavam antes de 17/11

Estes cinco pontos **contradiziam decisões que a própria cliente tomou entre 11 e 13/11** e que já
estavam no código e no painel. Ficam aqui porque explicam por que o código é como é.

### 1. Pesquisa de satisfação: 0 a 10 × 0 a 5

| | |
|---|---|
| **v2 (p. 27)** | *"De 0 a 10, o quanto você indicaria a Dental Beauty"* → **nota 9 ou 10** convida para o Google |
| **Montado** | **0 a 5** → nota 5 manda o link do Google (um por unidade), nota 4 pergunta "o que faltou para ser um 5?", nota 0 a 3 avisa que um atendente vai chamar |

**Histórico:** em 11/11 ela tirou o 0–10 e pediu "1 a 5 estrelas"; em 12/11 fechou em "0 a 5"; em
**13/11 confirmou por escrito** que a escala é 0 a 5 igual para adulto e infantil.

**Leitura:** o v2 diz que esse trecho é "texto do documento das mensagens automáticas" — ou seja,
provavelmente foi copiado da versão **anterior** àquelas três rodadas, e o 0–10 voltou por descuido.
As três faixas (5 / 4 / 0–3) só fazem sentido em 0 a 5.

**Recomendo manter 0 a 5** e confirmar com ela.

### 2. Quando a pesquisa sai

| | |
|---|---|
| **v2 (p. 27)** | "Após a 1ª sessão" |
| **Montado** | 1ª vinda e depois **a cada 3 vindas** (pedido de 12/11, confirmado em 13/11) |

Pode não ser conflito — "após a 1ª sessão" talvez seja só o começo. Mas o v2 não fala da cadência,
e ela foi explícita: *"enviar sempre ficaria chato para pacientes em atendimento"*.

### 3. Confirmação da consulta: D-2 × 96h

| | |
|---|---|
| **v2 (p. 24)** | **D-4** manda o link da anamnese · **D-2 às 8h** pede a confirmação · **12h e 19h** recobram · **D-1 às 8h** libera o horário e oferece outro |
| **Montado** | Confirmação a **96h (D-4)**, decisão dela em 12/11 — *"com quatro dias, quem responde NÃO dá tempo de a recepção oferecer a vaga"* |

O v2 inverte: D-4 vira anamnese e a confirmação desce para D-2. E traz **três mensagens que não
existem** (as recobranças das 12h e 19h, e a liberação do horário no D-1).

Esta é a mudança mais cara: mexe no `CONFIRMACAO_DIAS_ANTES` do código, no workflow de confirmação
e exige um fluxo novo de recobrança.

### 4. O lembrete das 7h30 sumiu

O v2 vai do D-1 (vídeo do dentista) direto para o "Faltou". **Não há mensagem no dia da consulta.**

Montado: a régua 2b, *"sua consulta é hoje, às tal hora"*, às **7h30** para todos os pacientes do
dia — que foi exatamente o que ela pediu em 12/11 para substituir o lembrete de 2h antes.

Some um detalhe: o v2 diz que envios ativos saem **só entre 8h e 20h**, e 7h30 está fora dessa
janela. Pode ser que a regra valha só para lead (tentativas, nutrição, disparos) e não para
paciente agendado — mas precisa ficar claro.

### 5. O NPS de quem não fechou também está em 0 a 10

Na p. 26, o contato de quem não fechou o tratamento pergunta *"de 0 a 10, como foi a sua
experiência na avaliação?"*. Mesmo problema do item 1.

---

## O que o v2 acrescenta e ainda não existe em lugar nenhum

Isto é escopo novo. Não está montado, não estava combinado comigo, e boa parte depende do Black/CRM
e dos SDRs, não do backend:

- **Fluxo do Miro "Máquina de Vendas 2.0":** busca do telefone no Clinicorp na 1ª mensagem; SDR
  assume em 10 min no horário comercial, com rodízio entre 2 SDRs; cards de Leads quentes/mornos
  com resumo no CRM; régua humana dos SDRs (SDR 1 de D0 a D+4, SDR 2 de D+5 a D+9, D+10 banco de
  disparos).
- **2 tentativas em 24h + nutrição de 5 dias**, com vídeo e áudio por especialidade (implante,
  lentes, ortodontia/alinhador, odontopediatria, clínico geral) — 5 trilhas × 5 dias.
- **Mensagens de primeiro contato por campanha** (implante e lentes).
- **Data de retorno combinada**, gravada no Additional Info, com notificação ao SDR.
- **Anamnese por especialidade** no D-4, com link.
- **Vídeo/áudio do dentista no D-1** e vídeo da especialidade no primeiro contato.
- **Pós-avaliação:** contato da CRC no D+7, follow-up de 30 dias em três versões, lista de "motivos
  reais para reaparecer".
- **Convite de indicação** — com a ressalva de que o CFO restringe premiação em dinheiro e a regra
  precisa passar pela responsável técnica.
- **Respostas prontas por tratamento** (10 tratamentos) e **respostas alternativas** para os
  momentos em que a conversa trava.

## Próximo passo

Levar os cinco conflitos para ela antes de mexer em qualquer coisa. Os itens sem conflito
(valores, equipe, parcelamento, nome Clara, Instagram, travas do OdontoBI) podem entrar direto.
