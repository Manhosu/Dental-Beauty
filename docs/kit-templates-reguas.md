# Kit de Templates — Réguas de Relacionamento (WhatsApp API Oficial / Meta)

Guia pronto para **submeter as réguas como templates** no painel oficial. Textos = os **aprovados pelo cliente** ([textos-reguas-APROVADO.md](textos-reguas-APROVADO.md)). Duas trilhas: **ADULTO** e **INFANTIL** (Dental Beauty Kids).

## Padrão de cada template
- **Nome** (minúsculo, sem espaço): use o sugerido.
- **Categoria:** indicada em cada um — **Marketing** (retorno, aniversário, reengajamento) ou **Utility** (lembrete/confirmação de consulta e NPS — mais barato e ótima entrega).
- **Idioma:** `pt_BR`.
- **Cabeçalho:** **sem mídia** (texto puro) — o cliente aprovou assim. Se quiser, dá pra adicionar foto/vídeo depois.
- **Variáveis:** `{{1}}`, `{{2}}`… conforme indicado; a Meta pede um **valor de amostra** (também abaixo).
- **Rodapé (opcional):** `Responda SAIR para não receber` nas de Marketing (boa prática de opt-out).

> ⚠️ **Infantil** usa 2 dados: `{{1}}` = nome do responsável e `{{2}}` = nome da criança. Fonte na Clinicorp: campo **idade** (identifica criança) + campo **responsável** (nome do pai/mãe), conforme confirmado pelo cliente.
> 💡 **Utility x Marketing:** lembrete/confirmação de consulta e NPS entram como **Utility** (transacional, ligado a um agendamento) — mais baratos. O resto é **Marketing**.

---

# ADULTO

## Retorno pós-procedimento — categoria: **MARKETING** · variável `{{1}}` = nome (amostra: `Maria`)

### `reg_retorno_limpeza` — dispara 6 meses após
```
Oi, {{1}}! 😊
Já faz 6 meses da sua última limpeza aqui na Dental Beauty.
Além de remover tártaro e prevenir cáries e gengivite, a gente aproveita pra revisar sua saúde bucal completa — com calma, sem pressa e sem aquele barulho de broca que incomoda 🦷✨
Posso reservar seu horário para a próxima limpeza?
```

### `reg_retorno_clareamento` — 6 meses
```
Oi, {{1}}! ✨
Seu clareamento completou 6 meses.
O sorriso tende a escurecer naturalmente com o tempo — uma avaliação rápida mostra se vale um retoque leve pra manter o tom bonito e saudável 🦷
Posso reservar seu horário?
```

### `reg_retorno_restauracao` — 6 meses
```
Oi, {{1}}! 🙂
Já faz 6 meses da sua restauração.
A gente gosta de revisar: ver a integridade do material, a selagem marginal e se a mordida está confortável — tudo isso previne infiltração e trocas precoces 🦷
Quer agendar essa checagem?
```

### `reg_retorno_canal` — 6 meses
```
Oi, {{1}}! 😊
Seu tratamento de canal fez 6 meses.
O acompanhamento radiográfico e clínico nessa fase é o que garante que o dente segue saudável, sem lesão apical ou reinfecção 🦷
Posso reservar seu retorno?
```

### `reg_retorno_coroa_protese` — 12 meses
```
Oi, {{1}}! 🙂
Sua prótese completou 1 ano.
A revisão anual a gente confere ajuste oclusal, saúde gengival ao redor, integridade do cimento e estética — pra ela durar muitos anos certinha 🦷
Quer que eu veja um horário?
```

### `reg_retorno_implante` — 12 meses (1 ano)
```
Oi, {{1}}! 😊
Já faz 1 ano do seu implante.
Nessa fase a gente avalia a osseointegração, saúde do tecido peri-implantar, higiene e oclusão — o segredo pra longevidade é o acompanhamento de perto 🦷
Vamos marcar seu retorno?
```

### `reg_retorno_periodontal` — 3 meses
```
Oi, {{1}}! 🙂
Seu tratamento periodontal fez 3 meses — o momento-chave da manutenção.
A gente remove biofilme subgengival, reavalia sondagem e reforça a técnica pra manter a gengiva estável e evitar recidiva 🦷
Posso agendar sua manutenção?
```

### `reg_retorno_ortodontia` — 6 meses
```
Oi, {{1}}! 😊
Faz um tempinho do seu último acompanhamento ortodôntico.
Seja pra verificar a contenção, evolução do caso ou planejar próximos passos, a gente te recebe com tempo pra conversar e tirar dúvidas 🦷
Me avisa que eu reservo seu horário!
```

