# As duas `Chamada de API` da Clara — especificação pronta para montar

Estas são as ações que fazem a Clara **agendar de verdade** na Clinicorp, em vez de só conversar
sobre agendar. Estão descritas aqui porque o painel não deixa salvá-las sem o `API_KEY_SECRET`
(ver abaixo).

Painel: **IA → Clara - Atendimento Dental Beauty → Ações → Configure suas ações → Chamada de API.**

## O bloqueio

O construtor de API tem 4 abas (Conectar à API, Autenticação, Geral, Teste) e o botão **Concluído**
só habilita depois de um teste que responda **200**. O backend responde **401** sem o header
`x-api-key`, e o valor está só no Render (serviço `dental-beauty-agenda` → Environment →
`API_KEY_SECRET`).

Com o valor em mãos, as duas ações saem em poucos minutos seguindo o que está abaixo.

## Ação 1 — `Consulta horários livres`

**Conectar à API**

- Método e URL: `GET https://dental-beauty-agenda.onrender.com/agendamento/disponibilidade`
- Coleta de dados (Formulário), dois campos, ambos **Obrigatório**:

| Campo | Descrição para a IA | Exemplo | Enums |
|---|---|---|---|
| `date` | A data que o paciente quer, no formato AAAA-MM-DD. Converta o que ele disser ("terça", "dia 25", "semana que vem") para a data real. Nunca envie data no passado. | `2026-11-25` | — |
| `unidade` | A unidade escolhida pelo paciente. Use exatamente Recreio ou Ipanema. | `Recreio` | `Recreio`, `Ipanema` |

**Autenticação:** Autenticação necessária **ligada** → Tipo `Chave de API` → Cabeçalho
`x-api-key` → Valor = o `API_KEY_SECRET` do Render.

**Geral**

- Nome: `Consulta horários livres`
- Quando executar: *Execute quando o paciente já tiver (a) escolhido a unidade, (b) dito o que
  procura e (c) recebido o valor da avaliação, e agora for escolher dia e hora. Colete a data e a
  unidade antes de chamar. Em Ipanema, para ortodontia, só consulte segundas-feiras.*
- O que dizer depois: *Ofereça no máximo 2 ou 3 horários da resposta, em linguagem natural ("terça
  às 14h ou às 16h30"), nunca a lista inteira nem dados crus. Se vier vazia, diga que aquele dia
  está sem vaga e ofereça outro dia. Nunca mencione API nem sistema.*
- Tentar novamente em caso de falha: **ligado**. Tempo limite: 10s.

A resposta é `{ date, slots: [...] }`, e cada slot traz `from`, `to`, `professionalId`,
`professionalName` e `unit`. **A Clara precisa guardar `from`, `to` e `professionalId` do horário
que o paciente escolher** — são eles que vão na ação 2.

> O filtro `unidade` foi acrescentado ao endpoint em 18/11 justamente para isso: a Clara sabe a
> unidade, não sabe o id do profissional, e sem o filtro ela receberia os horários das duas
> unidades misturados. **Esse filtro ainda precisa subir para o Render** (o deploy atual não tem).

## Ação 2 — `Agenda a avaliação`

**Conectar à API**

- Método e URL: `POST https://dental-beauty-agenda.onrender.com/agendamento/book`
- Tipo de conteúdo: `application/json`
- Coleta de dados (Formulário), todos **Obrigatório**:

| Campo | Descrição para a IA | Exemplo |
|---|---|---|
| `date` | A data do horário que o paciente confirmou, em AAAA-MM-DD. | `2026-11-25` |
| `fromTime` | A hora de início exatamente como veio em `from` na consulta de horários. | `14:00` |
| `toTime` | A hora de fim exatamente como veio em `to` na consulta de horários. | `15:00` |
| `professionalId` | O `professionalId` do horário escolhido, da consulta de horários. Nunca invente. | `42` |
| `name` | O nome completo do paciente que vai ser atendido. Em consulta infantil, o nome da criança. | `Helena Martins` |
| `phone` | O telefone do contato, com DDD. | `21998877665` |

**Autenticação:** igual à ação 1.

**Geral**

- Nome: `Agenda a avaliação`
- Quando executar: *Execute só depois que o paciente confirmar explicitamente um horário oferecido
  e você já tiver o nome completo. Nunca execute para "ver se dá" nem para segurar horário.*
- O que dizer depois: *Com `status: confirmed`, responda com a confirmação no formato da Etapa 4 do
  prompt. Com `slot_taken`, diga que o horário acabou de ser preenchido, consulte os horários de
  novo e ofereça outro. Com qualquer outra falha, não invente que marcou: passe para a recepção.*
- Tentar novamente em caso de falha: **desligado** — repetir um POST de agendamento pode marcar
  duas vezes. Tempo limite: 15s.

Respostas: `201 { status: 'confirmed', appointmentId }`, `409 { status: 'slot_taken' }`,
`502 { status: 'failed', reason }`.

> O backend monta sozinho o resto do payload (`slotId`, `dentistPersonId`, `specialty`, o objeto
> `patient`) a partir desses campos planos — é o `preprocess` em
> [src/http/routes/agendamento.ts](../../src/http/routes/agendamento.ts).

## Depois de montar as duas

O prompt já manda a Clara consultar a agenda e marcar na hora, então não precisa mudar. Vale uma
conversa de teste com o bot em modo rascunho antes de ligar o canal.
