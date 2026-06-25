# Roteiro de Teste — Agente "Atendimento Lead" (Dental Beauty)

Conta WhatsApp **Disparos (21) 92000-2328**. Mande de **outro número**. Ideal: apague a conversa atual antes (evita cache).

## O que JÁ está ligado nesta fase
Saudação, roteamento bairro→unidade, especialidade/objetivo, **preços só de avaliação** (regra CRO), respostas do manual, objeções, transferência p/ humano, registro/qualificação do lead no CRM (Kanban "Atendimento Lead") e resumo do atendimento.

## O que AINDA NÃO está ligado (esperado)
- **Agendamento real** (puxar horários da Clinicorp + marcar): backend pronto/testado, mas a ligação HTTP no Flow Builder ainda não foi montada. O bot conversa sobre agendar, mas não mostra horários reais nem marca de fato.
- **Mídias** (fotos/vídeos por tipo de lead): pasta ainda em produção pelo cliente.

---

## Roteiro (mensagem → o que esperar)

| # | Você manda | O bot deve |
|---|---|---|
| 1 | `Oi` | Abrir com **"Olá! Seja bem-vindo(a) à Dental Beauty 😊"** + perguntar **bairro** e **objetivo** (dor/estética/aparelho/implante/limpeza). |
| 2 | `Moro no Recreio` | Direcionar para a unidade **Recreio**. |
| 3 | `Moro em Ipanema` (em outra conversa) | Direcionar para **Ipanema** (atende odontopediatria, ortopedia, lentes, prótese, clareamento; o resto manda p/ Recreio). |
| 4 | `Quero colocar aparelho` | Identificar especialidade (Ortodontia) e conduzir p/ **avaliação**. |
| 5 | `Quanto custa a avaliação?` | Dar **só o valor da consulta/avaliação por unidade** (ex.: Recreio R$200 com fotos/radiologias; Ipanema R$300). |
| 6 | `E quanto fica o aparelho completo?` | **NÃO** dar preço de tratamento. Explicar que valor de tratamento só após avaliação (regra CRO) e direcionar p/ agendar avaliação. |
| 7 | `Qual o endereço de vocês?` | Responder pelo manual (Recreio: Rua Almirante Ary Rongel, 511; Ipanema: Visconde de Pirajá, 550 sala 215). |
| 8 | `Tá caro` | Tratar a objeção com acolhimento (valor da avaliação inclui fotos/radiologias etc.), sem dar desconto inventado. |
| 9 | `Tenho medo de dentista` | Acolher, explicar ritmo calmo/controle do paciente, oferecer avaliação tranquila. |
| 10 | `Quero falar com um atendente` | Perguntar o motivo, tentar ajudar; se insistir, **transferir p/ humano** e mandar resumo p/ o atendente. |
| 11 | `É para meu filho de 5 anos` | Reconhecer **odontopediatria** (Recreio: novos R$289 / com limpeza R$389; Ipanema R$389). |
| 12 | `Quero agendar` | Pedir os dados e conduzir ao agendamento. *(Nesta fase não mostra horário real — esperado.)* |

---

## Fluxo completo (rode do início ao fim, numa conversa só)
1. `Oi, vi o instagram de vocês`
2. `Moro na Barra`  → (Barra não é lista Ipanema → Recreio)
3. `Queria fazer limpeza e ver uns implantes`
4. `Quanto é a avaliação?`
5. `E o implante, quanto sai?`  → (deve recusar preço de tratamento e direcionar p/ avaliação)
6. `Pode ser quinta de manhã?`  → (conduz ao agendamento; sem horário real ainda)

---

## O que observar / validar
- **Saudação** com "Olá" na 1ª msg. ✅
- **Velocidade** da resposta (anote o tempo aproximado).
- **Regra CRO:** nunca dá preço de tratamento sem avaliação; só valor de consulta.
- **Unidade certa** pelo bairro.
- **Registro no CRM:** depois do teste, abra **CRM → Kanban / Pipeline "Atendimento Lead"** e veja se o lead apareceu/foi qualificado (quente/morno/frio) e em qual etapa.
- **Resumo:** ao pedir atendente (item 10), o atendente (número Atendimento Lead) deve receber um **resumo** do atendimento.

> Se o bot escorregar (ex.: der preço de tratamento, errar unidade, ou ficar "robótico"), anote a mensagem exata — dá pra ajustar no prompt.
