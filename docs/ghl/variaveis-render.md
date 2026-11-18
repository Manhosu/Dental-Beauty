# Variáveis do Render — o que ligar para as réguas rodarem

Conferido contra a API do GoHighLevel em **18/11/2026**. Os ids abaixo são os reais da location
`ZCMG4O9K8UhFYmvx4i4b`; a lista completa dos 34 campos está em
[../ghl-custom-fields.json](../ghl-custom-fields.json).

Serviço no Render: **`dental-beauty-agenda`** · `https://dental-beauty-agenda.onrender.com`.

> Os ids de campo **não são segredo** — identificam campos dentro da location. O que é segredo
> (tokens da Clinicorp, do GHL, o `ANAMNESE_SECRET`) já está no Render e **não** se copia para cá.

## Cole isto nas variáveis de ambiente

```
REGUAS_ENABLED=true

GHL_FIELD_TRILHA=6BaeEWxRs6YU30ltODMS
GHL_FIELD_NOME_CRIANCA=D8nLqe0F9X4XAzyycSnu
GHL_FIELD_ULTIMO_PROCEDIMENTO=qEtzu0Lewqmw3R7JqU3J
GHL_FIELD_UNIDADE=9LmL1zDWQcRrFaKiEMg9
GHL_FIELD_REGUA_DIA=yzRuBc4QxUtyql9GTEpm
GHL_FIELD_REGUA_HORA=8EmEs4943eXyAFNX240h
GHL_FIELD_ANAMNESE_LINK=foB9jkyqGLtaxiowXnM1
GHL_FIELD_AGENDAMENTO=T7UxlEaWVQ7w0CMKliPL

LIBERAR_HORARIO_ATIVO=true
```

## O que cada uma destrava

| Variável | Sem ela | Com ela |
|---|---|---|
| `REGUAS_ENABLED` | **nada dispara** — o cron nem liga | as réguas rodam todo dia |
| `GHL_FIELD_TRILHA` … `_REGUA_HORA` | as réguas do GHL ficam dormentes (o bloco inteiro exige os 6) | o contato recebe trilha, nome da criança, procedimento, unidade, dia e hora |
| `GHL_FIELD_ANAMNESE_LINK` | a anamnese marca a tag mas o workflow não tem link para interpolar | o link pessoal da ficha chega na mensagem |
| `GHL_FIELD_AGENDAMENTO` | o webhook de liberação manda `appointmentId` vazio e toma **400** | a liberação do horário funciona |
| `LIBERAR_HORARIO_ATIVO` | `/reguas/liberar-horario` responde `simulado` e não cancela nada | o horário é liberado de verdade na Clinicorp |

`ANAMNESE_SECRET` já deve estar lá desde 17/11 — sem ele a régua da anamnese fica dormente.

> **Aplicadas no Render em 18/11/2026**, via API do Render (serviço `srv-d8um6urtqb8s7387h2t0`).
> Faltavam também `GHL_LOCATION_ID`, `GHL_PRIVATE_TOKEN` e `ANAMNESE_SECRET` — sem elas as réguas
> não marcariam tag nenhuma, mesmo ligadas. **`REGUAS_ENABLED` está em `false` de propósito**:
> ver "O susto do build de agosto" no fim.

## `API_KEY_SECRET` — resolvido em 18/11: **está ligada**

Testado ao vivo pela aba **Teste** do construtor de API do painel, em 18/11/2026:

```
GET https://dental-beauty-agenda.onrender.com/agendamento/disponibilidade?date=2026-11-25&unidade=Recreio
HTTP 401  { "error": "unauthorized" }
```

O servidor está no ar e **exige** o header. Logo, `API_KEY_SECRET` está definida no Render, e todo
lugar que chama o backend precisa mandar `x-api-key` com o valor exato. São três:

| Onde | Estado |
|---|---|
| Webhook do `#2 RÉGUA — Sem confirmação` | ✅ preenchido com o valor real em 18/11 |
| Ação `Consulta horarios livres` da Clara | ✅ montada e testada (HTTP 200) |
| Ação `Agenda a avaliacao` da Clara | ✅ montada e testada (HTTP 201) |

O valor só existe no painel do Render (serviço `dental-beauty-agenda` → Environment →
`API_KEY_SECRET`). Não está no `.env` local nem em nenhum doc daqui.

## O susto do build de agosto

Ao ligar as variáveis descobri que o que rodava no Render era o commit `d0bacad`, de **3 de agosto**
— 44 commits atrás, antes de toda a migração para o GoHighLevel. Duas consequências:

1. `/reguas/liberar-horario` **não existia** (404), então o webhook da liberação nunca funcionaria,
   mesmo com a chave certa.
2. O cron daquele build dispara as réguas **pelo Chatbotify**, e as três variáveis
   `CHATBOTIFY_REGUA_*` continuam preenchidas no Render. `REGUAS_ENABLED=true` ali teria começado a
   mandar mensagem de verdade para paciente de verdade pela plataforma antiga.

Nada chegou a disparar: no Render, mexer em variável **não reinicia o serviço sozinho** — o último
deploy continuou sendo o de agosto até o `git push`. Ainda assim, `REGUAS_ENABLED` voltou para
`false` na hora.

O push subiu os 44 commits e o auto-deploy colocou o código novo no ar
(`c356a7a`, depois `9daf632`). Conferido depois do deploy:

- `/reguas/liberar-horario` responde **400** de validação, não mais 404 — a rota existe.
- `?unidade=Ipanema` devolve só slots de Ipanema.

**`REGUAS_ENABLED` segue `false`.** Ligar é o go-live das réguas e precisa ser uma decisão com
hora marcada, junto com a publicação dos 13 workflows.

## Depois da primeira liberação real

Procurar no log do Render a linha com `appointmentId` e olhar o campo **`aindaNaAgenda`**:

- `false` → o agendamento saiu da listagem, a vaga está livre. É o esperado.
- `true` → sai como **"ATENÇÃO: o agendamento continua na agenda depois do cancelamento"**. O
  cancelamento não pegou e a régua precisa ser repensada.

O log também traz `resposta`, que é o que a Clinicorp devolveu no `cancel_appointment`.
