# Textos das Réguas — APROVADOS pelo cliente (2026-07)

Fonte: PDF `MensagensparaenviosprogramadosIA.pdf` enviado pelo cliente. **Estes são os textos oficiais** a usar nos fluxos de disparo (Chatbotify) das réguas de relacionamento. Há duas trilhas: **ADULTO** e **INFANTIL** (Dental Beauty Kids).

> ⚠️ **Mudança de prazo:** Implante passou de **6m → 12m** (1 ano). Já refletido em `intervalMonthsForCategory` (`src/scheduling/reguas/jobs.ts`) e na spec.
> ⚠️ **Infantil usa 2 variáveis:** `[ nome responsável ]` e `[ nome do filho(a) ]`. Garantir esses dados no disparo (a partir da Clinicorp/CRM) antes de ativar a trilha infantil.

---

## ADULTO

### Retorno pós-procedimento

**Limpeza — 6 meses**
> Oi, [Nome]! 😊
> Já faz 6 meses da sua última limpeza aqui na Dental Beauty.
> Além de remover tártaro e prevenir cáries e gengivite, a gente aproveita pra revisar sua saúde bucal completa — com calma, sem pressa e sem aquele barulho de broca que incomoda 🦷✨
> Posso reservar seu horário para a próxima limpeza?

**Clareamento — 6 meses**
> Oi, [Nome]! ✨
> Seu clareamento completou 6 meses.
> O sorriso tende a escurecer naturalmente com o tempo — uma avaliação rápida mostra se vale um retoque leve pra manter o tom bonito e saudável 🦷
> Posso reservar seu horário?

**Restauração — 6 meses**
> Oi, [Nome]! 🙂
> Já faz 6 meses da sua restauração.
> A gente gosta de revisar: ver a integridade do material, a selagem marginal e se a mordida está confortável — tudo isso previne infiltração e trocas precoces 🦷
> Quer agendar essa checagem?

**Canal — 6 meses**
> Oi, [Nome]! 😊
> Seu tratamento de canal fez 6 meses.
> O acompanhamento radiográfico e clínico nessa fase é o que garante que o dente segue saudável, sem lesão apical ou reinfecção 🦷
> Posso reservar seu retorno?

**Coroa / Prótese — 12 meses**
> Oi, [Nome]! 🙂
> Sua prótese completou 1 ano.
> A revisão anual a gente confere ajuste oclusal, saúde gengival ao redor, integridade do cimento e estética — pra ela durar muitos anos certinha 🦷
> Quer que eu veja um horário?

**Implante — 12 meses (1 ano)**
> Oi, [Nome]! 😊
> Já faz 1 ano do seu implante.
> Nessa fase a gente avalia a osseointegração, saúde do tecido peri-implantar, higiene e oclusão — o segredo pra longevidade é o acompanhamento de perto 🦷
> Vamos marcar seu retorno?

**Periodontal — 3 meses**
> Oi, [Nome]! 🙂
> Seu tratamento periodontal fez 3 meses — o momento-chave da manutenção.
> A gente remove biofilme subgengival, reavalia sondagem e reforça a técnica pra manter a gengiva estável e evitar recidiva 🦷
> Posso agendar sua manutenção?

**Ortodontia adulto — acompanhamento (6 meses)**
> Oi, [Nome]! 😊
> Faz um tempinho do seu último acompanhamento ortodôntico.
> Seja pra verificar a contenção, evolução do caso ou planejar próximos passos, a gente te recebe com tempo pra conversar e tirar dúvidas 🦷
> Me avisa que eu reservo seu horário!

**Invisalign — acompanhamento (6 meses)**
> Oi, [Nome]! ✨
> Já faz um tempinho que finalizamos com o Invisalign.
> Vamos ver a evolução do alinhamento, conferir os encaixes, trocar alinhadores se necessário e alinhar os próximos passos 🦷
> Posso te passar horários?

**Lente / Faceta — 6 meses**
> Oi, [Nome]! ✨
> Suas lentes/facetas completaram 6 meses.
> A revisão a gente confere margem, brilho, saúde gengival, oclusão e estética — pra manter tudo impecável e duradouro 🦷
> Posso agendar sua avaliação?

### Aniversário
> Feliz aniversário, [Nome]! 🎉🎂
> A equipe da Dental Beauty te deseja um dia leve, feliz e cheio de motivos pra sorrir 💙
> Se quiser dar um up no sorriso nesse novo ciclo, a gente tá por aqui 🦷✨

