# As duas `Chamada de API` da Clara — montadas e testadas em 18/11/2026

São as ações que fazem a Clara **agendar de verdade** na Clinicorp, em vez de só conversar sobre
agendar. Ambas estão salvas no agente e passaram por um teste real contra a agenda de produção.

Painel: **IA → Clara - Atendimento Dental Beauty → Ações.**

## Ação 1 — `Consulta horarios livres`

- `GET https://dental-beauty-agenda.onrender.com/agendamento/disponibilidade`
- Autenticação: Chave de API, cabeçalho `x-api-key`, valor = `API_KEY_SECRET` do Render.
- Tentar novamente em caso de falha: **ligado**. Tempo limite: 10s.

Campos que a IA coleta, ambos obrigatórios:

| Campo | Descrição | Exemplo | Enums |
|---|---|---|---|
| `date` | A data que o paciente quer, em AAAA-MM-DD. Converte "terça", "dia 25", "semana que vem" para a data real. Nunca no passado. | `2026-11-25` | — |
| `unidade` | A unidade escolhida. Exatamente Recreio ou Ipanema. | `Recreio` | `Recreio`, `Ipanema` |

Resposta: `{ date, slots: [...] }`, cada slot com `from`, `to`, `professionalId`,
`professionalName` e `unit`. A instrução pós-ação manda a Clara **guardar `from`, `to` e
`professionalId`** do horário escolhido — são eles que vão na ação 2.

O filtro `unidade` foi acrescentado ao endpoint para isto: a Clara sabe a unidade, não sabe o id do
profissional, e sem o filtro receberia os horários das duas unidades misturados.

## Ação 2 — `Agenda a avaliacao`

- `POST https://dental-beauty-agenda.onrender.com/agendamento/book`, `application/json`
- Autenticação: igual à ação 1.
- Tentar novamente em caso de falha: **desligado** de propósito — repetir um POST de agendamento
  pode marcar duas vezes.

Campos que a IA coleta, todos obrigatórios:

| Campo | Descrição | Exemplo |
|---|---|---|
| `date` | A data do horário confirmado, em AAAA-MM-DD. | `2027-03-15` |
| `fromTime` | A hora de início exatamente como veio em `from`. Nunca inventar. | `8:00` |
| `toTime` | A hora de fim exatamente como veio em `to`. Nunca inventar. | `9:00` |
| `professionalId` | O `professionalId` do horário escolhido. Nunca inventar. | `4848869307449344` |
| `name` | O nome completo de quem vai ser atendido. No infantil, o da criança. | `Helena Martins Souza` |
| `phone` | O telefone do contato, com DDD, só números. | `21988887777` |

Respostas: `201 { status, appointmentId }`, `409 { status: 'slot_taken' }`,
`502 { status: 'failed', reason }`. A instrução pós-ação cobre as três, e manda **nunca dizer que
marcou** quando a chamada falha — nesse caso passa para a recepção.

O backend monta sozinho o resto do payload (`slotId`, `dentistPersonId`, `specialty`, o objeto
`patient`) a partir desses campos planos — é o `preprocess` em
[src/http/routes/agendamento.ts](../../src/http/routes/agendamento.ts).

## O teste real, e o bug que ele revelou

O construtor de API do painel só libera o botão **Concluído** depois de um teste que responda 2xx.
Para a ação de agendar isso significa **marcar uma consulta de verdade**. Feito em 15/03/2027 às
8h com a Adriana no Recreio, 16 meses à frente, e cancelado em seguida; a agenda do dia voltou a
zero e o horário das 8h voltou para a lista de livres.

A primeira tentativa respondeu **502** com `Clinicorp POST /appointment/create_appointment_by_api
-> 400`. Causa: `findPatientByPhone` pegava `response[0]` sem olhar o `Status`, e aquele telefone
tinha duas fichas — uma ativa e uma **DELETED** ("Compromisso Dr. Walter"), que vinha primeiro. O
backend mandava o `Patient_PersonId` de uma ficha excluída e a Clinicorp recusava. Corrigido em
`9daf632`: só ficha ativa resolve, e se todas estiverem excluídas não manda `Patient_PersonId`
nenhum, deixando a Clinicorp criar ficha nova.

Vale como aviso: esse telefone era um placeholder da base, mas **qualquer paciente cuja ficha
antiga tenha sido excluída e refeita** cairia no mesmo erro.

## O que o cancelamento faz — agora confirmado, não mais inferido

A resposta crua do `cancel_appointment` no agendamento de teste:

```json
{ "Deleted": "X", "Canceled": "X", "CanceledDate": "...", "DeletedDate": "...", "id": ... }
```

Ou seja: é **soft delete**. O registro continua na Clinicorp com a marca de cancelado, sai da
listagem da agenda e o horário volta a ficar livre. É exatamente o que a cliente pediu em 18/11 —
*"a IA pode mudar para cancelado e abrir para outro paciente... não excluir o agendamento"* — e
agora está verificado na prática, não deduzido do campo `Deleted` das listagens.
