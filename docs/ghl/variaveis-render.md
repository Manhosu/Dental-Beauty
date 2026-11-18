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
| Webhook do `#2 RÉGUA — Sem confirmação` | header `x-api-key` com `PREENCHER-COM-API_KEY_SECRET` — **sem isso a liberação toma 401 e o horário nunca é solto** |
| Ação `Consulta horários livres` da Clara | **não montada** — o painel só conclui a ação depois de um teste que responda 200 |
| Ação `Agenda a avaliação` da Clara | **não montada**, mesmo motivo |

O valor só existe no painel do Render (serviço `dental-beauty-agenda` → Environment →
`API_KEY_SECRET`). Não está no `.env` local nem em nenhum doc daqui.

## Depois da primeira liberação real

Procurar no log do Render a linha com `appointmentId` e olhar o campo **`aindaNaAgenda`**:

- `false` → o agendamento saiu da listagem, a vaga está livre. É o esperado.
- `true` → sai como **"ATENÇÃO: o agendamento continua na agenda depois do cancelamento"**. O
  cancelamento não pegou e a régua precisa ser repensada.

O log também traz `resposta`, que é o que a Clinicorp devolveu no `cancel_appointment`.