### `reg_retorno_invisalign` — 6 meses
```
Oi, {{1}}! ✨
Já faz um tempinho que finalizamos com o Invisalign.
Vamos ver a evolução do alinhamento, conferir os encaixes, trocar alinhadores se necessário e alinhar os próximos passos 🦷
Posso te passar horários?
```

### `reg_retorno_lente_faceta` — 6 meses
```
Oi, {{1}}! ✨
Suas lentes/facetas completaram 6 meses.
A revisão a gente confere margem, brilho, saúde gengival, oclusão e estética — pra manter tudo impecável e duradouro 🦷
Posso agendar sua avaliação?
```

## Outras réguas adulto

### `reg_aniversario_adulto` — **MARKETING** · `{{1}}` = nome (amostra: `Maria`)
```
Feliz aniversário, {{1}}! 🎉🎂
A equipe da Dental Beauty te deseja um dia leve, feliz e cheio de motivos pra sorrir 💙
Se quiser dar um up no sorriso nesse novo ciclo, a gente tá por aqui 🦷✨
```

### `reg_lembrete_24h_adulto` — **UTILITY** · `{{1}}`=nome (`Maria`), `{{2}}`=dia (`quinta (12/07)`), `{{3}}`=hora (`14:00`)
```
Oi, {{1}}! 😊
Lembrando da sua consulta amanhã, {{2}} às {{3}}, na Dental Beauty.
Responda SIM pra confirmar ou NÃO se precisar remarcar — a gente reorganiza na hora 🙌
```

### `reg_lembrete_2h_adulto` — **UTILITY** · `{{1}}`=nome (`Maria`), `{{2}}`=hora (`14:00`)
```
Oi, {{1}}! 😊
Sua consulta é hoje às {{2}}.
Tudo certo pra você vir? Qualquer imprevisto, só me avisar.
```

### `reg_nps_adulto` — **UTILITY** · `{{1}}` = nome (`Maria`)
```
Oi, {{1}}! 😊
Como foi sua experiência com a gente hoje?
De 0 a 10, o quanto indicaria a Dental Beauty pra alguém? 💙
Sua resposta vem direto pra mim.
```

### `reg_reengaj_12m_adulto` — **MARKETING** · `{{1}}` = nome (`Maria`)
```
Oi, {{1}}! 😊
Faz um ano que não nos vemos.
Uma avaliação completa agora evita tratamentos maiores depois — e aqui a consulta é tranquila, sem barulho de broca, com tempo pra conversar e planejar junto 🦷✨
Quer que eu veja um horário?
```

### `reg_reengaj_6m_adulto` — **MARKETING** · `{{1}}` = nome (`Maria`)
```
Oi, {{1}}! 🙂
Já faz 6 meses da sua última consulta.
Manter o acompanhamento em dia é o jeito mais simples de cuidar do sorriso sem sustos 🦷
Posso agendar sua revisão?
```

---

# INFANTIL (Dental Beauty Kids)

> `{{1}}` = nome do responsável (amostra: `Ana`) · `{{2}}` = nome da criança (amostra: `Pedro`)

## Retorno pós-procedimento — categoria: **MARKETING**

### `reg_retorno_limpeza_infantil`
```
Oi, {{1}}! 😊
Já está na hora da limpeza do(a) {{2}}!
Aqui na Dental Beauty Kids, cuidamos do sorriso com calma e carinho — tem brinquedos, cadeira com a cor favorita e tecnologia sem barulho de broca 🦷✨
Quer que eu veja um horário?
```

### `reg_retorno_restauracao_infantil`
```
Oi, {{1}}! 🙂
Já faz um tempinho da restauração do(a) {{2}}.
A gente gosta de revisar pra garantir que está tudo certinho — sempre de forma leve, sem medo e sem aquele barulho que assusta 🦷💛
Quer agendar essa checagem?
```

### `reg_retorno_ortodontia_infantil`
```
Oi, {{1}}! 😊
Faz um tempinho do acompanhamento ortodôntico do(a) {{2}}.
Acompanhamos cada fase do sorriso com cuidado, de forma leve e tranquila 🦷✨
Posso ver um horário pra vocês?
```

## Outras réguas infantil

### `reg_aniversario_infantil` — **MARKETING** · `{{1}}` = nome da criança (amostra: `Pedro`)
```
Feliz aniversário! 🎉🎂
Desejamos um dia cheio de alegria, brincadeiras e muitos sorrisos! 💛
Conte com a gente pra cuidar do sorriso do(a) {{1}} com todo carinho 🦷✨
```

### `reg_lembrete_24h_infantil` — **UTILITY** · `{{1}}`=responsável (`Ana`), `{{2}}`=criança (`Pedro`), `{{3}}`=dia (`quinta (12/07)`), `{{4}}`=hora (`14:00`)
```
Oi, {{1}}! 😊
Lembrando da consulta do(a) {{2}} amanhã, {{3}} às {{4}}, na Dental Beauty Kids.
Estamos preparando tudo com carinho 💛
Responda SIM pra confirmar ou NÃO se precisar remarcar 🙌
```