### Confirmação — 24h antes
> Oi, [Nome]! 😊
> Lembrando da sua consulta amanhã, [dia] às [hora], na Dental Beauty.
> Responda SIM pra confirmar ou NÃO se precisar remarcar — a gente reorganiza na hora 🙌

### Confirmação — 2h antes (opcional)
> Oi, [Nome]! 😊
> Sua consulta é hoje às [hora].
> Tudo certo pra você vir? Qualquer imprevisto, só me avisar.

### Pós-consulta (NPS)
> Oi, [Nome]! 😊
> Como foi sua experiência com a gente hoje?
> De 0 a 10, o quanto indicaria a Dental Beauty pra alguém? 💙
> Sua resposta vem direto pra mim.

### Reengajamento — 12 meses sem vir
> Oi, [Nome]! 😊
> Faz um ano que não nos vemos.
> Uma avaliação completa agora evita tratamentos maiores depois — e aqui a consulta é tranquila, sem barulho de broca, com tempo pra conversar e planejar junto 🦷✨
> Quer que eu veja um horário?

### Reengajamento — 6 meses sem vir
> Oi, [Nome]! 🙂
> Já faz 6 meses da sua última consulta.
> Manter o acompanhamento em dia é o jeito mais simples de cuidar do sorriso sem sustos 🦷
> Posso agendar sua revisão?

---

## INFANTIL (Dental Beauty Kids)

> Usa `[ nome responsável ]` e `[ nome do filho(a) ]`.

**Limpeza — infantil**
> Oi, [ nome responsável ]! 😊
> Já está na hora da limpeza do(a) [ nome do filho(a) ]!
> Aqui na Dental Beauty Kids, cuidamos do sorriso com calma e carinho — tem brinquedos, cadeira com a cor favorita e tecnologia sem barulho de broca 🦷✨
> Quer que eu veja um horário?

**Restauração — infantil**
> Oi, [ nome responsável ]! 🙂
> Já faz um tempinho da restauração do(a) [ nome do filho(a) ].
> A gente gosta de revisar pra garantir que está tudo certinho — sempre de forma leve, sem medo e sem aquele barulho que assusta 🦷💛
> Quer agendar essa checagem?

**Ortodontia — infantil**
> Oi, [ nome responsável ]! 😊
> Faz um tempinho do acompanhamento ortodôntico do(a) [ nome do filho(a) ].
> Acompanhamos cada fase do sorriso com cuidado, de forma leve e tranquila 🦷✨
> Posso ver um horário pra vocês?

**Aniversário — infantil**
> Feliz aniversário! 🎉🎂
> Desejamos um dia cheio de alegria, brincadeiras e muitos sorrisos! 💛
> Conte com a gente pra cuidar do sorriso do(a) [ nome do filho(a) ] com todo carinho 🦷✨

**Confirmação — 24h antes (infantil)**
> Oi, [ nome responsável ]! 😊
> Lembrando da consulta do(a) [ nome do filho(a) ] amanhã, [dia] às [hora], na Dental Beauty Kids.
> Estamos preparando tudo com carinho 💛
> Responda SIM pra confirmar ou NÃO se precisar remarcar 🙌

**Confirmação — 2h antes (infantil)**
> Oi, [ nome responsável ]! 😊
> A consulta do(a) [ nome do filho(a) ] é hoje às [hora].
> Vai ser tudo bem tranquilo 💛
> Se precisar, é só me avisar!

**Pós-consulta (NPS) — infantil**
> Oi, [ nome responsável ]! 😊
> Como foi a experiência do(a) [ nome do filho(a) ] hoje com a gente? 💛
> De 0 a 10, o quanto você indicaria a Dental Beauty Kids?

**Reengajamento — 12 meses (infantil)**
> Oi, [ nome responsável ]! 😊
> Faz um tempinho que não vemos o(a) [ nome do filho(a) ] por aqui 💛
> Aqui ele/ela é atendido de forma leve, com brincadeiras e sem o barulho da broca 🦷✨
> Que tal voltarmos a acompanhar esses dentinhos?

**Reengajamento — 6 meses (infantil)**
> Oi, [ nome responsável ]! 🙂
> Já faz 6 meses da última consulta do(a) [ nome do filho(a) ].
> Manter o acompanhamento em dia ajuda a prevenir cáries e evita medo do dentista 🦷💛
> Posso agendar um horário pra vocês?