### `reg_lembrete_2h_infantil` — **UTILITY** · `{{1}}`=responsável (`Ana`), `{{2}}`=criança (`Pedro`), `{{3}}`=hora (`14:00`)
```
Oi, {{1}}! 😊
A consulta do(a) {{2}} é hoje às {{3}}.
Vai ser tudo bem tranquilo 💛
Se precisar, é só me avisar!
```

### `reg_nps_infantil` — **UTILITY** · `{{1}}`=responsável (`Ana`), `{{2}}`=criança (`Pedro`)
```
Oi, {{1}}! 😊
Como foi a experiência do(a) {{2}} hoje com a gente? 💛
De 0 a 10, o quanto você indicaria a Dental Beauty Kids?
```

### `reg_reengaj_12m_infantil` — **MARKETING** · `{{1}}`=responsável (`Ana`), `{{2}}`=criança (`Pedro`)
```
Oi, {{1}}! 😊
Faz um tempinho que não vemos o(a) {{2}} por aqui 💛
Aqui ele/ela é atendido de forma leve, com brincadeiras e sem o barulho da broca 🦷✨
Que tal voltarmos a acompanhar esses dentinhos?
```

### `reg_reengaj_6m_infantil` — **MARKETING** · `{{1}}`=responsável (`Ana`), `{{2}}`=criança (`Pedro`)
```
Oi, {{1}}! 🙂
Já faz 6 meses da última consulta do(a) {{2}}.
Manter o acompanhamento em dia ajuda a prevenir cáries e evita medo do dentista 🦷💛
Posso agendar um horário pra vocês?
```

---

## Resumo (25 templates)
| # | Template | Trilha | Categoria | Variáveis |
|---|---|---|---|---|
| 1 | reg_retorno_limpeza | Adulto | Marketing | {{1}} nome |
| 2 | reg_retorno_clareamento | Adulto | Marketing | {{1}} nome |
| 3 | reg_retorno_restauracao | Adulto | Marketing | {{1}} nome |
| 4 | reg_retorno_canal | Adulto | Marketing | {{1}} nome |
| 5 | reg_retorno_coroa_protese | Adulto | Marketing | {{1}} nome |
| 6 | reg_retorno_implante | Adulto | Marketing | {{1}} nome |
| 7 | reg_retorno_periodontal | Adulto | Marketing | {{1}} nome |
| 8 | reg_retorno_ortodontia | Adulto | Marketing | {{1}} nome |
| 9 | reg_retorno_invisalign | Adulto | Marketing | {{1}} nome |
| 10 | reg_retorno_lente_faceta | Adulto | Marketing | {{1}} nome |
| 11 | reg_aniversario_adulto | Adulto | Marketing | {{1}} nome |
| 12 | reg_lembrete_24h_adulto | Adulto | **Utility** | {{1}} nome, {{2}} dia, {{3}} hora |
| 13 | reg_lembrete_2h_adulto | Adulto | **Utility** | {{1}} nome, {{2}} hora |
| 14 | reg_nps_adulto | Adulto | **Utility** | {{1}} nome |
| 15 | reg_reengaj_12m_adulto | Adulto | Marketing | {{1}} nome |
| 16 | reg_reengaj_6m_adulto | Adulto | Marketing | {{1}} nome |
| 17 | reg_retorno_limpeza_infantil | Infantil | Marketing | {{1}} resp., {{2}} criança |
| 18 | reg_retorno_restauracao_infantil | Infantil | Marketing | {{1}} resp., {{2}} criança |
| 19 | reg_retorno_ortodontia_infantil | Infantil | Marketing | {{1}} resp., {{2}} criança |
| 20 | reg_aniversario_infantil | Infantil | Marketing | {{1}} criança |
| 21 | reg_lembrete_24h_infantil | Infantil | **Utility** | {{1}} resp., {{2}} criança, {{3}} dia, {{4}} hora |
| 22 | reg_lembrete_2h_infantil | Infantil | **Utility** | {{1}} resp., {{2}} criança, {{3}} hora |
| 23 | reg_nps_infantil | Infantil | **Utility** | {{1}} resp., {{2}} criança |
| 24 | reg_reengaj_12m_infantil | Infantil | Marketing | {{1}} resp., {{2}} criança |
| 25 | reg_reengaj_6m_infantil | Infantil | Marketing | {{1}} resp., {{2}} criança |

> Com o **kit de follow-up** (25, todos Marketing) + este **kit de réguas** (25), são **50 templates** no total pra subir na Meta.
